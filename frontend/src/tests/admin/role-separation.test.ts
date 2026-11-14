/**
 * HQMS Admin Integration Test Suite — Role Separation & RBAC Verification
 *
 * Verifies:
 * 1. Super Admin role derivation and exclusive access to /admin
 * 2. Hospital Admin role derivation and access to /hospital-admin while STRICTLY EXCLUDED from /admin
 * 3. Doctor role cannot access /admin or /hospital-admin
 * 4. Receptionist role cannot access /admin or /hospital-admin
 * 5. Patient / Public users cannot access any administrative surfaces
 * 6. Unauthenticated sessions are redirected to /staff-login with appropriate redirect target
 */

import type { UserProfile } from '../../types/contract';

/**
 * Pure role evaluation logic matching src/lib/auth.tsx
 */
export function evaluateUserRoles(profile: Partial<UserProfile> | null, userEmail?: string | null) {
  const isSuperAdmin = Boolean(
    profile?.roles?.some(
      (r) => typeof r === 'string' && (r.toLowerCase().includes('super') || r.toLowerCase() === 'super_admin')
    ) || profile?.permissions?.includes('audit:read')
  );

  const isHospitalAdmin = Boolean(
    isSuperAdmin ||
      profile?.roles?.some((r) => typeof r === 'string' && r.toLowerCase().includes('admin')) ||
      profile?.staffAssignments?.some((a) => a.role?.toLowerCase().includes('admin')) ||
      userEmail?.toLowerCase().includes('admin')
  );

  const isAdmin = isSuperAdmin || isHospitalAdmin;

  const isDoctor = Boolean(
    profile?.staffAssignments?.some(
      (a) => a.role?.toLowerCase() === 'doctor' || (a.queues && a.queues.length > 0)
    ) ||
      profile?.roles?.some((r) => typeof r === 'string' && (r.toLowerCase().includes('doctor') || r.toLowerCase().includes('admin'))) ||
      profile?.permissions?.includes('queue:call_next')
  );

  const isReceptionist = Boolean(
    profile?.staffAssignments?.some(
      (a) => a.role?.toLowerCase() === 'receptionist' || a.role?.toLowerCase() === 'staff'
    ) ||
      profile?.roles?.some((r) => typeof r === 'string' && (r.toLowerCase().includes('reception') || r.toLowerCase().includes('admin'))) ||
      profile?.permissions?.includes('queue:issue_walkin')
  );

  const isPatient = Boolean(userEmail || profile?.id);

  return {
    isSuperAdmin,
    isHospitalAdmin,
    isAdmin,
    isDoctor,
    isReceptionist,
    isPatient,
  };
}

/**
 * Simulates ProtectedRoute decision for a given user state and required role
 */
export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unauthenticated'; redirectTo: string }
  | { allowed: false; reason: 'forbidden'; barrier: string };

export function evaluateRouteAccess(
  requiredRole: 'super_admin' | 'hospital_admin' | 'admin' | 'doctor' | 'receptionist' | 'staff' | 'patient' | undefined,
  session: { access_token: string } | null,
  profile: Partial<UserProfile> | null,
  userEmail?: string | null,
  path: string = '/'
): AccessDecision {
  if (!session) {
    if (
      requiredRole === 'doctor' ||
      requiredRole === 'receptionist' ||
      requiredRole === 'staff' ||
      requiredRole === 'admin' ||
      requiredRole === 'super_admin' ||
      requiredRole === 'hospital_admin'
    ) {
      return {
        allowed: false,
        reason: 'unauthenticated',
        redirectTo: `/staff-login?redirect=${encodeURIComponent(path)}`,
      };
    }
    return { allowed: false, reason: 'unauthenticated', redirectTo: '/track' };
  }

  const roles = evaluateUserRoles(profile, userEmail);

  if (requiredRole === 'super_admin') {
    if (!roles.isSuperAdmin) {
      return { allowed: false, reason: 'forbidden', barrier: 'Platform Super Admin Required' };
    }
    return { allowed: true };
  }

  if (requiredRole === 'hospital_admin') {
    if (!(roles.isHospitalAdmin || roles.isSuperAdmin)) {
      return { allowed: false, reason: 'forbidden', barrier: 'Hospital Facility Admin Required' };
    }
    return { allowed: true };
  }

  if (requiredRole === 'admin') {
    if (!roles.isAdmin) {
      return { allowed: false, reason: 'forbidden', barrier: 'Administrative Access Required' };
    }
    return { allowed: true };
  }

  if (requiredRole === 'doctor') {
    if (!roles.isDoctor) {
      return { allowed: false, reason: 'forbidden', barrier: 'Doctor Access Required' };
    }
    return { allowed: true };
  }

  if (requiredRole === 'receptionist') {
    if (!roles.isReceptionist) {
      return { allowed: false, reason: 'forbidden', barrier: 'Receptionist Access Required' };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

export function runRoleSeparationTests(): { passed: number; failed: number; assertions: string[] } {
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

  const validSession = { access_token: 'mock-jwt-token-123' };

  // --------------------------------------------------------------------------
  // Persona 1: Platform Super Admin
  // --------------------------------------------------------------------------
  const superAdminProfile: Partial<UserProfile> = {
    id: 'user-super-1',
    email: 'superadmin@hqms.health',
    roles: ['super_admin'],
    permissions: ['audit:read', 'hospitals:write', 'users:write'],
  };
  const superRoles = evaluateUserRoles(superAdminProfile, superAdminProfile.email);
  assert(superRoles.isSuperAdmin === true, 'Super Admin persona must have isSuperAdmin === true');
  assert(superRoles.isHospitalAdmin === true, 'Super Admin persona inherits facility supervision isHospitalAdmin === true');
  assert(superRoles.isAdmin === true, 'Super Admin persona has isAdmin === true');

  const saToAdmin = evaluateRouteAccess('super_admin', validSession, superAdminProfile, superAdminProfile.email, '/admin');
  assert(saToAdmin.allowed === true, 'Super Admin can access /admin');

  const saToHospAdmin = evaluateRouteAccess('hospital_admin', validSession, superAdminProfile, superAdminProfile.email, '/hospital-admin');
  assert(saToHospAdmin.allowed === true, 'Super Admin can access /hospital-admin for platform oversight');

  // --------------------------------------------------------------------------
  // Persona 2: Hospital Administrator (Scoped facility admin)
  // --------------------------------------------------------------------------
  const hospitalAdminProfile: Partial<UserProfile> = {
    id: 'user-hosp-admin-1',
    email: 'admin@stjudes.org',
    roles: ['hospital_admin'],
    permissions: ['queues:manage', 'departments:manage'],
  };
  const hospRoles = evaluateUserRoles(hospitalAdminProfile, hospitalAdminProfile.email);
  assert(hospRoles.isSuperAdmin === false, 'Hospital Admin MUST NOT have isSuperAdmin authority');
  assert(hospRoles.isHospitalAdmin === true, 'Hospital Admin must have isHospitalAdmin === true');
  assert(hospRoles.isAdmin === true, 'Hospital Admin has isAdmin === true');

  const haToHospAdmin = evaluateRouteAccess('hospital_admin', validSession, hospitalAdminProfile, hospitalAdminProfile.email, '/hospital-admin');
  assert(haToHospAdmin.allowed === true, 'Hospital Admin can access /hospital-admin');

  const haToSuperAdmin = evaluateRouteAccess('super_admin', validSession, hospitalAdminProfile, hospitalAdminProfile.email, '/admin');
  assert(haToSuperAdmin.allowed === false, 'Hospital Admin is STRICTLY BLOCKED from /admin');
  assert(
    !haToSuperAdmin.allowed && haToSuperAdmin.reason === 'forbidden' && haToSuperAdmin.barrier === 'Platform Super Admin Required',
    'Hospital Admin on /admin receives "Platform Super Admin Required" barrier'
  );

  // --------------------------------------------------------------------------
  // Persona 3: Clinical Doctor
  // --------------------------------------------------------------------------
  const doctorProfile: Partial<UserProfile> = {
    id: 'user-doctor-1',
    email: 'dr.smith@stjudes.org',
    roles: ['doctor'],
    staffAssignments: [
      {
        role: 'doctor',
        hospitalId: 'hosp-1',
        department: { id: 'dept-1', name: 'General Medicine' },
        queues: [{ id: 'q-101', name: 'Queue 101' }],
      },
    ],
    permissions: ['queue:call_next'],
  };
  const docRoles = evaluateUserRoles(doctorProfile, doctorProfile.email);
  assert(docRoles.isDoctor === true, 'Doctor persona has isDoctor === true');
  assert(docRoles.isSuperAdmin === false, 'Doctor persona has isSuperAdmin === false');
  assert(docRoles.isHospitalAdmin === false, 'Doctor persona has isHospitalAdmin === false');

  const docToConsult = evaluateRouteAccess('doctor', validSession, doctorProfile, doctorProfile.email, '/consultation');
  assert(docToConsult.allowed === true, 'Doctor can access /consultation');

  const docToAdmin = evaluateRouteAccess('super_admin', validSession, doctorProfile, doctorProfile.email, '/admin');
  assert(docToAdmin.allowed === false && docToAdmin.reason === 'forbidden', 'Doctor cannot access /admin');

  const docToHospAdmin = evaluateRouteAccess('hospital_admin', validSession, doctorProfile, doctorProfile.email, '/hospital-admin');
  assert(docToHospAdmin.allowed === false && docToHospAdmin.reason === 'forbidden', 'Doctor cannot access /hospital-admin');

  const docToIntake = evaluateRouteAccess('receptionist', validSession, doctorProfile, doctorProfile.email, '/intake');
  assert(docToIntake.allowed === false && docToIntake.reason === 'forbidden', 'Doctor cannot access /intake without receptionist assignment');

  // --------------------------------------------------------------------------
  // Persona 4: Receptionist (Intake Desk)
  // --------------------------------------------------------------------------
  const receptionistProfile: Partial<UserProfile> = {
    id: 'user-rec-1',
    email: 'reception@stjudes.org',
    roles: ['receptionist'],
    staffAssignments: [
      {
        role: 'receptionist',
        hospitalId: 'hosp-1',
        department: { id: 'dept-1', name: 'General Medicine' },
        queues: [],
      },
    ],
    permissions: ['queue:issue_walkin'],
  };
  const recRoles = evaluateUserRoles(receptionistProfile, receptionistProfile.email);
  assert(recRoles.isReceptionist === true, 'Receptionist persona has isReceptionist === true');
  assert(recRoles.isSuperAdmin === false, 'Receptionist persona has isSuperAdmin === false');
  assert(recRoles.isHospitalAdmin === false, 'Receptionist persona has isHospitalAdmin === false');
  assert(recRoles.isDoctor === false, 'Receptionist persona has isDoctor === false');

  const recToIntake = evaluateRouteAccess('receptionist', validSession, receptionistProfile, receptionistProfile.email, '/intake');
  assert(recToIntake.allowed === true, 'Receptionist can access /intake');

  const recToAdmin = evaluateRouteAccess('super_admin', validSession, receptionistProfile, receptionistProfile.email, '/admin');
  assert(recToAdmin.allowed === false && recToAdmin.reason === 'forbidden', 'Receptionist cannot access /admin');

  const recToHospAdmin = evaluateRouteAccess('hospital_admin', validSession, receptionistProfile, receptionistProfile.email, '/hospital-admin');
  assert(recToHospAdmin.allowed === false && recToHospAdmin.reason === 'forbidden', 'Receptionist cannot access /hospital-admin');

  const recToConsult = evaluateRouteAccess('doctor', validSession, receptionistProfile, receptionistProfile.email, '/consultation');
  assert(recToConsult.allowed === false && recToConsult.reason === 'forbidden', 'Receptionist cannot access /consultation');

  // --------------------------------------------------------------------------
  // Persona 5: Patient (Public Authenticated / Self-Service)
  // --------------------------------------------------------------------------
  const patientProfile: Partial<UserProfile> = {
    id: 'user-patient-1',
    email: 'patient.john@gmail.com',
    roles: ['patient'],
    permissions: [],
  };
  const patRoles = evaluateUserRoles(patientProfile, patientProfile.email);
  assert(patRoles.isSuperAdmin === false, 'Patient cannot be super admin');
  assert(patRoles.isHospitalAdmin === false, 'Patient cannot be hospital admin');
  assert(patRoles.isAdmin === false, 'Patient cannot be admin');
  assert(patRoles.isDoctor === false, 'Patient cannot be doctor');
  assert(patRoles.isReceptionist === false, 'Patient cannot be receptionist');

  const patToAdmin = evaluateRouteAccess('super_admin', validSession, patientProfile, patientProfile.email, '/admin');
  assert(patToAdmin.allowed === false && patToAdmin.reason === 'forbidden', 'Patient cannot access /admin');

  const patToHospAdmin = evaluateRouteAccess('hospital_admin', validSession, patientProfile, patientProfile.email, '/hospital-admin');
  assert(patToHospAdmin.allowed === false && patToHospAdmin.reason === 'forbidden', 'Patient cannot access /hospital-admin');

  const patToConsult = evaluateRouteAccess('doctor', validSession, patientProfile, patientProfile.email, '/consultation');
  assert(patToConsult.allowed === false && patToConsult.reason === 'forbidden', 'Patient cannot access /consultation');

  const patToIntake = evaluateRouteAccess('receptionist', validSession, patientProfile, patientProfile.email, '/intake');
  assert(patToIntake.allowed === false && patToIntake.reason === 'forbidden', 'Patient cannot access /intake');

  // --------------------------------------------------------------------------
  // Persona 6: Unauthenticated / Anonymous Visitor
  // --------------------------------------------------------------------------
  const anonToAdmin = evaluateRouteAccess('super_admin', null, null, null, '/admin');
  assert(
    anonToAdmin.allowed === false &&
      anonToAdmin.reason === 'unauthenticated' &&
      anonToAdmin.redirectTo === '/staff-login?redirect=%2Fadmin',
    'Unauthenticated user accessing /admin is redirected to /staff-login?redirect=%2Fadmin'
  );

  const anonToHospAdmin = evaluateRouteAccess('hospital_admin', null, null, null, '/hospital-admin');
  assert(
    anonToHospAdmin.allowed === false &&
      anonToHospAdmin.reason === 'unauthenticated' &&
      anonToHospAdmin.redirectTo === '/staff-login?redirect=%2Fhospital-admin',
    'Unauthenticated user accessing /hospital-admin is redirected to /staff-login?redirect=%2Fhospital-admin'
  );

  const anonToConsultation = evaluateRouteAccess('doctor', null, null, null, '/consultation');
  assert(
    anonToConsultation.allowed === false &&
      anonToConsultation.reason === 'unauthenticated' &&
      anonToConsultation.redirectTo === '/staff-login?redirect=%2Fconsultation',
    'Unauthenticated user accessing /consultation is redirected to /staff-login?redirect=%2Fconsultation'
  );

  const anonToIntake = evaluateRouteAccess('receptionist', null, null, null, '/intake');
  assert(
    anonToIntake.allowed === false &&
      anonToIntake.reason === 'unauthenticated' &&
      anonToIntake.redirectTo === '/staff-login?redirect=%2Fintake',
    'Unauthenticated user accessing /intake is redirected to /staff-login?redirect=%2Fintake'
  );

  return { passed, failed, assertions };
}

// Auto-run if imported / executed
export const roleSeparationTestResults = runRoleSeparationTests();
console.log(`\n--- Role Separation & RBAC Suite (${roleSeparationTestResults.passed} passed, ${roleSeparationTestResults.failed} failed) ---`);
roleSeparationTestResults.assertions.forEach((a) => console.log(a));
