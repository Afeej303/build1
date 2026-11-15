import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AppointmentsController } from './appointments.controller.js';

describe('appointment list scope', () => {
  it('omits another patient’s appointment from a dual-role tracker while preserving the doctor list', async () => {
    const actor = 'dual-role';
    const slot = {
      id: 'slot', queueId: 'queue', startsAt: new Date(),
      endsAt: new Date(), queue: { department: { name: 'Ward' }, doctor: { name: 'Doctor' }, roomLabel: null },
    };
    const rows = [
      { id: 'own', status: 'BOOKED', queueTokenId: null, slot, owner: actor, doctor: 'someone-else' },
      { id: 'other', status: 'BOOKED', queueTokenId: null, slot, owner: 'other', doctor: actor },
    ];
    const findMany = vi.fn(async ({ where }) => rows.filter((row) =>
      where.patient ? row.owner === where.patient.userId :
        where.OR.some((filter: { patient?: { userId: string }; slot?: { queue: { doctorId: string } } }) =>
          filter.patient?.userId === row.owner || filter.slot?.queue.doctorId === row.doctor),
    ));
    const controller = new AppointmentsController({ appointment: { findMany } } as unknown as PrismaService);
    const range = { from: '2026-11-14T00:00:00Z', to: '2026-11-15T00:00:00Z' };

    const patient = await controller.list(actor, { ...range, scope: 'patient' });
    expect(patient.items.map((item) => item.id)).toEqual(['own']);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      slot: { startsAt: { gte: new Date(range.from), lt: new Date(range.to) } },
      patient: { userId: actor },
    });
    const legacy = await controller.list(actor, range);
    expect(legacy.items.map((item) => item.id)).toEqual(['own', 'other']);
  });
});
