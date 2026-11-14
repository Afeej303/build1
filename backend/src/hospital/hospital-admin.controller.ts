import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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

@Roles('super_admin')
@Controller('admin')
export class HospitalAdminController {
  constructor(private readonly db: PrismaService) {}

  @Get('hospitals')
  listHospitals() {
    return this.db.hospital.findMany({
      orderBy: { name: 'asc' },
      include: {
        departments: {
          include: {
            queues: true,
            receptionists: { select: { userId: true } },
          },
        },
      },
    });
  }

  @Post('hospitals')
  createHospital(@Body() body: NameBody) {
    return this.db.hospital.create({ data: { name: nameOf(body) } });
  }

  @Post('hospitals/:hospitalId/departments')
  async createDepartment(
    @Param('hospitalId', ParseUUIDPipe) hospitalId: string,
    @Body() body: NameBody,
  ) {
    if (!(await this.db.hospital.findUnique({ where: { id: hospitalId } }))) {
      throw new NotFoundException('Hospital not found');
    }
    return this.db.department.create({
      data: { hospitalId, name: nameOf(body) },
    });
  }

  @Post('departments/:departmentId/queues')
  async createQueue(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: QueueBody,
  ) {
    if (
      !(await this.db.department.findUnique({ where: { id: departmentId } }))
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
    @Param('queueId', ParseUUIDPipe) id: string,
    @Body() body: QueueSettings,
  ) {
    if (body.doctorId) await this.ensureActiveUser(body.doctorId);
    const [queue] = await this.db.hospitalQueue.updateManyAndReturn({
      where: { id },
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
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.ensureActiveUser(userId);
    if (
      !(await this.db.department.findUnique({ where: { id: departmentId } }))
    ) {
      throw new NotFoundException('Department not found');
    }
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
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.db.receptionAssignment.deleteMany({
      where: { departmentId, userId },
    });
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
