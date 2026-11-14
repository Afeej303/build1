import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { IncidentsController } from './incidents.controller.js';

describe('IncidentsController', () => {
  it('strips PII from diagnostics when reporting an incident', async () => {
    let capturedCreateData: any = null;
    const db = {
      frontendIncident: {
        create: vi.fn().mockImplementation(({ data, select }) => {
          capturedCreateData = data;
          return Promise.resolve({
            id: 'inc-1',
            severity: data.severity,
            category: data.category,
            status: 'OPEN',
            createdAt: new Date(),
          });
        }),
      },
    };

    const controller = new IncidentsController(db as unknown as PrismaService);

    const result = await controller.reportIncident('user-uuid-1', {
      severity: 'HIGH',
      category: 'UI_ERROR',
      affectedRoute: '/dashboard',
      component: 'QueueBoard',
      errorMessage: 'Cannot read properties of undefined',
      diagnostics: {
        browser: 'Chrome 120',
        userId: 'leak-id',
        userEmail: 'leak@example.com',
        patientName: 'Jane Doe',
        authToken: 'secret-token',
        passwordHash: 'secret-hash',
        nested: {
          secretKey: 'top-secret',
          safeParam: 42,
        },
      },
    });

    expect(result.id).toBe('inc-1');
    expect(result.severity).toBe('HIGH');
    expect(result.category).toBe('UI_ERROR');
    expect(result.status).toBe('OPEN');

    expect(capturedCreateData.reportedBy).toBe('user-uuid-1');
    expect(capturedCreateData.diagnostics).toEqual({
      browser: 'Chrome 120',
      nested: {
        safeParam: 42,
      },
    });
  });

  it('lists incidents with pagination and excludes diagnostics', async () => {
    const db = {
      frontendIncident: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'inc-1',
            reportedBy: 'user-uuid-1',
            severity: 'CRITICAL',
            category: 'API_ERROR',
            status: 'OPEN',
            affectedRoute: '/api/v1',
            component: 'ApiGateway',
            errorMessage: '500 Server Error',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
    };

    const controller = new IncidentsController(db as unknown as PrismaService);
    const result = await controller.listIncidents('OPEN', 'CRITICAL', '1', '20');

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('diagnostics');
  });

  it('retrieves full incident details including diagnostics', async () => {
    const incidentData = {
      id: 'inc-1',
      reportedBy: 'user-uuid-1',
      severity: 'MEDIUM',
      category: 'PERFORMANCE',
      status: 'INVESTIGATING',
      affectedRoute: '/queue',
      component: 'QueueList',
      errorMessage: null,
      diagnostics: { loadTimeMs: 4500 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      frontendIncident: {
        findUnique: vi.fn().mockResolvedValue(incidentData),
      },
    };

    const controller = new IncidentsController(db as unknown as PrismaService);
    const result = await controller.getIncident('inc-1');
    expect(result).toEqual(incidentData);
  });

  it('updates incident status to RESOLVED with notes and sets resolvedBy/resolvedAt', async () => {
    let capturedUpdateData: any = null;
    const db = {
      frontendIncident: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'inc-1',
          diagnostics: { initial: 'info' },
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          capturedUpdateData = data;
          return Promise.resolve({
            id: 'inc-1',
            status: data.status,
            resolvedAt: data.resolvedAt,
            resolvedBy: data.resolvedBy,
          });
        }),
      },
    };

    const controller = new IncidentsController(db as unknown as PrismaService);
    const result = await controller.updateIncident('admin-uuid-1', 'inc-1', {
      status: 'RESOLVED',
      notes: 'Fixed in hotfix #123',
    });

    expect(result.status).toBe('RESOLVED');
    expect(capturedUpdateData.status).toBe('RESOLVED');
    expect(capturedUpdateData.resolvedBy).toBe('admin-uuid-1');
    expect(capturedUpdateData.resolvedAt).toBeInstanceOf(Date);
    expect(capturedUpdateData.diagnostics).toEqual({
      initial: 'info',
      adminNotes: 'Fixed in hotfix #123',
    });
  });
});
