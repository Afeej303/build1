import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const subject = '9cc92916-c427-48f3-86ba-9473eeaf71ed';
const id = 'ad9830e6-bbe4-4034-88e1-21e8e7d13225';
const confirmedAt = '2026-01-01T00:00:00Z';
const profile = {
  id,
  email: 'user@example.com',
  name: 'user',
  status: UserStatus.ACTIVE,
  deletedAt: null,
  emailVerifiedAt: new Date(confirmedAt),
};
const assignments = vi.fn().mockResolvedValue([]);
const receptionDepartments = vi.fn().mockResolvedValue([]);
const doctorQueues = vi.fn().mockResolvedValue([]);
const hospitalAdminAssignments = vi.fn().mockResolvedValue([]);
let app: NestExpressApplication;

beforeAll(async () => {
  vi.stubEnv('AUTH_MODE', 'supabase');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  vi.stubEnv('API_PREFIX', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        id: subject,
        email: profile.email,
        email_confirmed_at: confirmedAt,
      }),
    ),
  );

  const { AppModule } = await import('../app.module.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      user: {
        findUnique: vi.fn().mockResolvedValue(profile),
        findFirst: vi.fn().mockResolvedValue(profile),
      },
      userRole: { findMany: assignments },
      department: { findMany: receptionDepartments },
      hospitalQueue: { findMany: doctorQueues },
      hospitalAdminAssignment: { findMany: hospitalAdminAssignments },
      role: { findMany: vi.fn().mockResolvedValue([]) },
    })
    .compile();
  app = module.createNestApplication<NestExpressApplication>({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('connects Supabase identity to the profile and database-backed permission guard', async () => {
  const client = request(app.getHttpServer());
  await client.get('/users/me').expect(401);
  await client
    .get('/users/me')
    .set('Authorization', 'Bearer token')
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({ id, roles: [], permissions: [] });
    });
  await client.get('/roles').set('Authorization', 'Bearer token').expect(403);
  assignments.mockResolvedValueOnce([
    {
      role: {
        slug: 'reviewer',
        rolePermissions: [{ permission: { key: 'role:read' } }],
      },
    },
  ]);
  await client.get('/roles').set('Authorization', 'Bearer token').expect(200);
  await client.post('/auth/login').expect(404);
  await client
    .get('/sessions')
    .set('Authorization', 'Bearer token')
    .expect(404);
});

const hospitalA = '98ad1273-b9bf-4234-b6a1-e3c858a7354c';
const hospitalB = 'a0741362-27e7-435e-8696-fccd8d206fe0';

it.each([
  { name: 'single hospital assignment', hospitalIds: [hospitalA], clinical: false },
  { name: 'multiple hospital assignments', hospitalIds: [hospitalA, hospitalB], clinical: false },
  { name: 'no hospital assignment', hospitalIds: [], clinical: false },
  { name: 'combined hospital admin, doctor and receptionist assignments', hospitalIds: [hospitalA], clinical: true },
])('returns the expected profile for $name', async ({ hospitalIds, clinical }) => {
  hospitalAdminAssignments.mockResolvedValueOnce(hospitalIds.map((hospitalId) => ({ hospitalId })));

  const department = { id: 'department', name: 'General medicine' };
  const queue = { id: 'queue', name: 'Outpatient', doctor: { name: 'Doctor' }, roomLabel: '101' };
  const queueView = { id: queue.id, name: queue.name, doctorName: queue.doctor.name, roomLabel: queue.roomLabel };
  if (clinical) {
    receptionDepartments.mockResolvedValueOnce([{ ...department, hospitalId: hospitalB, queues: [queue] }]);
    doctorQueues.mockResolvedValueOnce([{ ...queue, department: { ...department, hospitalId: hospitalB } }]);
  }

  const response = await request(app.getHttpServer())
    .get('/users/me')
    .set('Authorization', 'Bearer token')
    .expect(200);
  expect(response.body.staffAssignments).toEqual([
    ...hospitalIds.map((hospitalId) => ({ role: 'hospital_admin', hospitalId, department: null, queues: [] })),
    ...(clinical ? [
      { role: 'receptionist', hospitalId: hospitalB, department, queues: [queueView] },
      { role: 'doctor', hospitalId: hospitalB, department, queues: [queueView] },
    ] : []),
  ]);
  expect(response.body.roles).toEqual([]);
  expect(hospitalAdminAssignments).toHaveBeenLastCalledWith(
    expect.objectContaining({ where: { userId: id }, select: { hospitalId: true } }),
  );
});
