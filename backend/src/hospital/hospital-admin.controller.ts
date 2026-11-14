import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  HttpCode,
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
    if (
      !(await this.db.department.findUnique({ where: { id: departmentId } }))
    ) {
      throw new NotFoundException('Department not found');
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
