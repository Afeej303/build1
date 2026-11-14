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
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
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

  @IsIn(['doctor', 'receptionist'])
  role!: 'doctor' | 'receptionist';

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

class StaffStatusBody {
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
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

  // ─── A. Hospital-level activity audit log ──────────────────────────────────

  @Get('hospitals/:hospitalId/activity')
  async hospitalActivity(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    const { start, end } = this.parseReportDate(date);
    const hospital = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      select: { id: true, departments: { select: { id: true, name: true } } },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    const departmentIds = hospital.departments.map((d) => d.id);
    const deptNameMap = new Map(
      hospital.departments.map((d) => [d.id, d.name]),
    );

    const activities = await this.db.hospitalActivity.findMany({
      where: {
        departmentId: { in: departmentIds },
        createdAt: { gte: start, lt: end },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });

    return {
      items: activities.map((a) => ({
        id: a.id,
        departmentId: a.departmentId,
        departmentName: deptNameMap.get(a.departmentId) ?? null,
        actorId: a.actorId,
        action: a.action,
        tokenId: a.tokenId,
        appointmentId: a.appointmentId,
        reason: a.reason,
        createdAt: a.createdAt,
      })),
    };
  }

  // ─── B. Doctor activity stats ─────────────────────────────────────────────

  @Get('hospitals/:hospitalId/stats/doctors')
  async doctorStats(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    const { start, end } = this.parseReportDate(date);
    const hospital = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      select: { id: true },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    const queues = await this.db.hospitalQueue.findMany({
      where: {
        department: { hospitalId },
        doctorId: { not: null },
      },
      select: {
        id: true,
        name: true,
        doctorId: true,
        doctor: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    const tokens = await this.db.queueToken.findMany({
      where: {
        queue: { department: { hospitalId } },
        issuedAt: { gte: start, lt: end },
        status: { in: ['COMPLETED', 'SKIPPED', 'MISSED'] },
      },
      select: {
        queueId: true,
        status: true,
        calledAt: true,
        completedAt: true,
      },
    });

    const queueMap = new Map(queues.map((q) => [q.id, q]));
    const statsMap = new Map<
      string,
      {
        doctorId: string;
        doctorName: string;
        queueId: string;
        queueName: string;
        completed: number;
        skipped: number;
        missed: number;
        consultationMinutes: number[];
      }
    >();

    for (const queue of queues) {
      if (queue.doctorId && queue.doctor) {
        statsMap.set(queue.id, {
          doctorId: queue.doctorId,
          doctorName: queue.doctor.name,
          queueId: queue.id,
          queueName: queue.name,
          completed: 0,
          skipped: 0,
          missed: 0,
          consultationMinutes: [],
        });
      }
    }

    for (const token of tokens) {
      let entry = statsMap.get(token.queueId);
      if (!entry) {
        const queue = queueMap.get(token.queueId);
        if (!queue || !queue.doctorId || !queue.doctor) continue;
        entry = {
          doctorId: queue.doctorId,
          doctorName: queue.doctor.name,
          queueId: queue.id,
          queueName: queue.name,
          completed: 0,
          skipped: 0,
          missed: 0,
          consultationMinutes: [],
        };
        statsMap.set(token.queueId, entry);
      }

      if (token.status === 'COMPLETED') {
        entry.completed += 1;
        if (token.calledAt && token.completedAt) {
          const mins = (+token.completedAt - +token.calledAt) / 60_000;
          if (mins >= 0) entry.consultationMinutes.push(mins);
        }
      } else if (token.status === 'SKIPPED') {
        entry.skipped += 1;
      } else if (token.status === 'MISSED') {
        entry.missed += 1;
      }
    }

    const items = Array.from(statsMap.values()).map((entry) => ({
      doctorId: entry.doctorId,
      doctorName: entry.doctorName,
      queueId: entry.queueId,
      queueName: entry.queueName,
      completed: entry.completed,
      skipped: entry.skipped,
      missed: entry.missed,
      avgConsultationMinutes:
        entry.consultationMinutes.length > 0
          ? Math.round(
              entry.consultationMinutes.reduce((a, b) => a + b, 0) /
                entry.consultationMinutes.length,
            )
          : null,
    }));

    return { items };
  }

  // ─── C. Receptionist activity stats ─────────────────────────────────────

  @Get('hospitals/:hospitalId/stats/receptionists')
  async receptionistStats(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    const { start, end } = this.parseReportDate(date);
    const hospital = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      select: { id: true, departments: { select: { id: true, name: true } } },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    const departmentIds = hospital.departments.map((d) => d.id);
    const deptNameMap = new Map(
      hospital.departments.map((d) => [d.id, d.name]),
    );

    const RECEPTIONIST_ACTIONS = [
      'WALK_IN_ISSUED',
      'APPOINTMENT_CHECKED_IN',
      'WALK_IN_PATIENT_REGISTERED',
    ];

    const activities = await this.db.hospitalActivity.findMany({
      where: {
        departmentId: { in: departmentIds },
        createdAt: { gte: start, lt: end },
        action: { in: RECEPTIONIST_ACTIONS },
      },
    });

    const statsMap = new Map<
      string,
      {
        userId: string;
        departmentId: string;
        walkInsIssued: number;
        checkins: number;
        patientsRegistered: number;
      }
    >();

    for (const a of activities) {
      const key = `${a.actorId}::${a.departmentId}`;
      let entry = statsMap.get(key);
      if (!entry) {
        entry = {
          userId: a.actorId,
          departmentId: a.departmentId,
          walkInsIssued: 0,
          checkins: 0,
          patientsRegistered: 0,
        };
        statsMap.set(key, entry);
      }
      if (a.action === 'WALK_IN_ISSUED') entry.walkInsIssued += 1;
      else if (a.action === 'APPOINTMENT_CHECKED_IN') entry.checkins += 1;
      else if (a.action === 'WALK_IN_PATIENT_REGISTERED')
        entry.patientsRegistered += 1;
    }

    const actorIds = [...new Set(activities.map((a) => a.actorId))];
    const users =
      actorIds.length > 0
        ? await this.db.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true },
          })
        : [];
    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    const items = Array.from(statsMap.values()).map((entry) => ({
      userId: entry.userId,
      userName: userNameMap.get(entry.userId) ?? null,
      departmentId: entry.departmentId,
      departmentName: deptNameMap.get(entry.departmentId) ?? null,
      walkInsIssued: entry.walkInsIssued,
      checkins: entry.checkins,
      patientsRegistered: entry.patientsRegistered,
    }));

    return { items };
  }

  // ─── D. Super Admin platform-wide stats ──────────────────────────────────

  @Roles('super_admin')
  @Get('stats')
  async platformStats() {
    const [
      totalHospitals,
      totalDepartments,
      totalQueues,
      totalUsers,
      totalPatients,
      activeSessions,
    ] = await this.db.$transaction([
      this.db.hospital.count(),
      this.db.department.count(),
      this.db.hospitalQueue.count(),
      this.db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.db.patient.count(),
      this.db.session.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);

    return {
      totalHospitals,
      totalDepartments,
      totalQueues,
      totalUsers,
      totalPatients,
      activeSessions,
    };
  }

  // ─── E. Appointment stats per hospital ───────────────────────────────────

  @Get('hospitals/:hospitalId/stats/appointments')
  async appointmentStats(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Query('date') date: string,
  ) {
    const { start, end } = this.parseReportDate(date);
    const hospital = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      select: { id: true, departments: { select: { id: true } } },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    const departmentIds = hospital.departments.map((d) => d.id);

    const activities = await this.db.hospitalActivity.findMany({
      where: {
        departmentId: { in: departmentIds },
        createdAt: { gte: start, lt: end },
        action: {
          in: [
            'APPOINTMENT_BOOKED',
            'APPOINTMENT_CHECKED_IN',
            'APPOINTMENT_CANCELLED',
            'APPOINTMENT_RESCHEDULED',
          ],
        },
      },
      select: { action: true },
    });

    if (activities.length > 0) {
      let booked = 0;
      let checkedIn = 0;
      let cancelled = 0;
      let rescheduled = 0;
      for (const a of activities) {
        if (a.action === 'APPOINTMENT_BOOKED') booked++;
        else if (a.action === 'APPOINTMENT_CHECKED_IN') checkedIn++;
        else if (a.action === 'APPOINTMENT_CANCELLED') cancelled++;
        else if (a.action === 'APPOINTMENT_RESCHEDULED') rescheduled++;
      }
      return { booked, checkedIn, cancelled, rescheduled };
    }

    const [booked, checkedIn, cancelled] = await this.db.$transaction([
      this.db.appointment.count({
        where: {
          status: 'BOOKED',
          slot: {
            startsAt: { gte: start, lt: end },
            queue: { department: { hospitalId } },
          },
        },
      }),
      this.db.appointment.count({
        where: {
          status: 'CHECKED_IN',
          slot: {
            startsAt: { gte: start, lt: end },
            queue: { department: { hospitalId } },
          },
        },
      }),
      this.db.appointment.count({
        where: {
          status: 'CANCELLED',
          slot: {
            startsAt: { gte: start, lt: end },
            queue: { department: { hospitalId } },
          },
        },
      }),
    ]);

    return {
      booked,
      checkedIn,
      cancelled,
      rescheduled: 0,
    };
  }

  // ─── Existing hospital management endpoints ───────────────────────────────

  private async dailyReport(actor: string, hospitalId: string, date: string) {
    const { start, end } = this.parseReportDate(date);
    const hospital = await this.db.hospital.findFirst({
      where: { id: hospitalId, ...(await this.hospitalScope(actor)) },
      select: { id: true, departments: { select: { id: true, name: true } } },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');
    const tokens = await this.db.queueToken.findMany({
      where: {
        queue: { department: { hospitalId } },
        issuedAt: { gte: start, lt: end },
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
    const hospital = await this.hospitalScope(actor);
    if (
      !(await this.db.department.findFirst({
        where: { id: departmentId, hospital },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Department not found');
    }
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

  // ─── Staff Provisioning Endpoints ─────────────────────────────────────────

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

    const { supabaseUid, email } = await this.createSupabaseUser(
      body.email.trim().toLowerCase(),
    );

    const name = body.name.trim() || email.split('@')[0];
    const supabaseUrl = this.config?.getOrThrow<string>('SUPABASE_URL') ?? '';
    const supabaseIdentity = `${new URL(supabaseUrl).origin}/auth/v1|${supabaseUid.toLowerCase()}`;

    const user = await this.db.user.upsert({
      where: { supabaseIdentity },
      create: { supabaseIdentity, email, name },
      update: { email, name },
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

  @Post('hospitals/:hospitalId/staff')
  async provisionStaff(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Body() body: ProvisionStaffBody,
  ) {
    const scope = await this.hospitalScope(actor);
    if (
      !(await this.db.hospital.findFirst({
        where: { id: hospitalId, ...scope },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Hospital not found');
    }

    this.assertAssignableRole(body.role);

    const { supabaseUid, email } = await this.createSupabaseUser(
      body.email.trim().toLowerCase(),
    );

    const name = body.name.trim() || email.split('@')[0];
    const supabaseUrl = this.config?.getOrThrow<string>('SUPABASE_URL') ?? '';
    const supabaseIdentity = `${new URL(supabaseUrl).origin}/auth/v1|${supabaseUid.toLowerCase()}`;

    const user = await this.db.user.upsert({
      where: { supabaseIdentity },
      create: { supabaseIdentity, email, name },
      update: { email, name },
    });

    await this.assignGlobalRole(user.id, body.role);

    let assignedDepartmentId: string | undefined;
    if (body.role === 'receptionist' && body.departmentId) {
      const dept = await this.db.department.findFirst({
        where: { id: body.departmentId, hospitalId },
        select: { id: true },
      });
      if (!dept)
        throw new NotFoundException('Department not found in this hospital');

      await this.db.receptionAssignment.upsert({
        where: {
          userId_departmentId: {
            userId: user.id,
            departmentId: body.departmentId,
          },
        },
        create: { userId: user.id, departmentId: body.departmentId },
        update: {},
      });
      assignedDepartmentId = body.departmentId;
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: body.role,
      hospitalId,
      ...(assignedDepartmentId ? { departmentId: assignedDepartmentId } : {}),
    };
  }

  @Patch('hospitals/:hospitalId/staff/:userId/status')
  async updateStaffStatus(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: StaffStatusBody,
  ) {
    const scope = await this.hospitalScope(actor);
    if (
      !(await this.db.hospital.findFirst({
        where: { id: hospitalId, ...scope },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Hospital not found');
    }

    const isHospitalStaff = await this.isUserHospitalStaff(userId, hospitalId);
    if (!isHospitalStaff) {
      throw new ForbiddenException('User is not staff of this hospital');
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { status: body.status },
      select: { id: true, email: true, name: true, status: true },
    });

    return updated;
  }

  @Get('hospitals/:hospitalId/staff')
  async listHospitalStaff(
    @CurrentUser('id') actor: string,
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
  ) {
    const scope = await this.hospitalScope(actor);
    if (
      !(await this.db.hospital.findFirst({
        where: { id: hospitalId, ...scope },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Hospital not found');
    }

    const doctorQueues = await this.db.hospitalQueue.findMany({
      where: { doctorId: { not: null }, department: { hospitalId } },
      select: {
        doctorId: true,
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
      },
    });

    const receptionists = await this.db.receptionAssignment.findMany({
      where: { department: { hospitalId } },
      select: {
        departmentId: true,
        department: { select: { id: true, name: true } },
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

    const adminAssignments = await this.db.hospitalAdminAssignment.findMany({
      where: { hospitalId },
      select: {
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
        departmentAssignments: { departmentId: string; name: string }[];
      }
    >();

    const addOrMerge = (
      u: {
        id: string;
        name: string;
        email: string;
        status: string;
        userRoles: { role: { slug: string } }[];
      },
      role: string,
      dept?: { id: string; name: string },
    ) => {
      if (!staffMap.has(u.id)) {
        staffMap.set(u.id, {
          id: u.id,
          name: u.name,
          email: u.email,
          status: u.status,
          role: u.userRoles[0]?.role?.slug ?? role,
          departmentAssignments: dept
            ? [{ departmentId: dept.id, name: dept.name }]
            : [],
        });
      } else if (dept) {
        staffMap
          .get(u.id)!
          .departmentAssignments.push({
            departmentId: dept.id,
            name: dept.name,
          });
      }
    };

    for (const q of doctorQueues) {
      if (q.doctor) addOrMerge(q.doctor, 'doctor');
    }
    for (const r of receptionists) {
      addOrMerge(r.user, 'receptionist', {
        id: r.department.id,
        name: r.department.name,
      });
    }
    for (const a of adminAssignments) {
      addOrMerge(a.user, 'hospital_admin');
    }

    return Array.from(staffMap.values());
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseReportDate(date: string): { start: Date; end: Date } {
    const start = new Date(date + 'T00:00:00+05:30');
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(+start) ||
      new Date(+start + 19_800_000).toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('Use a valid YYYY-MM-DD report date');
    }
    return { start, end: new Date(+start + 86_400_000) };
  }

  private async createSupabaseUser(
    email: string,
  ): Promise<{ supabaseUid: string; email: string }> {
    if (!this.config) {
      throw new ConflictException('ConfigService not available');
    }
    const supabaseUrl =
      this.config.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      'https://jxxfiligudvxqtzkzvzk.supabase.co';
    const serviceRoleKey =
      this.config.get<string>('SUPABASE_SECRET_KEY') ||
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new ConflictException('Supabase service role key not configured');
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

    if (response.status === 422) {
      const body = (await response.json()) as { message?: string };
      if (
        body?.message?.toLowerCase().includes('already been registered') ||
        body?.message?.toLowerCase().includes('already exists') ||
        body?.message?.toLowerCase().includes('email address')
      ) {
        throw new ConflictException({
          message: 'Email is already registered',
          code: 'EMAIL_ALREADY_REGISTERED',
        });
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new ConflictException(
        `Supabase user creation failed: ${response.status} ${errText}`,
      );
    }

    const data = (await response.json()) as { id: string; email: string };
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
