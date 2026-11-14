import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import {
  IsISO8601,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

class DateRange {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;
}

class Booking {
  @IsUUID()
  slotId!: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;
}

import { tokenView } from './hospital.controller.js';
import { randomUUID } from 'node:crypto';

class RegisterPatient {
  @IsUUID()
  hospitalId!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;
}

class UpdatePatientProfile {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @Matches(/^\+?[0-9][0-9 ().-]{5,22}$/)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string | null;
}

const patientProfile = {
  id: true,
  hospitalId: true,
  patientNumber: true,
  displayName: true,
  phone: true,
  gender: true,
  dateOfBirth: true,
} as const;

class PublishSlot {
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsISO8601({ strict: true })
  endsAt!: string;
}

const hospitalDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const queueDetails = {
  department: { select: { hospitalId: true, name: true } },
  doctor: { select: { name: true } },
} as const;
const slotDetails = { queue: { include: queueDetails } } as const;
const appointmentDetails = { slot: { include: slotDetails } } as const;

function slotView(
  slot: Prisma.AppointmentSlotGetPayload<{ include: typeof slotDetails }>,
) {
  return {
    id: slot.id,
    queueId: slot.queueId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    departmentName: slot.queue.department.name,
    doctorName: slot.queue.doctor?.name ?? null,
    roomLabel: slot.queue.roomLabel,
  };
}

function appointmentView(
  row: Prisma.AppointmentGetPayload<{ include: typeof appointmentDetails }>,
) {
  return {
    id: row.id,
    status: row.status,
    queueTokenId: row.queueTokenId,
    slot: slotView(row.slot),
  };
}

function dateRange(range: DateRange) {
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (
    !Number.isFinite(+from) ||
    !Number.isFinite(+to) ||
    +to <= +from ||
    +to - +from > 31 * 86_400_000
  ) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Choose a date range of at most 31 days',
    });
  }
  return { gte: from, lt: to };
}

const slotUnavailable = () =>
  new ConflictException({
    code: 'SLOT_UNAVAILABLE',
    message: 'The slot is no longer available',
  });

@Controller()
export class AppointmentsController {
  constructor(private readonly db: PrismaService) {}

  @Get('appointment-queues')
  async discover() {
    const queues = await this.db.hospitalQueue.findMany({
      where: { doctor: { is: { status: 'ACTIVE' } } },
      select: {
        id: true,
        name: true,
        roomLabel: true,
        doctor: { select: { name: true } },
        department: {
          select: {
            name: true,
            hospital: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return {
      items: queues.map(({ department, doctor, ...queue }) => ({
        ...queue,
        hospital: department.hospital,
        departmentName: department.name,
        doctorName: doctor?.name ?? null,
      })),
    };
  }

  @Get('users/me/patients')
  async patientProfiles(@CurrentUser('id') userId: string) {
    const items = await this.db.patient.findMany({
      where: { userId },
      select: {
        id: true,
        hospitalId: true,
        patientNumber: true,
        displayName: true,
      },
      orderBy: { id: 'asc' },
    });
    return { items };
  }

  @Patch('users/me/patients/:patientId')
  async updatePatient(
    @CurrentUser('id') userId: string,
    @Param('patientId', ParseUUIDPipe) id: string,
    @Body() body: UpdatePatientProfile,
  ) {
    const displayName = body.displayName?.trim();
    const dob = body.dateOfBirth;
    const dateOfBirth = dob
      ? new Date(dob + 'T00:00:00.000Z')
      : dob === null
        ? null
        : undefined;
    if (
      (body.displayName !== undefined && !displayName) ||
      (dateOfBirth &&
        (!Number.isFinite(+dateOfBirth) ||
          dateOfBirth.toISOString().slice(0, 10) !== dob ||
          +dateOfBirth > Date.now()))
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid name or date of birth',
      });
    }
    const [patient] = await this.db.patient.updateManyAndReturn({
      where: { id, userId },
      select: patientProfile,
      data: {
        displayName,
        phone: body.phone,
        gender: body.gender?.trim() ?? body.gender,
        dateOfBirth,
      },
    });
    if (!patient)
      throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient not found',
      });
    return patient;
  }

  @Get('staff/appointments')
  async receptionAppointments(
    @CurrentUser('id') userId: string,
    @Query() range: DateRange,
  ) {
    const scope = { receptionists: { some: { userId } } };
    if (
      !(await this.db.department.findFirst({
        where: scope,
        select: { id: true },
      }))
    ) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Reception assignment required',
      });
    }
    const rows = await this.db.appointment.findMany({
      where: {
        slot: { startsAt: dateRange(range), queue: { department: scope } },
      },
      include: {
        ...appointmentDetails,
        patient: {
          select: { id: true, patientNumber: true, displayName: true },
        },
      },
      orderBy: [{ slot: { startsAt: 'asc' } }, { id: 'asc' }],
    });
    return {
      items: rows.map((row) => ({
        ...appointmentView(row),
        patient: row.patient,
      })),
    };
  }

  @Post('patients/self')
  async registerPatient(
    @CurrentUser('id') userId: string,
    @Body() body: RegisterPatient,
  ) {
    const displayName = body.displayName.trim();
    if (!displayName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Display name is required',
      });
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
      if (
        !(await tx.hospital.findUnique({
          where: { id: body.hospitalId },
          select: { id: true },
        }))
      ) {
        throw new NotFoundException({
          code: 'HOSPITAL_NOT_FOUND',
          message: 'Hospital not found',
        });
      }
      const where = { userId, hospitalId: body.hospitalId };
      const select = {
        id: true,
        hospitalId: true,
        patientNumber: true,
        displayName: true,
      } as const;
      const existing = await tx.patient.findMany({
        where,
        select,
        take: 2,
        orderBy: { id: 'asc' },
      });
      if (existing.length > 1) {
        throw new ConflictException({
          code: 'PATIENT_NOT_AVAILABLE',
          message: 'Reception must resolve the matching patient records',
        });
      }
      return (
        existing[0] ??
        tx.patient.create({
          data: {
            ...where,
            displayName,
            patientNumber: 'UHID-' + randomUUID(),
          },
          select,
        })
      );
    });
  }

  @Post('queues/:queueId/appointment-slots')
  async publish(
    @CurrentUser('id') userId: string,
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Body() body: PublishSlot,
  ) {
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (
      ![body.startsAt, body.endsAt].every((value) =>
        /(?:Z|[+-]\d{2}:\d{2})$/i.test(value),
      ) ||
      !(startsAt > new Date()) ||
      !(endsAt > startsAt)
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Provide a future start and later end with time zone offsets',
      });
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
      const queue = await tx.hospitalQueue.findFirst({
        where: { id: queueId, doctorId: userId },
      });
      if (!queue) {
        throw new ForbiddenException({
          code: 'UNAUTHORIZED_QUEUE_ACCESS',
          message: 'Queue access denied',
        });
      }
      if (
        await tx.appointmentSlot.findFirst({
          where: {
            queue: { doctorId: userId },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        })
      ) {
        throw new ConflictException({
          code: 'APPOINTMENT_SLOT_OVERLAP',
          message: 'The doctor already has an overlapping slot',
        });
      }
      return slotView(
        await tx.appointmentSlot.create({
          data: { queueId, startsAt, endsAt },
          include: slotDetails,
        }),
      );
    });
  }

  @Post('appointments/:appointmentId/check-in')
  @HttpCode(200)
  async checkIn(
    @CurrentUser('id') userId: string,
    @Param('appointmentId', ParseUUIDPipe) id: string,
  ) {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${id}::uuid FOR UPDATE`;
        const appointment = await tx.appointment.findFirst({
          where: {
            id,
            slot: {
              queue: { department: { receptionists: { some: { userId } } } },
            },
          },
          include: { slot: true, queueToken: true },
        });
        if (!appointment) {
          throw new NotFoundException({
            code: 'APPOINTMENT_NOT_FOUND',
            message: 'Appointment not found',
          });
        }
        if (appointment.queueToken) return tokenView(appointment.queueToken);
        if (
          appointment.status !== 'BOOKED' ||
          hospitalDay.format(appointment.slot.startsAt) !==
            hospitalDay.format(new Date())
        ) {
          throw new ConflictException({
            code: 'INVALID_APPOINTMENT_TRANSITION',
            message: 'Check-in requires a booking for today',
          });
        }
        await tx.$queryRaw`SELECT id FROM "HospitalQueue" WHERE id = ${appointment.slot.queueId}::uuid FOR UPDATE`;
        const token = await tx.queueToken.create({
          data: {
            patientId: appointment.patientId,
            queueId: appointment.slot.queueId,
          },
        });
        await tx.appointment.update({
          where: { id },
          data: { status: 'CHECKED_IN', queueTokenId: token.id },
        });
        await tx.hospitalQueue.update({
          where: { id: token.queueId },
          data: { updatedAt: new Date() },
        });
        const queue = await tx.hospitalQueue.findUniqueOrThrow({
          where: { id: token.queueId },
          select: { departmentId: true },
        });
        await tx.hospitalActivity.create({
          data: {
            departmentId: queue.departmentId,
            actorId: userId,
            action: 'APPOINTMENT_CHECKED_IN',
            appointmentId: id,
            tokenId: token.id,
          },
        });
        return tokenView(token);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_WALK_IN',
          message: 'Patient already has an active token in this queue',
        });
      }
      throw error;
    }
  }

  @Get('queues/:queueId/appointment-slots')
  async available(
    @CurrentUser('id') userId: string,
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Query() range: DateRange,
  ) {
    const startsAt = dateRange(range);
    const items = await this.db.appointmentSlot.findMany({
      where: {
        queueId,
        startsAt: { ...startsAt, gt: new Date() },
        queue: {
          OR: [
            { doctorId: userId },
            { department: { receptionists: { some: { userId } } } },
            { department: { hospital: { patients: { some: { userId } } } } },
          ],
        },
        appointments: { none: { status: { in: ['BOOKED', 'CHECKED_IN'] } } },
      },
      include: slotDetails,
      orderBy: { startsAt: 'asc' },
    });
    return { items: items.map(slotView) };
  }

  @Post('appointments')
  async book(@CurrentUser('id') userId: string, @Body() body: Booking) {
    try {
      return await this.db.$transaction(async (tx) => {
        const slot = await tx.appointmentSlot.findUnique({
          where: { id: body.slotId },
          include: slotDetails,
        });
        if (!slot || slot.startsAt <= new Date()) throw slotUnavailable();

        const patients = await tx.patient.findMany({
          where: {
            hospitalId: slot.queue.department.hospitalId,
            ...(body.patientId
              ? {
                  id: body.patientId,
                  hospital: {
                    departments: {
                      some: {
                        id: slot.queue.departmentId,
                        receptionists: { some: { userId } },
                      },
                    },
                  },
                }
              : { userId }),
          },
          select: { id: true },
          take: 2,
        });
        if (patients.length !== 1) {
          throw new BadRequestException({
            code: 'PATIENT_NOT_AVAILABLE',
            message: 'A single accessible patient record is required',
          });
        }
        const patientId = patients[0].id;
        await tx.$queryRaw`SELECT id FROM "Patient" WHERE id = ${patientId}::uuid FOR UPDATE`;
        if (
          await tx.appointment.findFirst({
            where: {
              patientId,
              status: { in: ['BOOKED', 'CHECKED_IN'] },
              slotId: { not: slot.id },
              slot: {
                startsAt: { lt: slot.endsAt },
                endsAt: { gt: slot.startsAt },
              },
            },
          })
        ) {
          throw new ConflictException({
            code: 'PATIENT_APPOINTMENT_OVERLAP',
            message: 'Patient already has an overlapping appointment',
          });
        }
        const created = await tx.appointment.create({
          data: { slotId: slot.id, patientId: patients[0].id },
          include: appointmentDetails,
        });
        await tx.hospitalActivity.create({
          data: {
            departmentId: slot.queue.departmentId,
            actorId: userId,
            action: 'APPOINTMENT_BOOKED',
            appointmentId: created.id,
            source: body.patientId ? 'RECEPTION' : 'ONLINE',
          },
        });
        return appointmentView(created);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw slotUnavailable();
      }
      throw error;
    }
  }

  @Get('users/me/appointments')
  async list(@CurrentUser('id') userId: string, @Query() range: DateRange) {
    const items = await this.db.appointment.findMany({
      where: {
        slot: { startsAt: dateRange(range) },
        OR: [
          { patient: { userId } },
          { slot: { queue: { doctorId: userId } } },
        ],
      },
      include: appointmentDetails,
      orderBy: { slot: { startsAt: 'asc' } },
    });
    return { items: items.map(appointmentView) };
  }

  @Post('appointments/:appointmentId/cancel')
  @HttpCode(200)
  async cancel(
    @CurrentUser('id') userId: string,
    @Param('appointmentId', ParseUUIDPipe) id: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const scope: Prisma.AppointmentWhereInput = {
        id,
        OR: [
          { patient: { userId } },
          {
            slot: {
              queue: { department: { receptionists: { some: { userId } } } },
            },
          },
        ],
      };
      const updated = await tx.appointment.updateMany({
        where: {
          ...scope,
          status: 'BOOKED',
          slot: { startsAt: { gt: new Date() } },
        },
        data: { status: 'CANCELLED' },
      });
      const appointment = await tx.appointment.findFirst({
        where: scope,
        include: appointmentDetails,
      });
      if (!appointment) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Appointment not found',
        });
      }
      if (!updated.count && appointment.status !== 'CANCELLED') {
        throw new ConflictException({
          code: 'INVALID_APPOINTMENT_TRANSITION',
          message: 'Only a future booking can be cancelled',
        });
      }
      if (updated.count)
        await tx.hospitalActivity.create({
          data: {
            departmentId: appointment.slot.queue.departmentId,
            actorId: userId,
            action: 'APPOINTMENT_CANCELLED',
            appointmentId: id,
          },
        });
      return appointmentView(appointment);
    });
  }
}
