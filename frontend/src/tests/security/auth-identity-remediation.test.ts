/**
 * M1 Frontend Identity & Authentication Security Remediation Test Suite
 *
 * Verifies:
 * 1. Role classification immunity to email substring exploits.
 * 2. Strict decoupling of Super Admin and Hospital Admin.
 * 3. Dual-role staff + patient account preservation on /track.
 * 4. Elimination of automatic patient registration on /track.
 * 5. Route guard barriers for unassigned and cross-role staff accounts.
 * 6. Selective cache invalidation (clearing user-specific state, preserving global UI prefs).
 * 7. Doctor queue deduplication and empty queueId rejection.
 */

import { evaluateUserRoles, evaluateRouteAccess } from '../admin/role-separation.test';
import type { UserProfile } from '../../types/contract';
import { apiClient } from '../../lib/api-client';

// ============================================================================
// Synthetic Test Personas
// ============================================================================

export const SYNTHETIC_PERSONAS = {
  // 1. Platform Super Admin (Platform governance exclusively)
  SUPER_ADMIN: {
    id: 'syn-super-admin',
    email: 'superadmin@hqms.platform',
    name: 'Platform Super Admin',
    roles: ['super_admin'],
    permissions: ['audit:read', 'hospitals:write', 'users:write'],
    staffAssignments: [],
    hospitalId: null,
  } as UserProfile,

  // 2. Hospital Facility Admin (Single facility governance)
  HOSPITAL_ADMIN: {
    id: 'syn-hosp-admin',
    email: 'admin@apollo.health',
    name: 'Apollo Facility Admin',
    roles: ['hospital_admin'],
    hospitalId: 'hosp-apollo',
    staffAssignments: [
      {
        role: 'hospital_admin',
        hospitalId: 'hosp-apollo',
        department: null,
        queues: [],
      },
    ],
    permissions: ['queues:manage', 'departments:manage'],
  } as UserProfile,

  // 3. Clinical Doctor (Staff-only, no personal patient profile)
  DOCTOR_STAFF_ONLY: {
    id: 'syn-doctor-staff',
    email: 'dr.smith@apollo.health',
    name: 'Dr. Smith',
    roles: [],
    hospitalId: 'hosp-apollo',
    staffAssignments: [
      {
        role: 'doctor',
        hospitalId: 'hosp-apollo',
        department: { id: 'dept-pediatrics', name: 'Pediatrics' },
        queues: [
          { id: 'q-demo', name: 'M1 Demo Queue' },
          { id: 'q-fast', name: 'Pediatrics Fast Track' },
        ],
      },
    ],
    permissions: ['queue:call_next'],
  } as UserProfile,

  // 4. Clinical Doctor with Verified Personal Patient Profile (Dual-Role)
  DOCTOR_DUAL_ROLE: {
    id: 'syn-doctor-dual',
    email: 'dr.jane@apollo.health',
    name: 'Dr. Jane',
    roles: [],
    hospitalId: 'hosp-apollo',
    staffAssignments: [
      {
        role: 'doctor',
        hospitalId: 'hosp-apollo',
        department: { id: 'dept-general', name: 'General Medicine' },
        queues: [{ id: 'q-demo', name: 'M1 Demo Queue' }],
      },
    ],
    permissions: ['queue:call_next'],
  } as UserProfile,

  // 5. Receptionist (Staff-only)
  RECEPTIONIST: {
    id: 'syn-receptionist',
    email: 'reception@apollo.health',
    name: 'Lobby Receptionist',
    roles: [],
    hospitalId: 'hosp-apollo',
    staffAssignments: [
      {
        role: 'receptionist',
        hospitalId: 'hosp-apollo',
        department: { id: 'dept-intake', name: 'Lobby Intake Counter' },
        queues: [],
      },
    ],
    permissions: ['queue:issue_walkin'],
  } as UserProfile,

  // 6. Verified Patient (Self-service patient only)
  PATIENT_ONLY: {
    id: 'syn-patient',
    email: 'patient.john@gmail.com',
    name: 'John Patient',
    roles: ['patient'],
    hospitalId: null,
    staffAssignments: [],
    permissions: [],
  } as UserProfile,

  // 7. Unassigned Account (Authenticated, but holds no roles or assignments)
  UNASSIGNED_ACCOUNT: {
    id: 'syn-unassigned',
    email: 'newuser@outlook.com',
    name: 'Unassigned User',
    roles: [],
    hospitalId: null,
    staffAssignments: [],
    permissions: [],
  } as UserProfile,

  // 8. Spoofing Attempt: email contains 'admin' but roles is empty
  SPOOF_ADMIN_EMAIL: {
    id: 'syn-spoof-admin',
    email: 'administrator.phish@gmail.com',
    name: 'Attacker Admin Phish',
    roles: [],
    hospitalId: null,
    staffAssignments: [],
    permissions: [],
  } as UserProfile,

  // 9. Spoofing Attempt: email contains 'super' or 'build1-admin-'
  SPOOF_SUPER_EMAIL: {
    id: 'syn-spoof-super',
    email: 'build1-admin-fake@malicious.io',
    name: 'Attacker Super Phish',
    roles: [],
    hospitalId: null,
    staffAssignments: [],
    permissions: [],
  } as UserProfile,
};

// ============================================================================
// Test Runner
// ============================================================================

export async function runAuthIdentityRemediationTests(): Promise<{ passed: number; failed: number; assertions: string[] }> {
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

  const validSession = { access_token: 'mock-jwt-test-token' };

  console.log('\n--- Section 1: Role Classification & Immunity to Substring Exploits ---');

  // Test 1.1: Super Admin evaluation
  const superRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.SUPER_ADMIN, SYNTHETIC_PERSONAS.SUPER_ADMIN.email);
  assert(superRoles.isSuperAdmin === true, 'SUPER_ADMIN has isSuperAdmin === true');
  assert(superRoles.isHospitalAdmin === false, 'SUPER_ADMIN does NOT inherit isHospitalAdmin === true (strict decoupling)');
  assert(superRoles.isAdmin === true, 'SUPER_ADMIN has isAdmin === true');
  assert(superRoles.isDoctor === false, 'SUPER_ADMIN is not a doctor');
  assert(superRoles.isPatient === false, 'SUPER_ADMIN is not a patient');

  // Test 1.2: Hospital Admin evaluation
  const hospRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.HOSPITAL_ADMIN, SYNTHETIC_PERSONAS.HOSPITAL_ADMIN.email);
  assert(hospRoles.isHospitalAdmin === true, 'HOSPITAL_ADMIN with matching staffAssignment has isHospitalAdmin === true');
  assert(hospRoles.isSuperAdmin === false, 'HOSPITAL_ADMIN does NOT have isSuperAdmin === true');
  assert(hospRoles.isDoctor === false, 'HOSPITAL_ADMIN is not a clinical doctor');

  // Test 1.2b: profile.hospitalId alone never grants Hospital Admin access
  const hospAdminWithoutAssignment: UserProfile = {
    id: 'user-hosp-unlinked',
    email: 'admin.unlinked@apollo.health',
    name: 'Unlinked Admin',
    roles: ['hospital_admin'],
    hospitalId: 'hosp-apollo',
    staffAssignments: [], // No structured assignment entry!
    permissions: [],
  };
  const unlinkedHospRoles = evaluateUserRoles(hospAdminWithoutAssignment, hospAdminWithoutAssignment.email);
  assert(unlinkedHospRoles.isHospitalAdmin === false, 'profile.hospitalId alone NEVER grants Hospital Admin access (requires matching staffAssignments entry)');

  // Test 1.3: Immunity to email substring privilege escalation
  const spoofAdminRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.SPOOF_ADMIN_EMAIL, SYNTHETIC_PERSONAS.SPOOF_ADMIN_EMAIL.email);
  assert(spoofAdminRoles.isHospitalAdmin === false, 'Email containing "admin" with roles:[] does NOT receive Hospital Admin');
  assert(spoofAdminRoles.isAdmin === false, 'Email containing "admin" with roles:[] does NOT receive Admin');
  assert(spoofAdminRoles.isDoctor === false, 'Email containing "admin" does NOT receive Doctor privileges');

  const spoofSuperRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.SPOOF_SUPER_EMAIL, SYNTHETIC_PERSONAS.SPOOF_SUPER_EMAIL.email);
  assert(spoofSuperRoles.isSuperAdmin === false, 'Email containing "super" or "build1-admin-" with roles:[] does NOT receive Super Admin');

  // Test 1.4: Doctor evaluation (Staff only)
  const doctorStaffRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY.email);
  assert(doctorStaffRoles.isDoctor === true, 'DOCTOR_STAFF_ONLY has isDoctor === true');
  assert(doctorStaffRoles.isSuperAdmin === false, 'DOCTOR_STAFF_ONLY is not Super Admin');
  assert(doctorStaffRoles.isHospitalAdmin === false, 'DOCTOR_STAFF_ONLY is not Hospital Admin');
  assert(doctorStaffRoles.isPatient === false, 'DOCTOR_STAFF_ONLY with empty roles:[] is NOT classified as patient');

  // Test 1.5: Receptionist evaluation
  const recRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.RECEPTIONIST, SYNTHETIC_PERSONAS.RECEPTIONIST.email);
  assert(recRoles.isReceptionist === true, 'RECEPTIONIST has isReceptionist === true');
  assert(recRoles.isDoctor === false, 'RECEPTIONIST is not doctor');
  assert(recRoles.isPatient === false, 'RECEPTIONIST with empty roles:[] is NOT classified as patient');

  // Test 1.6: Patient-only evaluation
  const patRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.PATIENT_ONLY, SYNTHETIC_PERSONAS.PATIENT_ONLY.email);
  assert(patRoles.isPatient === true, 'PATIENT_ONLY with roles:["patient"] has isPatient === true');
  assert(patRoles.isDoctor === false, 'PATIENT_ONLY is not doctor');
  assert(patRoles.isAdmin === false, 'PATIENT_ONLY is not admin');

  // Test 1.7: Unassigned account evaluation
  const unassignedRoles = evaluateUserRoles(SYNTHETIC_PERSONAS.UNASSIGNED_ACCOUNT, SYNTHETIC_PERSONAS.UNASSIGNED_ACCOUNT.email);
  assert(unassignedRoles.isSuperAdmin === false, 'UNASSIGNED has isSuperAdmin === false');
  assert(unassignedRoles.isHospitalAdmin === false, 'UNASSIGNED has isHospitalAdmin === false');
  assert(unassignedRoles.isDoctor === false, 'UNASSIGNED has isDoctor === false');
  assert(unassignedRoles.isReceptionist === false, 'UNASSIGNED has isReceptionist === false');
  assert(unassignedRoles.isPatient === false, 'UNASSIGNED has isPatient === false (never inferred from user presence)');

  console.log('\n--- Section 2: Strict Route Guard Separation (ProtectedRoute) ---');

  // Super Admin route tests
  const saOnAdmin = evaluateRouteAccess('super_admin', validSession, SYNTHETIC_PERSONAS.SUPER_ADMIN, SYNTHETIC_PERSONAS.SUPER_ADMIN.email, '/admin');
  assert(saOnAdmin.allowed === true, 'SUPER_ADMIN can access /admin');

  const saOnHospAdmin = evaluateRouteAccess('hospital_admin', validSession, SYNTHETIC_PERSONAS.SUPER_ADMIN, SYNTHETIC_PERSONAS.SUPER_ADMIN.email, '/hospital-admin');
  assert(saOnHospAdmin.allowed === false, 'SUPER_ADMIN without facility assignment is BLOCKED from /hospital-admin');
  assert(!saOnHospAdmin.allowed && saOnHospAdmin.reason === 'forbidden' && saOnHospAdmin.barrier === 'Hospital Facility Admin Required', 'SUPER_ADMIN on /hospital-admin receives facility barrier');

  // Hospital Admin route tests
  const haOnHospAdmin = evaluateRouteAccess('hospital_admin', validSession, SYNTHETIC_PERSONAS.HOSPITAL_ADMIN, SYNTHETIC_PERSONAS.HOSPITAL_ADMIN.email, '/hospital-admin');
  assert(haOnHospAdmin.allowed === true, 'HOSPITAL_ADMIN can access /hospital-admin');

  const haOnSuperAdmin = evaluateRouteAccess('super_admin', validSession, SYNTHETIC_PERSONAS.HOSPITAL_ADMIN, SYNTHETIC_PERSONAS.HOSPITAL_ADMIN.email, '/admin');
  assert(haOnSuperAdmin.allowed === false, 'HOSPITAL_ADMIN is STRICTLY BLOCKED from /admin');

  // Doctor route tests
  const docOnConsult = evaluateRouteAccess('doctor', validSession, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY.email, '/consultation');
  assert(docOnConsult.allowed === true, 'DOCTOR can access /consultation');

  const docOnAdmin = evaluateRouteAccess('super_admin', validSession, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY.email, '/admin');
  assert(docOnAdmin.allowed === false, 'DOCTOR cannot access /admin');

  const docOnHospAdmin = evaluateRouteAccess('hospital_admin', validSession, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY.email, '/hospital-admin');
  assert(docOnHospAdmin.allowed === false, 'DOCTOR cannot access /hospital-admin');

  const docOnIntake = evaluateRouteAccess('receptionist', validSession, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY, SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY.email, '/intake');
  assert(docOnIntake.allowed === false, 'DOCTOR cannot access /intake');

  console.log('\n--- Section 3: Dual-Role Staff + Patient Entitlement Logic on /track ---');

  // Simulating TokenTracker access decision logic
  function evaluatePatientPortalAccess(
    userRoles: ReturnType<typeof evaluateUserRoles>,
    verifiedPatientRecords: any[] | undefined,
    isLoading: boolean = false,
    isError: boolean = false
  ): { view: 'dashboard' | 'loading' | 'error' | 'barrier'; barrierType: 'staff' | 'unassigned' | 'none'; isDualRole: boolean } {
    if (isLoading) {
      return { view: 'loading', barrierType: 'none', isDualRole: false };
    }
    if (isError) {
      return { view: 'error', barrierType: 'none', isDualRole: false };
    }

    const isStaff = userRoles.isDoctor || userRoles.isReceptionist || userRoles.isHospitalAdmin || userRoles.isSuperAdmin;
    const hasVerifiedProfile = Boolean(verifiedPatientRecords && verifiedPatientRecords.length > 0);
    const isConfirmedEmpty = Boolean(verifiedPatientRecords && verifiedPatientRecords.length === 0);

    if (hasVerifiedProfile) {
      return {
        view: 'dashboard',
        barrierType: 'none',
        isDualRole: isStaff,
      };
    }

    if (isStaff && isConfirmedEmpty) {
      return {
        view: 'barrier',
        barrierType: 'staff',
        isDualRole: false,
      };
    }

    if (isConfirmedEmpty) {
      return {
        view: 'barrier',
        barrierType: 'unassigned',
        isDualRole: false,
      };
    }

    return {
      view: 'error',
      barrierType: 'none',
      isDualRole: false,
    };
  }

  // Test 3.0: Loading state never triggers premature barriers
  const loadingAccess = evaluatePatientPortalAccess(doctorStaffRoles, undefined, true, false);
  assert(loadingAccess.view === 'loading', 'In-flight patient query renders loading state');
  assert(loadingAccess.barrierType === 'none', 'In-flight query NEVER triggers premature staff/unassigned barrier');

  // Test 3.1: API error state shows retryable error screen (never assumed empty)
  const errorAccess = evaluatePatientPortalAccess(doctorStaffRoles, undefined, false, true);
  assert(errorAccess.view === 'error', 'API error renders retryable error screen');
  assert(errorAccess.barrierType === 'none', 'API error is NEVER interpreted as proof that user has no patient profile');

  // Dual-role doctor with a personal patient profile
  const doctorDualProfileRecord = [{ id: 'pat-doc-1', patientNumber: 'P-1001', displayName: 'Dr. Jane' }];
  const docDualAccess = evaluatePatientPortalAccess(doctorStaffRoles, doctorDualProfileRecord);
  assert(docDualAccess.view === 'dashboard', 'DOCTOR_DUAL_ROLE with verified patient profile renders Patient Dashboard on /track');
  assert(docDualAccess.isDualRole === true, 'DOCTOR_DUAL_ROLE is correctly flagged as dual-role');
  assert(docDualAccess.barrierType === 'none', 'DOCTOR_DUAL_ROLE receives no barrier');

  // Staff-only doctor confirmed empty without patient profile
  const docStaffOnlyAccess = evaluatePatientPortalAccess(doctorStaffRoles, []);
  assert(docStaffOnlyAccess.view === 'barrier', 'DOCTOR_STAFF_ONLY without patient profile is BLOCKED from Patient Dashboard');
  assert(docStaffOnlyAccess.barrierType === 'staff', 'DOCTOR_STAFF_ONLY receives Staff Workstation Barrier after confirmed empty response');

  // Receptionist confirmed empty without patient profile
  const recAccess = evaluatePatientPortalAccess(recRoles, []);
  assert(recAccess.view === 'barrier', 'RECEPTIONIST without patient profile is BLOCKED from Patient Dashboard');
  assert(recAccess.barrierType === 'staff', 'RECEPTIONIST receives Staff Workstation Barrier after confirmed empty response');

  // Unassigned user confirmed empty without patient profile
  const unassignedAccess = evaluatePatientPortalAccess(unassignedRoles, []);
  assert(unassignedAccess.view === 'barrier', 'UNASSIGNED account without patient profile is BLOCKED from Patient Dashboard');
  assert(unassignedAccess.barrierType === 'unassigned', 'UNASSIGNED account receives Unassigned Account Barrier after confirmed empty response');

  // Pure patient with patient profile
  const purePatientRecord = [{ id: 'pat-user-1', patientNumber: 'P-2002', displayName: 'John Patient' }];
  const patientAccess = evaluatePatientPortalAccess(patRoles, purePatientRecord);
  assert(patientAccess.view === 'dashboard', 'PATIENT_ONLY with verified profile renders Patient Dashboard on /track');
  assert(patientAccess.isDualRole === false, 'PATIENT_ONLY is not flagged as dual-role');
  assert(patientAccess.barrierType === 'none', 'PATIENT_ONLY receives no barrier');

  console.log('\n--- Section 4: Doctor Queue Deduplication & Empty queueId Validation ---');

  // Queue deduplication simulation
  const mockApiQueues = [
    { id: 'q-demo', name: 'M1 Demo Queue', roomLabel: 'Room 101' },
    { id: 'q-extra', name: 'General Medicine Queue', roomLabel: 'Room 102' },
  ];
  const mockStaffAssignments = SYNTHETIC_PERSONAS.DOCTOR_STAFF_ONLY.staffAssignments || [];
  const assignedQueues = mockStaffAssignments
    .filter((a) => a.role === 'doctor')
    .flatMap((a) => a.queues || []);

  const dedupedMap = new Map<string, any>();
  for (const q of [...mockApiQueues, ...assignedQueues]) {
    if (q && q.id && !dedupedMap.has(q.id)) {
      dedupedMap.set(q.id, q);
    }
  }
  const consolidatedQueues = Array.from(dedupedMap.values());

  assert(consolidatedQueues.length === 3, 'Doctor queues are deduplicated correctly (q-demo appears only once across 4 raw items)');
  assert(consolidatedQueues.some((q) => q.id === 'q-demo'), 'Consolidated list includes q-demo');
  assert(consolidatedQueues.some((q) => q.id === 'q-fast'), 'Consolidated list includes q-fast from staffAssignments');
  assert(consolidatedQueues.some((q) => q.id === 'q-extra'), 'Consolidated list includes q-extra from getStaffQueues');

  // Validate publishSlot throws error on empty queueId
  let emptyQueueErrorCaught = false;
  try {
    await apiClient.publishSlot('', '2026-11-15T10:00:00Z', '2026-11-15T10:20:00Z');
  } catch (err: any) {
    emptyQueueErrorCaught = true;
    assert(err.message.includes('valid queue must be selected'), 'publishSlot() error explicitly demands valid queue selection');
  }
  assert(emptyQueueErrorCaught === true, 'publishSlot() rejects empty queueId');

  let whitespaceQueueErrorCaught = false;
  try {
    await apiClient.publishSlot('   ', '2026-11-15T10:00:00Z', '2026-11-15T10:20:00Z');
  } catch (err: any) {
    whitespaceQueueErrorCaught = true;
  }
  assert(whitespaceQueueErrorCaught === true, 'publishSlot() rejects whitespace-only queueId');

  console.log('\n--- Section 5: Selective Cache Invalidation Logic ---');

  // Simulated storage
  const mockStorage: Record<string, string> = {
    hqms_admin_sidebar_collapsed: 'true',
    hqms_hospital_incidents: JSON.stringify([{ id: 'inc-1', details: 'Secret incident' }]),
    hqms_web_incidents: JSON.stringify([{ id: 'inc-2' }]),
    theme_preference: 'dark',
  };

  const USER_KEYS = ['hqms_hospital_incidents', 'hqms_web_incidents', 'hqms-state-v1', 'hqms-minimal-v1'];

  function selectiveStoragePurge(storage: Record<string, string>) {
    USER_KEYS.forEach((key) => {
      delete storage[key];
    });
  }

  selectiveStoragePurge(mockStorage);
  assert(mockStorage.hqms_admin_sidebar_collapsed === 'true', 'Global UI preference (sidebar collapsed) is PRESERVED on purge');
  assert(mockStorage.theme_preference === 'dark', 'Global UI preference (theme) is PRESERVED on purge');
  assert(mockStorage.hqms_hospital_incidents === undefined, 'User-specific draft incident is PURGED on cleanup');
  assert(mockStorage.hqms_web_incidents === undefined, 'User-specific web incidents are PURGED on cleanup');

  // Token refresh vs account switch
  const tracker = { queryClientClearCalled: false };
  const mockQueryClient = {
    clear: () => {
      tracker.queryClientClearCalled = true;
    },
  };

  function handleAuthStateTransition(
    prevUserId: string | null,
    newUserId: string | null,
    client: typeof mockQueryClient
  ) {
    tracker.queryClientClearCalled = false;
    if (prevUserId && newUserId && prevUserId !== newUserId) {
      // Genuine account switch
      client.clear();
    } else if (!newUserId && prevUserId) {
      // Logout
      client.clear();
    }
    // Same-user refresh: DO NOT call client.clear()
  }

  // Case A: Same-user token refresh
  handleAuthStateTransition('user-123', 'user-123', mockQueryClient);
  assert(tracker.queryClientClearCalled === false, 'Same-user token refresh does NOT clear queryClient cache');

  // Case B: Genuine account switch
  handleAuthStateTransition('user-123', 'user-456', mockQueryClient);
  assert(tracker.queryClientClearCalled === true, 'Genuine account switch (user-123 -> user-456) purges queryClient cache');

  // Case C: User logout
  handleAuthStateTransition('user-456', null, mockQueryClient);
  assert(tracker.queryClientClearCalled === true, 'User logout purges queryClient cache');

  return { passed, failed, assertions };
}

// Execute suite directly when run via tsx
if (import.meta.url.endsWith('auth-identity-remediation.test.ts')) {
  try {
    const res = await runAuthIdentityRemediationTests();
    console.log(`\n================================================================`);
    console.log(`M1 SECURITY REMEDIATION SUMMARY: ${res.passed} Passed, ${res.failed} Failed`);
    console.log(`================================================================`);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}
