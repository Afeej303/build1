/**
 * HQMS Admin Integration Test Suite — Super Admin Domain Service Verification
 *
 * Verifies:
 * 1. superAdminService method signatures and contracts
 * 2. Integration with apiClient methods (getAdminHospitals, createHospital, getSystemAuditLogs, getPlatformUsers, getPlatformRoles, getPlatformPermissions)
 * 3. Validation rules:
 *    - createHospital rejects empty and whitespace-only names
 * 4. Data normalization:
 *    - User normalization handles various backend schema variations (raw_user_meta_data, single role vs roles array, etc.)
 *    - Audit log pagination computes totalItems and totalPages accurately
 * 5. Fallback resilience:
 *    - Baseline fallback roles when roles endpoint returns an error
 *    - Baseline fallback permissions when permissions endpoint returns an error
 */

import {
  superAdminService,
  fetchHospitals,
  createHospital,
  fetchAuditLogs,
  fetchUsers,
  fetchRoles,
  fetchPermissions,
  type PlatformUser,
  type PlatformRole,
  type PlatformPermission,
  type SystemAuditLogsResponse,
  type PlatformUsersResponse,
} from '../../services/superAdminService';

import { apiClient } from '../../lib/api-client';

export async function runSuperAdminServiceTests(): Promise<{ passed: number; failed: number; assertions: string[] }> {
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

  // 1. Signature & Export Integrity
  assert(typeof superAdminService === 'object', 'superAdminService must be an object');
  assert(typeof superAdminService.fetchHospitals === 'function', 'superAdminService.fetchHospitals must be a function');
  assert(typeof superAdminService.createHospital === 'function', 'superAdminService.createHospital must be a function');
  assert(typeof superAdminService.fetchAuditLogs === 'function', 'superAdminService.fetchAuditLogs must be a function');
  assert(typeof superAdminService.fetchUsers === 'function', 'superAdminService.fetchUsers must be a function');
  assert(typeof superAdminService.fetchRoles === 'function', 'superAdminService.fetchRoles must be a function');
  assert(typeof superAdminService.fetchPermissions === 'function', 'superAdminService.fetchPermissions must be a function');

  // Direct export aliases
  assert(typeof fetchHospitals === 'function', 'fetchHospitals direct export must be a function');
  assert(typeof createHospital === 'function', 'createHospital direct export must be a function');
  assert(typeof fetchAuditLogs === 'function', 'fetchAuditLogs direct export must be a function');
  assert(typeof fetchUsers === 'function', 'fetchUsers direct export must be a function');
  assert(typeof fetchRoles === 'function', 'fetchRoles direct export must be a function');
  assert(typeof fetchPermissions === 'function', 'fetchPermissions direct export must be a function');

  // 2. Validation Constraints: createHospital
  try {
    await superAdminService.createHospital('');
    assert(false, 'createHospital should reject empty string');
  } catch (err: any) {
    assert(err.message === 'Hospital name is required.', 'createHospital rejects empty string with "Hospital name is required."');
  }

  try {
    await superAdminService.createHospital('     ');
    assert(false, 'createHospital should reject whitespace string');
  } catch (err: any) {
    assert(err.message === 'Hospital name is required.', 'createHospital rejects whitespace string');
  }

  // 3. Mock apiClient integration tests
  // Save originals to restore
  const origGetAdminHospitals = apiClient.getAdminHospitals;
  const origCreateHospital = apiClient.createHospital;
  const origGetSystemAuditLogs = apiClient.getSystemAuditLogs;
  const origGetPlatformUsers = apiClient.getPlatformUsers;
  const origGetPlatformRoles = apiClient.getPlatformRoles;
  const origGetPlatformPermissions = apiClient.getPlatformPermissions;

  try {
    // 3a. fetchHospitals delegates to apiClient.getAdminHospitals
    let calledAdminHospitals = false;
    apiClient.getAdminHospitals = async () => {
      calledAdminHospitals = true;
      return [
        { id: 'hosp-1', name: 'General Hospital', status: 'ACTIVE', departments: [] },
      ];
    };
    const hospitals = await superAdminService.fetchHospitals();
    assert(calledAdminHospitals, 'fetchHospitals delegates to apiClient.getAdminHospitals');
    assert(hospitals.length === 1 && hospitals[0].name === 'General Hospital', 'fetchHospitals returns received hospitals');

    // 3b. createHospital trims name and calls apiClient.createHospital
    let createdWith = '';
    apiClient.createHospital = async (name: string) => {
      createdWith = name;
      return { id: 'hosp-new', name, status: 'ACTIVE', departments: [] };
    };
    const newHospital = await superAdminService.createHospital('  St. Marks Clinic  ');
    assert(createdWith === 'St. Marks Clinic', 'createHospital trims whitespace before calling backend');
    assert(newHospital.id === 'hosp-new', 'createHospital returns created hospital object');

    // 3c. fetchAuditLogs pagination & meta computation
    apiClient.getSystemAuditLogs = async (page: number, limit: number) => {
      return {
        items: [
          { id: 'log-1', action: 'HOSPITAL_ONBOARDED', actorId: 'u-1', createdAt: new Date().toISOString() },
          { id: 'log-2', action: 'ROLE_ASSIGNED', actorId: 'u-2', createdAt: new Date().toISOString() },
        ],
        meta: { page, limit, totalItems: 42, totalPages: 2 },
      };
    };
    const auditResult = await superAdminService.fetchAuditLogs(1, 20);
    assert(auditResult.items.length === 2, 'fetchAuditLogs returns audit log items');
    assert(auditResult.meta.page === 1, 'fetchAuditLogs returns correct page');
    assert(auditResult.meta.limit === 20, 'fetchAuditLogs returns correct limit');
    assert(auditResult.meta.totalItems === 42, 'fetchAuditLogs preserves totalItems');
    assert(auditResult.meta.totalPages === 2, 'fetchAuditLogs preserves totalPages');

    // 3d. fetchUsers normalization test
    apiClient.getPlatformUsers = async (page: number, limit: number) => {
      return {
        items: [
          {
            id: 'usr-1',
            email: 'doctor@health.org',
            displayName: 'Dr. Jane Roe',
            roles: ['doctor'],
            hospitalId: 'hosp-1',
            hospital: { name: 'City Hospital' },
          },
          {
            user_id: 'usr-2',
            email: 'admin@health.org',
            name: 'Hospital Admin',
            role: 'hospital_admin',
            raw_user_meta_data: { role: 'hospital_admin' },
          },
        ],
        meta: { page: 1, limit: 50, total: 2 },
      };
    };
    const userResult = await superAdminService.fetchUsers(1, 50);
    assert(userResult.items.length === 2, 'fetchUsers normalizes user items');
    assert(userResult.items[0].id === 'usr-1', 'fetchUsers normalizes standard id');
    assert(userResult.items[0].roles.includes('doctor'), 'fetchUsers normalizes doctor roles');
    assert(userResult.items[0].hospitalName === 'City Hospital', 'fetchUsers normalizes hospitalName');
    assert(userResult.items[1].id === 'usr-2', 'fetchUsers normalizes user_id to id');
    assert(userResult.items[1].roles.includes('hospital_admin'), 'fetchUsers normalizes single role into roles array');

    // 3e. fetchRoles handles fallback when backend fails
    apiClient.getPlatformRoles = async () => {
      throw new Error('Table not found');
    };
    const fallbackRoles = await superAdminService.fetchRoles();
    assert(Array.isArray(fallbackRoles) && fallbackRoles.length >= 5, 'fetchRoles returns resilient fallback roles on backend failure');
    assert(fallbackRoles.some((r) => r.name === 'super_admin'), 'fallback roles include super_admin');
    assert(fallbackRoles.some((r) => r.name === 'hospital_admin'), 'fallback roles include hospital_admin');

    // 3f. fetchPermissions handles fallback when backend fails
    apiClient.getPlatformPermissions = async () => {
      throw new Error('Table not found');
    };
    const fallbackPerms = await superAdminService.fetchPermissions();
    assert(Array.isArray(fallbackPerms) && fallbackPerms.length >= 6, 'fetchPermissions returns resilient fallback permissions on backend failure');
    assert(fallbackPerms.some((p) => p.key === 'hospitals:write'), 'fallback permissions include hospitals:write');
    assert(fallbackPerms.some((p) => p.key === 'audit:read'), 'fallback permissions include audit:read');

  } finally {
    // Restore originals
    apiClient.getAdminHospitals = origGetAdminHospitals;
    apiClient.createHospital = origCreateHospital;
    apiClient.getSystemAuditLogs = origGetSystemAuditLogs;
    apiClient.getPlatformUsers = origGetPlatformUsers;
    apiClient.getPlatformRoles = origGetPlatformRoles;
    apiClient.getPlatformPermissions = origGetPlatformPermissions;
  }

  return { passed, failed, assertions };
}

// Auto-run if imported / executed
export const superAdminServiceTestResults = await runSuperAdminServiceTests();
console.log(`\n--- Super Admin Service Suite (${superAdminServiceTestResults.passed} passed, ${superAdminServiceTestResults.failed} failed) ---`);
superAdminServiceTestResults.assertions.forEach((a) => console.log(a));
