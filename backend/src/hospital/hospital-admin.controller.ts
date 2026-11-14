import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  HttpCode,
  Header,
  Optional,
  Query,
  StreamableFile,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthorizationLookupService } from '../common/services/authorization-lookup.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Roles a hospital_admin may never assign. */
export const HOSPITAL_ADMIN_FORBIDDEN_ROLES = [
  'super_admin',
  'hospital_admin',
] as const;

/** Maximum receptionists per department (application-layer limit). */
export const MAX_RECEPTIONISTS_PER_DEPARTMENT = 5;

/**
 * Throws 403 when a hospital_admin tries to assign a privileged role.
 * Call this BEFORE any Supabase or DB call.
 */
export function assertAssignableRole(role: string): void {
  if ((HOSPITAL_ADMIN_FORBIDDEN_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ASSIGNABLE',
      message: 'Hospital administrators cannot assign this role',
    });
  }
}

class NameBody {
  @IsString()
  @MaxLength(120)
  name!: string;
}

class QueueBody extends NameBody {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  roomLabel?: string;
}

class QueueSettings {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  acceptingWalkIns?: boolean;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  doctorId?: string | null;
}

class ProvisionAdminBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(120)
  name!: string;
}

class ProvisionStaffBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  role!: 'doctor' | 'receptionist';

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

class StaffStatusBody {
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

function nameOf(body: NameBody) {
  const name = body.name.trim();
  if (!name) throw new BadRequestException('Name is required');
  return name;
}

@Controller('admin')
export class HospitalAdminController {
  constructor(
    private readonly db: PrismaService,
    private readonly authLookup: AuthorizationLookupService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  @Get('hospitals')
  async listHospitals(@CurrentUser('id') actor: string) {
    const scope = await this.hospitalScope(actor);
    return this.db.hospital.findMany({
      where: scope,
      orderBy: { name: 'asc' },
      include: {
        admins: { select: { userId: true } },
        departments: {
          include: {
            queues: true,
            receptionists: { select: { userId: true } },
          },
        },
      },
    });
  }

  @Get('hospitals/:hospitalId/report')
  report(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    return this.dailyReport(actor, hospitalId, date);
  }

  @Get('hospitals/:hospitalId/report.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="hospital-report.csv"')
  async exportReport(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    const report = await this.dailyReport(actor, hospitalId, date);
    const lines = report.departments.map((row) =>
      [
        row.departmentId,
        row.tokens,
        row.completed,
        row.averageWaitMinutes ?? '',
      ].join(','),
    );
    return ['departmentId,tokens,completed,averageWaitMinutes', ...lines].join(
      '\r\n',
    );
  }

  @Get('hospitals/:hospitalId/report.pdf')
  async exportPdf(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    const report = await this.dailyReport(actor, hospitalId, date);
    const pdf = new PDFDocument({ size: 'A4', margin: 50 });
    pdf.fontSize(20).text('Daily hospital queue report');
    pdf.moveDown().fontSize(11).text(report.date);
    pdf.text('Unique patients: ' + report.uniquePatients);
    for (const row of report.departments) {
      pdf.moveDown().fontSize(13).text(row.departmentName);
      pdf.fontSize(11).text('Queue tokens: ' + row.tokens);
      pdf.text('Consultations completed: ' + row.completed);
      pdf.text(
        'Average wait: ' +
          (row.averageWaitMinutes === null
            ? 'Unavailable'
            : row.averageWaitMinutes + ' minutes'),
      );
    }
    pdf.end();
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="hospital-report.pdf"',
    });
  }

  private async dailyReport(actor: string, hospitalId: string, date: string) {
    const start = new Date(date + 'T00:00:00+05:30');
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(+start) ||
      new Date(+start + 19_800_000).toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('Use a valid YYYY-MM-DD report date');
    }
    const hospital = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      select: { id: true, departments: { select: { id: true, name: true } } },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');
    const tokens = await this.db.queueToken.findMany({
      where: {
        queue: { department: { hospitalId } },
        issuedAt: { gte: start, lt: new Date(+start + 86_400_000) },
      },
      select: {
        patientId: true,
        status: true,
        issuedAt: true,
        calledAt: true,
        queue: { select: { departmentId: true } },
      },
    });
    return {
      date,
      uniquePatients: new Set(tokens.map((token) => token.patientId)).size,
      departments: hospital.departments.map((department) => {
        const rows = tokens.filter(
          (token) => token.queue.departmentId === department.id,
        );
        const called = rows.flatMap((token) =>
          token.calledAt ? [(+token.calledAt - +token.issuedAt) / 60_000] : [],
        );
        return {
          departmentId: department.id,
          departmentName: department.name,
          tokens: rows.length,
          completed: rows.filter((token) => token.status === 'COMPLETED')
            .length,
          averageWaitMinutes: called.length
            ? Math.round(
                called.reduce((sum, minutes) => sum + minutes, 0) /
                  called.length,
              )
            : null,
        };
      }),
    };
  }

  @Roles('super_admin')
  @Post('hospitals')
  createHospital(@Body() body: NameBody) {
    return this.db.hospital.create({ data: { name: nameOf(body) } });
  }

  @Post('hospitals/:hospitalId/departments')
  async createDepartment(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Body() body: NameBody,
  ) {
    if (
      !(await this.db.hospital.findFirst({
        where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      }))
    ) {
      throw new NotFoundException('Hospital not found');
    }
    return this.db.department.create({
      data: { hospitalId, name: nameOf(body) },
    });
  }

  @Post('departments/:departmentId/queues')
  async createQueue(
    @CurrentUser('id') actor: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: QueueBody,
  ) {
    if (
      !(await this.db.department.findFirst({
        where: { id: departmentId, hospital: await this.hospitalScope(actor) },
      }))
    ) {
      throw new NotFoundException('Department not found');
    }
    return this.db.hospitalQueue.create({
      data: {
        departmentId,
        name: nameOf(body),
        roomLabel: body.roomLabel?.trim() || null,
        publicQueueId: randomUUID(),
      },
    });
  }

  @Patch('queues/:queueId')
  async configureQueue(
    @CurrentUser('id') actor: string,
    @Param('queueId', ParseUUIDPipe) id: string,
    @Body() body: QueueSettings,
  ) {
    const hospital = await this.hospitalScope(actor);
    if (
      !(await this.db.hospitalQueue.findFirst({
        where: { id, department: { hospital } },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Queue not found');
    if (body.doctorId) await this.ensureActiveUser(body.doctorId);
    const [queue] = await this.db.hospitalQueue.updateManyAndReturn({
      where: { id, department: { hospital } },
      data: {
        doctorId: body.doctorId,
        acceptingWalkIns: body.acceptingWalkIns,
      },
    });
    if (!queue) throw new NotFoundException('Queue not found');
    return queue;
  }

  @Put('departments/:departmentId/receptionists/:userId')
  async assignReceptionist(
    @CurrentUser('id') actor: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    // Validate department belongs to actor's hospital
    const hospital = await this.hospitalScope(actor);
    if (
      !(await this.db.department.findFirst({
        where: { id: departmentId, hospital },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Department not found');
    }
    // Enforce per-department receptionist limit
    const currentCount = await this.db.receptionAssignment.count({
      where: { departmentId },
    });
    if (currentCount >= MAX_RECEPTIONISTS_PER_DEPARTMENT) {
      throw new ConflictException({
        code: 'RECEPTIONIST_LIMIT_REACHED',
        message: 'Department receptionist limit reached',
      });
    }
    await this.ensureActiveUser(userId);
    const assignment = { departmentId, userId };
    return this.db.receptionAssignment.upsert({
      where: { userId_departmentId: assignment },
      create: assignment,
      update: {},
    });
  }

  @Delete('departments/:departmentId/receptionists/:userId')
  @HttpCode(204)
  async removeReceptionist(
    @CurrentUser('id') actor: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const hospital = await this.hospitalScope(actor);
    if (
      !(await this.db.department.findFirst({
        where: { id: departmentId, hospital },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Department not found');
    await this.db.receptionAssignment.deleteMany({
      where: { departmentId, userId, department: { hospital } },
    });
  }

  @Get('departments/:departmentId/receptionists')
  async listDepartmentReceptionists(
    @CurrentUser('id') actor: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    const hospital = await this.hospitalScope(actor);
    if (
      !(await this.db.department.findFirst({
        where: { id: departmentId, hospital },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Department not found');
    }
    const assignments = await this.db.receptionAssignment.findMany({
      where: { departmentId },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });
    return {
      items: assignments.map((a) => ({
        userId: a.userId,
        name: a.user.name,
        email: a.user.email,
        status: a.user.status,
      })),
    };
  }

  @Get('hospitals/:hospitalId/queues')
  async listHospitalQueues(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    const hospital = await this.hospitalScope(actor);
    const h = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...hospital },
      select: { id: true },
    });
    if (!h) throw new NotFoundException('Hospital not found');
    const queues = await this.db.hospitalQueue.findMany({
      where: { department: { hospitalId } },
      include: {
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    });
    return queues.map((q) => ({
      id: q.id,
      name: q.name,
      departmentId: q.departmentId,
      departmentName: q.department.name,
      roomLabel: q.roomLabel,
      doctorId: q.doctorId,
      doctorName: q.doctor?.name ?? null,
      acceptingWalkIns: q.acceptingWalkIns,
      publicQueueId: q.publicQueueId,
    }));
  }

  @Roles('super_admin')
  @Put('hospitals/:hospitalId/admins/:userId')
  async assignHospitalAdmin(
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.ensureActiveUser(userId);
    if (
      !(await this.db.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Hospital not found');
    }
    const assignment = { hospitalId, userId };
    return this.db.hospitalAdminAssignment.upsert({
      where: { hospitalId_userId: assignment },
      create: assignment,
      update: {},
    });
  }

  @Roles('super_admin')
  @Delete('hospitals/:hospitalId/admins/:userId')
  @HttpCode(204)
  async removeHospitalAdmin(
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.db.hospitalAdminAssignment.deleteMany({
      where: { hospitalId, userId },
    });
  }

  // ─── A. Hospital Admin Provisioning ──────────────────────────────────────────

  @Roles('super_admin')
  @Post('hospitals/:hospitalId/provision-admin')
  async provisionHospitalAdmin(
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Body() body: ProvisionAdminBody,
  ) {
    if (
      !(await this.db.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Hospital not found');
    }

    const email = body.email.trim().toLowerCase();
    const name = body.name.trim() || email.split('@')[0];
    const { supabaseUid } = await this.createSupabaseUser(email);

    const supabaseUrl =
      this.config?.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      'https://jxxfiligudvxqtzkzvzk.supabase.co';
    const origin = new URL(supabaseUrl).origin;
    const supabaseIdentity = `${origin}/auth/v1|${supabaseUid.toLowerCase()}`;

    const user = await this.db.user.upsert({
      where: { email },
      create: {
        email,
        name,
        supabaseIdentity,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        supabaseIdentity,
        name,
        emailVerifiedAt: new Date(),
      },
    });

    await this.assignGlobalRole(user.id, 'hospital_admin');

    await this.db.hospitalAdminAssignment.upsert({
      where: { hospitalId_userId: { hospitalId, userId: user.id } },
      create: { hospitalId, userId: user.id },
      update: {},
    });

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      hospitalId,
      supabaseUserId: supabaseUid,
    };
  }

  // ─── B. Staff Provisioning ────────────────────────────────────────────────────

  @Post('hospitals/:hospitalId/staff')
  async provisionStaff(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Body() body: ProvisionStaffBody,
  ) {
    const hospital = await this.hospitalScope(actor);
    const h = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...hospital },
      select: { id: true },
    });
    if (!h) {
      throw new NotFoundException('Hospital not found');
    }

    assertAssignableRole(body.role);
    if (body.role !== 'doctor' && body.role !== 'receptionist') {
      throw new BadRequestException('Role must be doctor or receptionist');
    }

    let assignedDepartmentId: string | undefined;
    if (body.role === 'receptionist' && body.departmentId) {
      const dept = await this.db.department.findFirst({
        where: { id: body.departmentId, hospitalId },
        select: { id: true },
      });
      if (!dept) {
        throw new NotFoundException('Department not found in this hospital');
      }

      const count = await this.db.receptionAssignment.count({
        where: { departmentId: body.departmentId },
      });
      if (count >= MAX_RECEPTIONISTS_PER_DEPARTMENT) {
        throw new ConflictException({
          code: 'RECEPTIONIST_LIMIT_REACHED',
          message: 'Department receptionist limit reached',
        });
      }
      assignedDepartmentId = body.departmentId;
    }

    const email = body.email.trim().toLowerCase();
    const name = body.name.trim() || email.split('@')[0];
    const { supabaseUid } = await this.createSupabaseUser(email);

    const supabaseUrl =
      this.config?.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      'https://jxxfiligudvxqtzkzvzk.supabase.co';
    const origin = new URL(supabaseUrl).origin;
    const supabaseIdentity = `${origin}/auth/v1|${supabaseUid.toLowerCase()}`;

    const user = await this.db.user.upsert({
      where: { email },
      create: {
        email,
        name,
        supabaseIdentity,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        supabaseIdentity,
        name,
        emailVerifiedAt: new Date(),
      },
    });

    await this.assignGlobalRole(user.id, body.role);

    if (body.role === 'receptionist' && assignedDepartmentId) {
      await this.db.receptionAssignment.upsert({
        where: {
          userId_departmentId: {
            userId: user.id,
            departmentId: assignedDepartmentId,
          },
        },
        create: {
          userId: user.id,
          departmentId: assignedDepartmentId,
        },
        update: {},
      });
    }

    const result: {
      userId: string;
      email: string;
      name: string;
      role: 'doctor' | 'receptionist';
      hospitalId: string;
      departmentId?: string;
    } = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: body.role,
      hospitalId,
    };
    if (assignedDepartmentId) {
      result.departmentId = assignedDepartmentId;
    }
    return result;
  }

  // ─── C. Staff Deactivation ────────────────────────────────────────────────────

  @Patch('hospitals/:hospitalId/staff/:userId/status')
  async updateStaffStatus(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: StaffStatusBody,
  ) {
    const hospital = await this.hospitalScope(actor);
    const h = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...hospital },
      select: { id: true },
    });
    if (!h) {
      throw new NotFoundException('Hospital not found');
    }

    const isStaff = await this.isUserHospitalStaff(userId, hospitalId);
    if (!isStaff) {
      throw new ForbiddenException('User is not staff of this hospital');
    }

    return this.db.user.update({
      where: { id: userId },
      data: { status: body.status },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  // ─── D. List Hospital Staff ───────────────────────────────────────────────────

  @Get('hospitals/:hospitalId/staff')
  async listHospitalStaff(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    const hospital = await this.hospitalScope(actor);
    const h = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...hospital },
      select: { id: true },
    });
    if (!h) {
      throw new NotFoundException('Hospital not found');
    }

    const doctorQueues = await this.db.hospitalQueue.findMany({
      where: { doctorId: { not: null }, department: { hospitalId } },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            userRoles: {
              select: { role: { select: { slug: true } } },
            },
          },
        },
        department: { select: { id: true, name: true } },
      },
    });

    const receptionists = await this.db.receptionAssignment.findMany({
      where: { department: { hospitalId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            userRoles: {
              select: { role: { select: { slug: true } } },
            },
          },
        },
        department: { select: { id: true, name: true } },
      },
    });

    const admins = await this.db.hospitalAdminAssignment.findMany({
      where: { hospitalId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            userRoles: {
              select: { role: { select: { slug: true } } },
            },
          },
        },
      },
    });

    const staffMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        status: string;
        role: string;
        departmentAssignments: Array<{ departmentId: string; name: string }>;
      }
    >();

    const getPrimaryRole = (
      userRoles: Array<{ role: { slug: string } }>,
      fallback: string,
    ) => {
      const slugs = userRoles?.map((r) => r.role.slug) || [];
      if (slugs.includes('hospital_admin')) return 'hospital_admin';
      if (slugs.includes('doctor')) return 'doctor';
      if (slugs.includes('receptionist')) return 'receptionist';
      return slugs[0] ?? fallback;
    };

    for (const r of receptionists) {
      if (!r.user) continue;
      let entry = staffMap.get(r.user.id);
      if (!entry) {
        entry = {
          id: r.user.id,
          name: r.user.name,
          email: r.user.email,
          status: r.user.status,
          role: getPrimaryRole(r.user.userRoles, 'receptionist'),
          departmentAssignments: [],
        };
        staffMap.set(r.user.id, entry);
      }
      if (
        !entry.departmentAssignments.some(
          (d) => d.departmentId === r.department.id,
        )
      ) {
        entry.departmentAssignments.push({
          departmentId: r.department.id,
          name: r.department.name,
        });
      }
    }

    for (const q of doctorQueues) {
      if (!q.doctor) continue;
      let entry = staffMap.get(q.doctor.id);
      if (!entry) {
        entry = {
          id: q.doctor.id,
          name: q.doctor.name,
          email: q.doctor.email,
          status: q.doctor.status,
          role: getPrimaryRole(q.doctor.userRoles, 'doctor'),
          departmentAssignments: [],
        };
        staffMap.set(q.doctor.id, entry);
      }
      if (
        !entry.departmentAssignments.some(
          (d) => d.departmentId === q.department.id,
        )
      ) {
        entry.departmentAssignments.push({
          departmentId: q.department.id,
          name: q.department.name,
        });
      }
    }

    for (const a of admins) {
      if (!a.user) continue;
      let entry = staffMap.get(a.user.id);
      if (!entry) {
        entry = {
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          status: a.user.status,
          role: getPrimaryRole(a.user.userRoles, 'hospital_admin'),
          departmentAssignments: [],
        };
        staffMap.set(a.user.id, entry);
      }
    }

    return Array.from(staffMap.values());
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async createSupabaseUser(
    email: string,
  ): Promise<{ supabaseUid: string; email: string }> {
    const supabaseUrl =
      this.config?.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      'https://jxxfiligudvxqtzkzvzk.supabase.co';
    const serviceRoleKey =
      this.config?.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.config?.get<string>('SUPABASE_SECRET_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase service role key is not configured',
      );
    }

    const response = await fetch(
      new URL('/auth/v1/admin/users', supabaseUrl).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email,
          email_confirm: true,
          send_email: false,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (
      response.status === 422 ||
      response.status === 409 ||
      response.status === 400
    ) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const msg = (
        errorBody?.msg ||
        errorBody?.message ||
        errorBody?.error_description ||
        ''
      )
        .toString()
        .toLowerCase();
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        msg.includes('email')
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered',
        });
      }
      throw new BadRequestException(
        (errorBody?.msg as string) ||
          (errorBody?.message as string) ||
          `Failed to create user in Supabase (status ${response.status})`,
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new BadRequestException(
        `Failed to create user in Supabase: ${response.status} ${errText}`,
      );
    }

    const data = (await response.json()) as { id: string; email?: string };
    return { supabaseUid: data.id, email: data.email ?? email };
  }

  private async assignGlobalRole(userId: string, roleSlug: string) {
    const role = await this.db.role.findFirst({
      where: { slug: roleSlug, scope: 'GLOBAL' },
      select: { id: true },
    });
    if (!role) return;
    await this.db.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private async isUserHospitalStaff(
    userId: string,
    hospitalId: string,
  ): Promise<boolean> {
    const asDoctor = await this.db.hospitalQueue.findFirst({
      where: { doctorId: userId, department: { hospitalId } },
      select: { id: true },
    });
    if (asDoctor) return true;

    const asReceptionist = await this.db.receptionAssignment.findFirst({
      where: { userId, department: { hospitalId } },
      select: { userId: true },
    });
    if (asReceptionist) return true;

    const asAdmin = await this.db.hospitalAdminAssignment.findFirst({
      where: { userId, hospitalId },
      select: { userId: true },
    });
    if (asAdmin) return true;

    return false;
  }

  private assertAssignableRole(role: string): void {
    assertAssignableRole(role);
  }

  private async hospitalScope(actor: string) {
    const { roleSlugs } =
      await this.authLookup.getGlobalRolesAndPermissions(actor);
    if (roleSlugs.includes('super_admin')) return {};
    if (
      !(await this.db.hospitalAdminAssignment.findFirst({
        where: { userId: actor },
        select: { hospitalId: true },
      }))
    ) {
      throw new ForbiddenException('Hospital administration access required');
    }
    return { admins: { some: { userId: actor } } };
  }

  private async ensureActiveUser(id: string) {
    if (
      !(await this.db.user.findFirst({
        where: { id, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Active user not found');
    }
  }
}
