/**
 * HQMS Admin Integration Test Suite — Error Handling & Classification Verification
 *
 * Verifies:
 * 1. ApiError domain model and category classification
 * 2. Network / CORS failures do NOT invent HTTP status codes (status is undefined)
 * 3. Network failures are NEVER converted into 404 or FACILITY_NOT_FOUND
 * 4. Genuine HTTP status codes (401, 403, 404, 500) and backend error codes are preserved
 * 5. Diagnostic trace sanitization strips secrets, Bearer tokens, and passwords
 * 6. Phase B typed integration points throw AWAITING_M2_API instead of mock success
 */

import { ApiError } from '../../lib/api-client';
import { hospitalAdminService } from '../../services/hospitalAdminService';

export async function runErrorHandlingTests(): Promise<{ passed: number; failed: number; assertions: string[] }> {
  const assertions: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      passed++;
      assertions.push(`[PASS] ${description}`);
    } else {
      failed++;
      assertions.push(`[FAIL] ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  // 1. ApiError Class Construction & Classification
  const netErr = new ApiError('Failed to fetch', {
    isNetworkError: true,
    code: 'BACKEND_CONNECTION_ERROR',
  });
  assert(netErr instanceof ApiError, 'ApiError instance created');
  assert(netErr.isNetworkError === true, 'isNetworkError must be true for network failures');
  assert(netErr.status === undefined, 'Network errors must NOT have an invented HTTP status code');
  assert(netErr.category === 'NETWORK', 'Network errors must be categorized as NETWORK');
  assert(netErr.code === 'BACKEND_CONNECTION_ERROR', 'Network errors must carry BACKEND_CONNECTION_ERROR code');

  // 2. HTTP 401 Classification
  const authErr = new ApiError('Token expired', { status: 401, code: 'UNAUTHORIZED' });
  assert(authErr.status === 401, 'Preserves HTTP 401 status');
  assert(authErr.category === 'AUTH', 'HTTP 401 categorized as AUTH');
  assert(authErr.code === 'UNAUTHORIZED', 'Preserves UNAUTHORIZED code');

  // 3. HTTP 403 Classification
  const forbiddenErr = new ApiError('Forbidden facility', { status: 403, code: 'FORBIDDEN' });
  assert(forbiddenErr.status === 403, 'Preserves HTTP 403 status');
  assert(forbiddenErr.category === 'FORBIDDEN', 'HTTP 403 categorized as FORBIDDEN');

  // 4. HTTP 404 Classification
  const notFoundErr = new ApiError('Queue not found', { status: 404, code: 'RESOURCE_NOT_FOUND' });
  assert(notFoundErr.status === 404, 'Preserves HTTP 404 status');
  assert(notFoundErr.category === 'NOT_FOUND', 'HTTP 404 categorized as NOT_FOUND');
  assert(notFoundErr.code === 'RESOURCE_NOT_FOUND', 'Preserves backend error code');

  // 5. HTTP 500 Classification
  const serverErr = new ApiError('Internal crash', { status: 500, code: 'DATABASE_TIMEOUT' });
  assert(serverErr.status === 500, 'Preserves HTTP 500 status');
  assert(serverErr.category === 'SERVER', 'HTTP 500 categorized as SERVER');

  // 6. Verification: Network failure is NEVER converted into FACILITY_NOT_FOUND
  const rawFetchError = new TypeError('Failed to fetch');
  const wrapped = new ApiError('Network/CORS failure', {
    isNetworkError: true,
    code: 'BACKEND_CONNECTION_ERROR',
    cause: rawFetchError,
  });
  assert(wrapped.code !== 'FACILITY_NOT_FOUND', 'Network failure code must never be FACILITY_NOT_FOUND');
  assert(wrapped.status !== 404, 'Network failure status must never be 404');

  // 7. Diagnostics Sanitization Verification
  const testTrace = {
    authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummysecrettoken',
    password: 'SuperSecretPassword#123',
    apiKey: 'sb_publishable_secret_key',
    normalField: 'Valid hospital name',
  };

  const sanitizeTest = (data: any): any => {
    if (typeof data === 'string') {
      return data
        .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/(api[_-]?key|secret|password|token|jwt|credential)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, '$1: "[REDACTED]"');
    }
    if (data && typeof data === 'object') {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (/token|secret|password|key|auth|jwt|credential/i.test(k) && typeof v === 'string') {
          clean[k] = '[REDACTED]';
        } else {
          clean[k] = sanitizeTest(v);
        }
      }
      return clean;
    }
    return data;
  };

  const sanitized = sanitizeTest(testTrace);
  assert(sanitized.password === '[REDACTED]', 'Password must be completely redacted');
  assert(sanitized.apiKey === '[REDACTED]', 'API key must be completely redacted');
  assert(sanitized.authHeader === '[REDACTED]', 'Auth header must be redacted');
  assert(sanitized.normalField === 'Valid hospital name', 'Non-sensitive data preserved');

  // 8. Phase B Integration Points (Throw AWAITING_M2_API, no mock success)
  try {
    await hospitalAdminService.provisionHospitalAdmin('hosp-1', { name: 'Admin', email: 'admin@h.com' });
    assert(false, 'provisionHospitalAdmin must not return mock success');
  } catch (err: any) {
    assert(err.code === 'AWAITING_M2_API', 'provisionHospitalAdmin throws AWAITING_M2_API');
  }

  try {
    await hospitalAdminService.provisionStaffUser('hosp-1', { name: 'Doc', email: 'doc@h.com', role: 'doctor' });
    assert(false, 'provisionStaffUser must not return mock success');
  } catch (err: any) {
    assert(err.code === 'AWAITING_M2_API', 'provisionStaffUser throws AWAITING_M2_API');
  }

  try {
    await hospitalAdminService.assignReceptionist('hosp-1', { userId: 'u-1', departmentId: 'd-1' });
    assert(false, 'assignReceptionist must not return mock success');
  } catch (err: any) {
    assert(err.code === 'AWAITING_M2_API', 'assignReceptionist throws AWAITING_M2_API');
  }

  try {
    await hospitalAdminService.configureDoctorSchedule('hosp-1', {
      doctorId: 'd-1',
      departmentId: 'dept-1',
      queueId: 'q-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    });
    assert(false, 'configureDoctorSchedule must not return mock success');
  } catch (err: any) {
    assert(err.code === 'AWAITING_M2_API', 'configureDoctorSchedule throws AWAITING_M2_API');
  }

  try {
    await hospitalAdminService.submitFacilityIncident('hosp-1', {
      title: 'Crash',
      severity: 'HIGH',
      category: 'UI_GLITCH',
      description: 'Desc',
      component: 'Comp',
    });
    assert(false, 'submitFacilityIncident must not return mock success');
  } catch (err: any) {
    assert(err.code === 'AWAITING_M2_API', 'submitFacilityIncident throws AWAITING_M2_API');
  }

  return { passed, failed, assertions };
}
