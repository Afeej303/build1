import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HospitalController } from './hospital.controller.js';

describe('Hospital queue views', () => {
  it('projects only public queue fields', async () => {
    const updatedAt = new Date();
    const db = {
      hospitalQueue: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'internal-queue',
          department: { name: 'General Medicine' },
          roomLabel: 'Room 2',
          updatedAt,
          doctor: { name: 'Doctor' },
        }),
      },
      queueToken: { findFirst: vi.fn(), count: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([{ sequence: 14n }, 3]),
    };
    const controller = new HospitalController(db as unknown as PrismaService);
    await expect(controller.publicBoard('general-room-2')).resolves.toEqual({
      publicQueueId: 'general-room-2',
      departmentName: 'General Medicine',
      roomLabel: 'Room 2',
      currentDisplayNumber: '14',
      waitingCount: 3,
      estimatedWaitMinutes: null,
      updatedAt,
    });
  });

  it('looks up a private token only through the authenticated owner', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const controller = new HospitalController({
      queueToken: { findFirst },
    } as unknown as PrismaService);
    await expect(
      controller.patientToken('user-b', 'token-a'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'TOKEN_NOT_FOUND' },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'token-a', patient: { userId: 'user-b' } },
      }),
    );
  });
});
