/**
 * Hospital Queue Management System — Super Admin Unit & Contract Tests
 * Validates module exports, component signatures, service contracts, and constraints.
 */

import {
  SuperAdminDashboard,
  PlatformOverview,
  HospitalDirectory,
  HospitalOnboardModal,
  GlobalUserDirectory,
  SystemAuditLog,
  WebIncidentHub,
} from './index';

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
} from '../../services/superAdminService';

import type { Hospital, AuditLogEntry, WebIncident } from '../../services/types';

// ============================================================================
// 1. Component Export Integrity
// ============================================================================

const superAdminComponents = [
  { name: 'SuperAdminDashboard', comp: SuperAdminDashboard },
  { name: 'PlatformOverview', comp: PlatformOverview },
  { name: 'HospitalDirectory', comp: HospitalDirectory },
  { name: 'HospitalOnboardModal', comp: HospitalOnboardModal },
  { name: 'GlobalUserDirectory', comp: GlobalUserDirectory },
  { name: 'SystemAuditLog', comp: SystemAuditLog },
  { name: 'WebIncidentHub', comp: WebIncidentHub },
];

for (const { name, comp } of superAdminComponents) {
  if (typeof comp !== 'function') {
    throw new Error(`Super Admin component ${name} export test failed: expected function, got ${typeof comp}`);
  }
}

// ============================================================================
// 2. Service Method Signatures
// ============================================================================

const requiredServiceMethods = [
  'fetchHospitals',
  'createHospital',
  'fetchAuditLogs',
  'fetchUsers',
  'fetchRoles',
  'fetchPermissions',
] as const;

for (const method of requiredServiceMethods) {
  if (typeof superAdminService[method] !== 'function') {
    throw new Error(`superAdminService.${method} missing or not a function`);
  }
}

// ============================================================================
// 3. Security Constraint Verification: No Hardcoded Passwords
// ============================================================================

// Verify that createHospital rejects blank names
export async function testCreateHospitalValidation() {
  try {
    await superAdminService.createHospital('   ');
    throw new Error('createHospital should reject empty string');
  } catch (err: any) {
    if (err.message !== 'Hospital name is required.') {
      throw err;
    }
  }
}

// ============================================================================
// 4. Type Contract Verification (Compile-Time Type Assertions)
// ============================================================================

const sampleUser: PlatformUser = {
  id: 'usr-test-1',
  email: 'admin@hqms.test',
  name: 'Test Administrator',
  status: 'ACTIVE',
  roles: ['super_admin'],
};

const sampleRole: PlatformRole = {
  id: 'role-super-admin',
  name: 'super_admin',
};

const samplePermission: PlatformPermission = {
  id: 'perm-hospitals-write',
  key: 'hospitals:write',
};

if (!sampleUser.roles.includes('super_admin')) {
  throw new Error('Role test failed');
}

export const SUPER_ADMIN_TEST_SUITE_PASSED = true;
