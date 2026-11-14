import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsString, IsUUID, MaxLength } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

const queueContext = {
  department: true,
  doctor: { select: { name: true } },
} as const;
const waitingOrder = [
  { issuedAt: 'asc' },
  { sequence: 'asc' },
] satisfies Prisma.QueueTokenOrderByWithRelationInput[];
type Token = Prisma.QueueTokenGetPayload<object>;
type Queue = Prisma.HospitalQueueGetPayload<{ include: typeof queueContext }>;

class RegisterWalkInPatient {
  @IsUUID()
  queueId!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;
}

class IssueWalkIn {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  queueId!: string;
}

export function tokenView(token: Token) {
  return {
    id: token.id,
    queueId: token.queueId,
    displayNumber: token.sequence.toString(),
    status: token.status,
    issuedAt: token.issuedAt,
  };
}

function queueLabels(queue: Queue) {
  return {
    departmentName: queue.department.name,
    doctorName: queue.doctor?.name ?? null,
    roomLabel: queue.roomLabel,
  };
}

function tokenMissing() {
  return new NotFoundException({
    code: 'TOKEN_NOT_FOUND',
    message: 'Token not found',
  });
}

@Controller()
export class HospitalController {
  constructor(private readonly db: PrismaService) {}

  @Get('staff/queues')
  async queues(
    @CurrentUser('id') actor: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const queues = await this.db.hospitalQueue.findMany({
      where: {
        ...this.staffScope(actor),
        ...(departmentId ? { departmentId } : {}),
      },
      include: queueContext,
      orderBy: { name: 'asc' },
    });
    return {
      items: queues.map((queue) => ({
        id: queue.id,
        name: queue.name,
        department: { id: queue.departmentId, name: queue.department.name },
        doctor:
          queue.doctorId && queue.doctor
            ? { id: queue.doctorId, name: queue.doctor.name }
            : null,
        roomLabel: queue.roomLabel,
        publicQueueId: queue.publicQueueId,
        acceptingWalkIns: queue.acceptingWalkIns,
      })),
    };
  }

  @Get('staff/patients/lookup')
  async lookup(
    @CurrentUser('id') actor: string,
    @Query('patientNumber') number?: string,
  ) {
    if (typeof number !== 'string' || !number.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'UHID is required',
      });
    }
    const hospitals = await this.db.hospital.findMany({
      where: {
        departments: { some: { receptionists: { some: { userId: actor } } } },
      },
      select: { id: true },
    });
    if (!hospitals.length) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Reception assignment required',
      });
    }
    const patients = await this.db.patient.findMany({
      where: {
        patientNumber: number.trim(),
        hospitalId: { in: hospitals.map((hospital) => hospital.id) },
      },
      select: { id: true, patientNumber: true, displayName: true },
      take: 2,
    });
    if (patients.length !== 1) {
      throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'No unique accessible patient matches this UHID',
      });
    }
    return { items: patients };
  }

  @Post('staff/patients')
  async registerWalkInPatient(
    @CurrentUser('id') actor: string,
    @Body() body: RegisterWalkInPatient,
  ) {
    const displayName = body.displayName.trim();
    if (!displayName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Display name is required',
      });
    }
    return this.db.$transaction(async (tx) => {
      const queue = await tx.hospitalQueue.findFirst({
        where: {
          id: body.queueId,
          department: { receptionists: { some: { userId: actor } } },
        },
        select: {
          departmentId: true,
          department: { select: { hospitalId: true } },
        },
      });
      if (!queue) this.denyQueue();

      const patient = await tx.patient.create({
        data: {
          hospitalId: queue.department.hospitalId,
          displayName,
          patientNumber: 'UHID-' + randomUUID(),
        },
        select: {
          id: true,
          hospitalId: true,
          patientNumber: true,
          displayName: true,
        },
      });
      await tx.hospitalActivity.create({
        data: {
          departmentId: queue.departmentId,
          actorId: actor,
          action: 'WALK_IN_PATIENT_REGISTERED',
        },
      });
      return patient;
    });
  }

  @Get('staff/audit-log')
  async receptionAudit(@CurrentUser('id') actor: string) {
    const departments = await this.db.receptionAssignment.findMany({
      where: { userId: actor },
      select: { departmentId: true },
    });
    if (!departments.length) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Reception assignment required',
      });
    }
    const items = await this.db.hospitalActivity.findMany({
      where: {
        departmentId: {
          in: departments.map(({ departmentId }) => departmentId),
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return { items };
  }

  @Post('walk-ins')
  async issue(@CurrentUser('id') actor: string, @Body() body: IssueWalkIn) {
    try {
      return await this.db.$transaction(async (tx) => {
        const queue = await this.lockQueue(tx, body.queueId);
        const assigned = await tx.receptionAssignment.findUnique({
          where: {
            userId_departmentId: {
              userId: actor,
              departmentId: queue.departmentId,
            },
          },
        });
        if (!assigned) this.denyQueue();
        if (!queue.acceptingWalkIns) {
          throw new ConflictException({
            code: 'QUEUE_NOT_AVAILABLE',
            message: 'Queue is closed to walk-ins',
          });
        }
        const patient = await tx.patient.findFirst({
          where: {
            id: body.patientId,
            hospitalId: queue.department.hospitalId,
          },
        });
        if (!patient) {
          throw new NotFoundException({
            code: 'PATIENT_NOT_FOUND',
            message: 'Patient not found',
          });
        }
        const token = await tx.queueToken.create({
          data: { patientId: patient.id, queueId: queue.id },
        });
        await tx.hospitalQueue.update({
          where: { id: queue.id },
          data: { updatedAt: new Date() },
        });
        await tx.hospitalActivity.create({
          data: {
            departmentId: queue.departmentId,
            actorId: actor,
            action: 'WALK_IN_ISSUED',
            tokenId: token.id,
          },
        });
        return {
          ...tokenView(token),
          slip: {
            departmentName: queue.department.name,
            roomLabel: queue.roomLabel,
            publicQueueId: queue.publicQueueId,
          },
        };
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

  @Get('queues/:queueId/dashboard')
  async dashboard(
    @CurrentUser('id') actor: string,
    @Param('queueId', ParseUUIDPipe) queueId: string,
  ) {
    const queue = await this.db.hospitalQueue.findFirst({
      where: { id: queueId, ...this.staffScope(actor) },
      include: queueContext,
    });
    if (!queue) this.denyQueue();
    const tokens = await this.db.queueToken.findMany({
      where: { queueId, status: { in: ['WAITING', 'CALLED'] } },
      include: {
        patient: {
          select: { id: true, patientNumber: true, displayName: true },
        },
      },
      orderBy: waitingOrder,
    });
    const active = tokens.find((token) => token.status === 'CALLED');
    return {
      queueId,
      department: { id: queue.departmentId, name: queue.department.name },
      roomLabel: queue.roomLabel,
      activeToken: active
        ? {
            ...tokenView(active),
            priority: 'STANDARD',
            calledAt: active.calledAt,
            ...(queue.doctorId === actor ? { patient: active.patient } : {}),
          }
        : null,
      waitingTokens: tokens
        .filter((token) => token.status === 'WAITING')
        .map((token) => ({
          ...tokenView(token),
          priority: 'STANDARD',
        })),
      updatedAt: queue.updatedAt,
    };
  }

  @Post('queues/:queueId/call-next')
  @HttpCode(200)
  async callNext(
    @CurrentUser('id') actor: string,
    @Param('queueId', ParseUUIDPipe) queueId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const queue = await this.lockQueue(tx, queueId);
      if (queue.doctorId !== actor) this.denyQueue();
      if (
        await tx.queueToken.findFirst({ where: { queueId, status: 'CALLED' } })
      ) {
        throw new ConflictException({
          code: 'CONSULTATION_ALREADY_ACTIVE',
          message: 'A consultation is active',
        });
      }
      const next = await tx.queueToken.findFirst({
        where: { queueId, status: 'WAITING' },
        orderBy: waitingOrder,
      });
      if (!next) {
        throw new ConflictException({
          code: 'NO_ELIGIBLE_TOKENS',
          message: 'No eligible token is waiting',
        });
      }
      const token = await tx.queueToken.update({
        where: { id: next.id },
        data: { status: 'CALLED', calledAt: new Date() },
      });
      await tx.hospitalQueue.update({
        where: { id: queue.id },
        data: { updatedAt: new Date() },
      });
      await this.recordTokenActivity(
        tx,
        queue.departmentId,
        actor,
        token.id,
        'DOCTOR_CALLED_NEXT',
      );
      return { ...tokenView(token), calledAt: token.calledAt };
    });
  }

  @Post('queue-tokens/:tokenId/complete')
  @HttpCode(200)
  async complete(
    @CurrentUser('id') actor: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ) {
    return this.transitionCalledToken(
      actor,
      tokenId,
      'COMPLETED',
      'CONSULTATION_COMPLETED',
    );
  }

  @Post('queue-tokens/:tokenId/skip')
  @HttpCode(200)
  skip(
    @CurrentUser('id') actor: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ) {
    return this.transitionCalledToken(
      actor,
      tokenId,
      'SKIPPED',
      'TOKEN_SKIPPED',
    );
  }

  @Post('queue-tokens/:tokenId/missed')
  @HttpCode(200)
  missed(
    @CurrentUser('id') actor: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ) {
    return this.transitionCalledToken(
      actor,
      tokenId,
      'MISSED',
      'TOKEN_MARKED_MISSED',
    );
  }

  private async transitionCalledToken(
    actor: string,
    tokenId: string,
    status: 'COMPLETED' | 'SKIPPED' | 'MISSED',
    action: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const token = await tx.queueToken.findUnique({ where: { id: tokenId } });
      if (!token) throw tokenMissing();
      const queue = await this.lockQueue(tx, token.queueId);
      if (queue.doctorId !== actor) this.denyQueue();
      const changed = await tx.queueToken.updateMany({
        where: { id: tokenId, status: 'CALLED' },
        data: { status },
      });
      if (!changed.count) {
        throw new ConflictException({
          code: 'INVALID_STATE_TRANSITION',
          message: 'Only a called token can be transitioned',
        });
      }
      await tx.hospitalQueue.update({
        where: { id: queue.id },
        data: { updatedAt: new Date() },
      });
      await this.recordTokenActivity(
        tx,
        queue.departmentId,
        actor,
        tokenId,
        action,
      );
      return tokenView(
        await tx.queueToken.findUniqueOrThrow({ where: { id: tokenId } }),
      );
    });
  }

  @Get('users/me/queue-tokens')
  async active(
    @CurrentUser('id') actor: string,
    @Query('status') status?: string,
  ) {
    if (status !== undefined && status !== 'active') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Expected status=active',
      });
    }
    const tokens = await this.db.queueToken.findMany({
      where: {
        patient: { userId: actor },
        status: { in: ['WAITING', 'CALLED'] },
      },
      include: { queue: { include: queueContext } },
      orderBy: waitingOrder,
    });
    return {
      items: await Promise.all(
        tokens.map((token) => this.patientView(token, token.queue)),
      ),
    };
  }

  @Get('queue-tokens/:tokenId')
  async patientToken(
    @CurrentUser('id') actor: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ) {
    const token = await this.db.queueToken.findFirst({
      where: { id: tokenId, patient: { userId: actor } },
      include: { queue: { include: queueContext } },
    });
    if (!token) throw tokenMissing();
    return this.patientView(token, token.queue);
  }

  @Public()
  @Get('public/queues/:publicQueueId')
  async publicBoard(@Param('publicQueueId') publicQueueId: string) {
    const queue = await this.db.hospitalQueue.findUnique({
      where: { publicQueueId },
      include: queueContext,
    });
    if (!queue)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Queue not found',
      });
    const [active, waitingCount] = await this.db.$transaction(
      [
        this.db.queueToken.findFirst({
          where: { queueId: queue.id, status: 'CALLED' },
          select: { sequence: true },
        }),
        this.db.queueToken.count({
          where: { queueId: queue.id, status: 'WAITING' },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      publicQueueId,
      departmentName: queue.department.name,
      roomLabel: queue.roomLabel,
      currentDisplayNumber: active?.sequence.toString() ?? null,
      waitingCount,
      estimatedWaitMinutes: null,
      updatedAt: queue.updatedAt,
    };
  }

  private async recordTokenActivity(
    tx: Prisma.TransactionClient,
    departmentId: string,
    actorId: string,
    tokenId: string,
    action: string,
  ) {
    const appointment = await tx.appointment.findUnique({
      where: { queueTokenId: tokenId },
      select: { id: true },
    });
    await tx.hospitalActivity.create({
      data: {
        departmentId,
        actorId,
        tokenId,
        action,
        appointmentId: appointment?.id,
      },
    });
  }

  private async patientView(token: Token, queue: Queue) {
    const patientsAhead =
      token.status === 'WAITING'
        ? await this.db.queueToken.count({
            where: {
              queueId: queue.id,
              OR: [
                { status: 'CALLED' },
                { status: 'WAITING', issuedAt: { lt: token.issuedAt } },
                {
                  status: 'WAITING',
                  issuedAt: token.issuedAt,
                  sequence: { lt: token.sequence },
                },
              ],
            },
          })
        : 0;
    return {
      ...tokenView(token),
      ...queueLabels(queue),
      patientsAhead,
      estimatedWaitMinutes: null,
      updatedAt: queue.updatedAt,
    };
  }

  private staffScope(actor: string): Prisma.HospitalQueueWhereInput {
    return {
      OR: [
        { doctorId: actor },
        { department: { receptionists: { some: { userId: actor } } } },
      ],
    };
  }

  private denyQueue(): never {
    throw new ForbiddenException({
      code: 'UNAUTHORIZED_QUEUE_ACCESS',
      message: 'Queue access denied',
    });
  }

  private async lockQueue(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "HospitalQueue" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const queue = await tx.hospitalQueue.findUnique({
      where: { id },
      include: queueContext,
    });
    if (!queue)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Queue not found',
      });
    return queue;
  }
}
