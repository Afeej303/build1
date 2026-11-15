import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma/prisma.service.js';

let app: NestExpressApplication;

beforeAll(async () => {
  vi.stubEnv('AUTH_MODE', 'supabase');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-key');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  vi.stubEnv('API_PREFIX', '');
  vi.stubEnv('ENABLE_RATE_LIMIT_IN_TESTS', 'true');
  vi.stubEnv('THROTTLE_LIMIT', '2');
  vi.stubEnv('AUTH_THROTTLE_LIMIT', '1');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    id: '9cc92916-c427-48f3-86ba-9473eeaf71ed',
    email: 'patient@example.test',
    email_confirmed_at: '2026-01-01T00:00:00Z',
  })));
  const { AppModule } = await import('./app.module.js');
  const { configureApp } = await import('./main.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      user: { findUnique: vi.fn().mockResolvedValue({
        id: 'ad9830e6-bbe4-4034-88e1-21e8e7d13225',
        email: 'patient@example.test',
        status: 'ACTIVE',
        deletedAt: null,
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      }) },
      appointment: { findMany: vi.fn().mockResolvedValue([]) },
    })
    .compile();
  app = module.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
});

afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('counts rejected appointment requests against the default bucket only', async () => {
  const client = request(app.getHttpServer());
  const path = '/users/me/appointments';
  const valid = { from: '2026-11-07T19:11:09.898Z', to: '2026-12-05T19:11:09.898Z', scope: 'patient' };
  const get = (query: object) => client.get(path).query(query).set('Authorization', 'Bearer token');

  const invalid = await get({ ...valid, from: 'invalid' }).expect(400);
  expect(invalid.body.code).toBe('VALIDATION_ERROR');
  expect(invalid.headers['x-ratelimit-remaining']).toBe('1');
  expect(invalid.headers['x-ratelimit-limit-auth']).toBeUndefined();

  await get(valid).expect(200);
  const limited = await get(valid).expect(429);
  expect(limited.body.code).toBe('TOO_MANY_REQUESTS');
  expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  expect(limited.headers['retry-after-auth']).toBeUndefined();
});
