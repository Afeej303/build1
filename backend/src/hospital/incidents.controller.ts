import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Prisma } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Keys whose presence in diagnostics JSON signals PII — strip them. */
const PII_KEY_RE = /password|token|secret|email|phone|patient|name|userId/i;

/**
 * Recursively removes keys from an object that match PII_KEY_RE.
 * Returns a plain JSON-safe object.
 */
function stripPii(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEY_RE.test(k)) continue;
    result[k] = typeof v === 'object' && v !== null ? stripPii(v) : v;
  }
  return result;
}

class ReportIncidentBody {
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: string;

  @IsIn(['UI_ERROR', 'API_ERROR', 'AUTH_ERROR', 'PERFORMANCE', 'QUEUE_OPERATION', 'OTHER'])
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  affectedRoute?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  component?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  diagnostics?: Record<string, unknown>;
}

class UpdateIncidentBody {
  @IsIn(['OPEN', 'INVESTIGATING', 'RESOLVED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

@Controller()
export class IncidentsController {
  constructor(private readonly db: PrismaService) {}

  // ─── POST /incidents ──────────────────────────────────────────────────────
  @Post('incidents')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async reportIncident(
    @CurrentUser('id') actor: string,
    @Body() body: ReportIncidentBody,
  ) {
    const cleanDiagnostics = body.diagnostics
      ? stripPii(body.diagnostics)
      : null;

    const incident = await this.db.frontendIncident.create({
      data: {
        reportedBy: actor,
        severity: body.severity as any,
        category: body.category as any,
        affectedRoute: body.affectedRoute ?? null,
        component: body.component ?? null,
        errorMessage: body.errorMessage ?? null,
        diagnostics: cleanDiagnostics ?? undefined,
      },
      select: {
        id: true,
        severity: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });
    return incident;
  }

  // ─── GET /admin/incidents ─────────────────────────────────────────────────
  @Get('admin/incidents')
  @Roles('super_admin')
  async listIncidents(
    @Query('status') statusFilter?: string,
    @Query('severity') severityFilter?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));
    const skip = (page - 1) * limit;

    const VALID_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED'];
    const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
      throw new BadRequestException('Invalid status filter');
    }
    if (severityFilter && !VALID_SEVERITIES.includes(severityFilter)) {
      throw new BadRequestException('Invalid severity filter');
    }

    const where: Record<string, unknown> = {};
    if (statusFilter) where['status'] = statusFilter;
    if (severityFilter) where['severity'] = severityFilter;

    const [total, items] = await Promise.all([
      this.db.frontendIncident.count({ where: where as any }),
      this.db.frontendIncident.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          reportedBy: true,
          severity: true,
          category: true,
          status: true,
          affectedRoute: true,
          component: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
          // diagnostics intentionally excluded
        },
      }),
    ]);

    return { items, total, page, limit };
  }

  // ─── GET /admin/incidents/:id ─────────────────────────────────────────────
  @Get('admin/incidents/:id')
  @Roles('super_admin')
  async getIncident(@Param('id', ParseUUIDPipe) id: string) {
    const incident = await this.db.frontendIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  // ─── PATCH /admin/incidents/:id ───────────────────────────────────────────
  @Patch('admin/incidents/:id')
  @Roles('super_admin')
  async updateIncident(
    @CurrentUser('id') actor: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateIncidentBody,
  ) {
    const existing = await this.db.frontendIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Incident not found');

    const isResolved = body.status === 'RESOLVED';
    const existingDiagnostics =
      existing.diagnostics && typeof existing.diagnostics === 'object' && !Array.isArray(existing.diagnostics)
        ? (existing.diagnostics as Record<string, unknown>)
        : {};

    const updatedDiagnostics = body.notes
      ? { ...existingDiagnostics, adminNotes: body.notes }
      : existingDiagnostics;

    const updated = await this.db.frontendIncident.update({
      where: { id },
      data: {
        status: body.status as any,
        resolvedAt: isResolved ? new Date() : null,
        resolvedBy: isResolved ? actor : null,
        diagnostics: updatedDiagnostics as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        reportedBy: true,
        severity: true,
        category: true,
        status: true,
        affectedRoute: true,
        component: true,
        errorMessage: true,
        resolvedAt: true,
        resolvedBy: true,
        createdAt: true,
        updatedAt: true,
        // diagnostics intentionally excluded from response
      },
    });
    return updated;
  }
}
