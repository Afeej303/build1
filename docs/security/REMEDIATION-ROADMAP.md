# HQMS Security Remediation Roadmap & Ownership Matrix
**Audit Date:** 2026-11-14  
**Auditor / Orchestrator:** M1 Main Orchestrator  
**Repository:** `https://github.com/Afeej303/build1.git`  
**Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426`  
**Purpose:** Actionable, prioritized engineering plan to remediate all confirmed vulnerabilities and establish verified regression boundaries.

---

## 1. Ownership & Authority Matrix

| Module / Scope | Owner | Responsibilities |
|---|---|---|
| **Frontend & Client Auth Integration** | **M1** | Client role resolution, session cache eviction, workstation route guards, patient portal barriers, queue selection UI, API client validation. |
| **Backend API & Database Security** | **M2** | NestJS controller guards, role/permission resolvers, Prisma migrations, Supabase RLS policies, rate limiting decorators. |
| **Platform Infrastructure & Tooling** | **M3** | Swagger environment gating, production CSP headers, Redis throttler storage, dead code removal. |
| **Overall Governance & Verification** | **M1 Orchestrator** | Pre-merge verification, regression suite sign-off, staging smoke testing. |

---

## 2. Remediation Priority Schedule

```
+---------------------------------------------------------------------------------+
| PHASE 1: Priority P0 — Immediate Blockers (Critical Vulnerabilities & Bugs)      |
| Target: Immediate turn execution upon user authorization                        |
+---------------------------------------------------------------------------------+
| PHASE 2: Priority P1 — Architectural Hardening (Identity & Database RLS)         |
| Target: Milestone 2 synchronization                                             |
+---------------------------------------------------------------------------------+
| PHASE 3: Priority P2 — Infrastructure & Operational Hardening                    |
| Target: Production release preparation                                          |
+---------------------------------------------------------------------------------+
```

---

## 3. Detailed Remediation Plan

### Phase 1: Priority P0 (Immediate Execution)

#### P0-1: Eliminate Email Substring Matching & Fix Role Resolution (`SEC-AUTH-01`, `SEC-AUTH-06`)
- **Owner:** M1
- **Files:** `frontend/src/lib/auth.tsx`, `frontend/src/pages/StaffLoginPage.tsx`
- **Actions:**
  1. Remove `user?.email?.toLowerCase().includes('admin')`.
  2. Remove `r.toLowerCase().includes('admin')` from `isDoctor` resolution.
  3. Enforce that `isDoctor` requires an active doctor entry in `profile.staffAssignments` or an explicit `doctor` role.
  4. Enforce that `isHospitalAdmin` requires an assigned hospital in `profile.staffAssignments` or an explicit `hospital_admin` role.
- **Verification:** Execute `frontend/src/tests/security/auth-privilege-escalation.test.ts`.

#### P0-2: Evict TanStack Query Cache on Sign-Out (`SEC-SESS-01`)
- **Owner:** M1
- **Files:** `frontend/src/lib/auth.tsx`, `frontend/src/App.tsx`
- **Actions:**
  1. Inject `queryClient` into `AuthProvider`.
  2. In `signOut()`, synchronously call:
     ```typescript
     queryClient.clear();
     queryClient.removeQueries();
     ```
- **Verification:** Automated test asserting all query caches are undefined after `signOut()`.

#### P0-3: Stop Staff Auto-Registration & Guard Patient Tracker (`SEC-AUTH-02`, `SEC-AUTH-05`)
- **Owner:** M1
- **Files:** `frontend/src/features/patient/TokenTracker.tsx`
- **Actions:**
  1. Delete lines 389–394 (the `useEffect` triggering `registerPatientMutation.mutate()`).
  2. Add an explicit Access Restriction Screen: If the authenticated user is staff (`isDoctor || isReceptionist || isHospitalAdmin || isSuperAdmin`) and has no patient profile, block the dashboard and present redirect buttons to their workstation (`/consultation`, `/intake`, `/admin`).
- **Verification:** Verify that loading `/track` with a staff login issues zero `POST /patients/self` network calls.

#### P0-4: Fix User Directory Role Display (`SEC-AUTH-04`)
- **Owner:** M1
- **Files:** `frontend/src/features/super-admin/GlobalUserDirectory.tsx`, `frontend/src/services/superAdminService.ts`
- **Actions:**
  1. Remove `['patient']` default fallback from `fetchUsers()`.
  2. In `GlobalUserDirectory.tsx`, display **Global Roles** and **Staff Assignments** separately.
  3. When `roles` is empty, render `—` (None). Never infer patient status from an empty roles array.
- **Verification:** Super Admin user directory displays Doctor badges for `build1-doctor-4d1422a8`.

#### P0-5: Fix Doctor Queue Selection & Slot Publishing URL (`SEC-API-01`)
- **Owner:** M1
- **Files:** `frontend/src/features/doctor/DoctorConsole.tsx`, `frontend/src/lib/api-client.ts`
- **Actions:**
  1. Combine queues from `apiClient.getStaffQueues()` with `profile.staffAssignments` so both assigned queues are immediately available.
  2. Add Queue Selector `<select>` inside the "Publish Appointment Availability" modal.
  3. Validate that `selectedQueueId` is non-empty before mutation.
  4. In `apiClient.publishSlot()`, guard against empty `queueId`.
- **Verification:** Publish slot dispatches valid URL `POST /queues/<uuid>/appointment-slots`.

---

### Phase 2: Priority P1 (Milestone 2 Synchronization)

#### P1-1: Apply Complete Database RLS Policies (`SEC-RLS-01`)
- **Owner:** M2
- **Files:** `backend/prisma/migrations/20261115000000_supabase_rls_hardening/migration.sql`
- **Actions:**
  1. Enable RLS on `frontend_incidents`.
  2. Revoke all direct PostgREST table, sequence, and function access from `anon` and `authenticated` roles in a formal migration.
  3. Define explicit owner-scoped policies for any tables intended for direct client query.
- **Verification:** PostgREST direct curl requests receive HTTP 401/403.

#### P1-2: Add Dedicated Rate Limiting to Clinical Endpoints (`SEC-RATE-01`)
- **Owner:** M2
- **Files:** `backend/src/hospital/appointments.controller.ts`, `backend/src/hospital/hospital.controller.ts`
- **Actions:**
  1. Decorate `POST /appointments` with `@Throttle({ default: { limit: 15, ttl: 60000 } })`.
  2. Decorate `POST /walk-ins` with `@Throttle({ default: { limit: 15, ttl: 60000 } })`.
  3. Decorate `GET /staff/patients/lookup` with `@Throttle({ default: { limit: 25, ttl: 60000 } })`.
- **Verification:** Test 16th rapid request returns HTTP 429.

#### P1-3: Include Staff Assignments in Directory Endpoint (`SEC-AUTH-04`)
- **Owner:** M2
- **Files:** `backend/src/users/users.service.ts`
- **Actions:**
  1. In `listUsers()`, include `receptionistDepartments` and `doctorQueues` to return `staffAssignments` alongside `userRoles`.
- **Verification:** `GET /users` returns `staffAssignments` array for all hospital staff.

---

### Phase 3: Priority P2 (Infrastructure Hardening)

#### P2-1: Environment-Gate Swagger Documentation (`SEC-INFRA-01`)
- **Owner:** M3
- **Files:** `backend/src/main.ts`
- **Actions:** Disable or password-protect `/docs` when `NODE_ENV === 'production'`.

#### P2-2: Add `hospitalId` to Incidents Schema (`SEC-INPUT-01`)
- **Owner:** M2
- **Files:** `backend/prisma/schema.prisma`
- **Actions:** Add `hospitalId UUID? REFERENCES "Hospital"(id)` to `frontend_incidents`.

#### P2-3: Remove Legacy Prototype Files (`SEC-FRONT-01`)
- **Owner:** M1
- **Files:** `frontend/src/lib/hqms.ts`, `frontend/src/components/PortalGateway.tsx`
- **Actions:** Delete unused dead code.

---

## 4. Controlled Implementation Workflow

1. **User Sign-Off:** Review the Security Executive Summary and Findings.
2. **Phase 1 Execution (M1):** M1 implements client-side and auth integration corrections (P0-1 through P0-5).
3. **Phase 1 Automated Verification:** Run full test suite:
   ```bash
   npx tsx C:\build\frontend\src\tests\admin\index.ts
   npm --prefix C:\build\frontend run build
   ```
4. **Phase 2 Handoff (M2):** M2 applies database RLS migration and backend controller throttling decorators.
5. **Phase 3 Verification & Delivery:** M1 verifies end-to-end flows with synthetic test identities.
