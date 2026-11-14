import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationLookupService } from '../common/services/authorization-lookup.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HospitalAdminController } from './hospital-admin.controller.js';

describe('hospital administration scopes', () => {
  it('limits a delegated admin to assigned hospitals on reads and writes', async () => {
    const scope = { admins: { some: { userId: 'delegated-admin' } } };
    const db = {
      hospitalAdminAssignment: {
        findFirst: vi.fn().mockResolvedValue({ hospitalId: 'assigned' }),
      },
      hospital: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      department: { create: vi.fn() },
    };
    const roles = {
      getGlobalRolesAndPermissions: vi
        .fn()
        .mockResolvedValue({ roleSlugs: [] }),
    };
    const controller = new HospitalAdminController(
      db as unknown as PrismaService,
      roles as unknown as AuthorizationLookupService,
    );

    await controller.listHospitals('delegated-admin');
    expect(db.hospital.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: scope }),
    );
    await expect(
      controller.createDepartment('delegated-admin', 'another-hospital', {
        name: 'Ward',
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.hospital.findFirst).toHaveBeenCalledWith({
      where: { id: 'another-hospital', ...scope },
    });
    expect(db.department.create).not.toHaveBeenCalled();
  });
});
