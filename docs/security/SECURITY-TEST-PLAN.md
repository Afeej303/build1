# HQMS Automated Security Verification & Regression Test Plan
**Audit Date:** 2026-11-14  
**Auditor / Orchestrator:** M1 Main Orchestrator  
**Repository:** `https://github.com/Afeej303/build1.git`  
**Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426`  
**Purpose:** Define programmatic, reproducible security test specifications to prevent regressions of all identified vulnerabilities.

---

## 1. Test Suite Architecture

All security test suites execute non-destructively using synthetic test identities and in-memory mock or staging API interfaces without altering production data.

Test suites are structured under:
- `frontend/src/tests/security/auth-privilege-escalation.test.ts`
- `frontend/src/tests/security/patient-portal-barrier.test.ts`
- `frontend/src/tests/security/cache-isolation.test.ts`
- `frontend/src/tests/security/queue-slot-publishing.test.ts`
- `backend/test/security/cross-tenant-isolation.e2e-spec.ts`
- `backend/test/security/rate-limiting.e2e-spec.ts`
- `backend/test/security/rls-direct-access.e2e-spec.ts`

---

## 2. Test Specifications by Finding

### Suite 1: Email Substring & Role Escalation (`SEC-AUTH-01`, `SEC-AUTH-06`)
- **File:** `frontend/src/tests/security/auth-privilege-escalation.test.ts`
- **Assertions:**
  1. User with email `badminton.club@gmail.com` and `roles: []` evaluates to `isHospitalAdmin === false`.
  2. User with email `admin.assistant@supplier.org` and `roles: []` evaluates to `isHospitalAdmin === false`.
  3. Super Admin account with `roles: ['super_admin']` and `staffAssignments: []` evaluates to `isDoctor === false`.
  4. Hospital Admin account with `roles: ['hospital_admin']` and `staffAssignments: []` evaluates to `isDoctor === false`.
  5. User with `roles: []` and `staffAssignments: [{ role: 'doctor', queues: ['q-1'] }]` evaluates to `isDoctor === true` and `isHospitalAdmin === false`.

### Suite 2: Patient Portal Barrier & Non-Auto-Registration (`SEC-AUTH-02`, `SEC-AUTH-03`, `SEC-AUTH-05`)
- **File:** `frontend/src/tests/security/patient-portal-barrier.test.ts`
- **Assertions:**
  1. Mounting `TokenTracker` with a staff-only doctor session (`isDoctor === true`, `patients: []`) triggers **zero** `POST /patients/self` network calls.
  2. Mounting `TokenTracker` with a staff-only session displays the Staff Restriction Barrier and does not render the active queue tracker tabs.
  3. Account with `roles: []` and `staffAssignments: []` and no patient profile evaluates `isPatient === false` until a patient profile is registered.
  4. Super Admin navigating to `/track` is presented with staff workstation redirect options instead of patient onboarding.

### Suite 3: Query Cache Eviction & Session Isolation (`SEC-SESS-01`)
- **File:** `frontend/src/tests/security/cache-isolation.test.ts`
- **Assertions:**
  1. Populating TanStack Query cache with query key `['doctor-queues']` and invoking `signOut()` completely empties the cache (`queryClient.getQueryData(['doctor-queues']) === undefined`).
  2. Query key `['myPatients']` is purged synchronously during `signOut()`.
  3. Account switch from User A to User B initializes with empty cache states.

### Suite 4: Doctor Queue Slot Publishing Validation (`SEC-API-01`)
- **File:** `frontend/src/tests/security/queue-slot-publishing.test.ts`
- **Assertions:**
  1. Calling `apiClient.publishSlot('', '2026-11-15T10:00:00', '2026-11-15T10:30:00')` immediately throws an error: `"queueId is required"` without sending an HTTP request.
  2. Calling `apiClient.publishSlot('   ', ...)` throws validation error.
  3. `DoctorConsole` derives queues from both `apiClient.getStaffQueues()` and `profile.staffAssignments` to ensure assigned queues are selectable.

### Suite 5: Cross-Tenant Isolation (`SEC-RLS-01`, `API-AUTHORIZATION-MATRIX`)
- **File:** `backend/test/security/cross-tenant-isolation.e2e-spec.ts`
- **Assertions:**
  1. Hospital Admin A requests `GET /admin/hospitals/:hospitalB/report`: Expect HTTP 404/403.
  2. Hospital Admin A requests `GET /admin/hospitals/:hospitalB/activity`: Expect HTTP 404/403.
  3. Hospital Admin A requests `POST /admin/hospitals/:hospitalB/departments`: Expect HTTP 404/403.
  4. Doctor A requests `POST /queues/:queueB/call-next`: Expect HTTP 403.
  5. Receptionist A requests `POST /walk-ins` for queue in Hospital B: Expect HTTP 403.

### Suite 6: Rate Limiting & Abuse Prevention (`SEC-RATE-01`)
- **File:** `backend/test/security/rate-limiting.e2e-spec.ts`
- **Assertions:**
  1. Dispatching 16 rapid requests to `POST /walk-ins` returns HTTP 429 Too Many Requests on the 16th request.
  2. Dispatching 16 rapid requests to `POST /appointments` returns HTTP 429 on the 16th request.
  3. Dispatching 25 rapid requests to `GET /staff/patients/lookup` returns HTTP 429.

---

## 3. Execution Command
To run the automated security suites once implemented:
```bash
# Frontend Security Suites
npx tsx C:\build\frontend\src\tests\security\index.ts

# Consolidated Admin & Security Regression
npx tsx C:\build\frontend\src\tests\admin\index.ts
```
