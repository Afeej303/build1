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
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthorizationLookupService } from '../common/services/authorization-lookup.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Roles a hospital_admin may never assign. */
export const HOSPITAL_ADMIN_FORBIDDEN_ROLES = ['super_admin', 'hospital_admin'] as const;

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
    // Task A: validate department belongs to actor's hospital
    const hospital = await this.hospitalScope(actor);
    if (
      !(await this.db.department.findFirst({
        where: { id: departmentId, hospital },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Department not found');
    }
    // Task B: enforce per-department receptionist limit
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

  // Task C: list receptionists for a department (scoped to actor's hospital)
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

  // Task E: list all queues for a hospital (admin view, scoped)
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
