import { type ArgumentsHost, HttpException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter.js';

it.each([
  ['Retry-After', 11],
  ['Retry-After-auth', 29],
] as const)('normalizes a throttler response with %s', (header, seconds) => {
  const headers = new Map<string, number>([[header, seconds]]);
  const response = {
    getHeader: (name: string) => headers.get(name),
    hasHeader: (name: string) => headers.has(name),
    setHeader: (name: string, value: number) => headers.set(name, value),
    removeHeader: (name: string) => headers.delete(name),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const path = '/users/me/appointments';
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ url: path }), getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new GlobalExceptionFilter().catch(new ThrottlerException(), host);

  expect([...headers]).toEqual([['Retry-After', seconds]]);
  expect(response.status).toHaveBeenCalledWith(429);
  expect(response.json).toHaveBeenCalledWith({
    statusCode: 429,
    code: 'TOO_MANY_REQUESTS',
    error: 'TOO_MANY_REQUESTS',
    message: expect.any(String),
    timestamp: expect.any(String),
    path,
  });
});

it('adds a machine-readable code to other HTTP 429 responses', () => {
  const response = {
    getHeader: vi.fn(),
    removeHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/incidents' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(new HttpException({ message: 'Limited' }, 429), host);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({ statusCode: 429, code: 'TOO_MANY_REQUESTS' }),
  );
});
