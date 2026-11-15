# HQMS Security Audit — Executive Summary
**Date:** 2026-11-14  
**Auditor / Orchestrator:** M1 Main Orchestrator  
**Target Repository:** `https://github.com/Afeej303/build1.git`  
**Target Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426` (Branch: `main`)  
**Scope:** Full Application Security Assessment (NestJS Backend, React/Vite Frontend, PostgreSQL/Prisma Database, Supabase Auth & RLS)  
**Mode:** READ-ONLY Verification (Zero Destructive Testing, Zero File Modifications)

---

## 1. Executive Overview

HQMS (Hospital Queue & Appointment Management System) is a multi-tenant clinical SaaS platform providing patient registration, live queue tracking, doctor clinical workstations, reception walk-in intake, public waiting room signage, and administrative governance across multiple hospitals.

This comprehensive security audit was conducted as a foundational, read-only security assessment across the entire codebase. The audit inspected 56 backend API endpoints across 12 controllers, 26 database entities across 12 migrations, Supabase authorization policies, frontend state management, browser cache isolation, and infrastructure configuration.

### Overall Assessment
The platform exhibits strong architectural separation between public endpoints, staff workstations, and multi-tenant administrative modules. Multi-tenant database queries in the backend generally enforce scoping via `Prisma` transactions. However, **critical vulnerabilities and logic flaws exist at the intersection of Supabase identity resolution, frontend role inference, database RLS policies, and cache invalidation.**

---

## 2. Key Audit Metrics & Statistics

```
+-------------------------------------------------------------+
| TOTAL ENDPOINTS AUDITED:        56                          |
| TOTAL DATABASE TABLES AUDITED:  26                          |
| TOTAL FINDINGS IDENTIFIED:      18                          |
|   - CRITICAL:                   3                           |
|   - HIGH:                       6                           |
|   - MEDIUM:                     5                           |
|   - LOW:                        3                           |
|   - INFORMATIONAL:              1                           |
+-------------------------------------------------------------+
```

---

## 3. Critical Findings Summary

### 1. `SEC-AUTH-01`: Email Substring Matching Grants Unauthorized Hospital Admin & Doctor Authority (CRITICAL)
- **Location:** `frontend/src/lib/auth.tsx` (Lines 215, 224), `frontend/src/pages/StaffLoginPage.tsx` (Line 117)
- **Vulnerability:** The frontend client checks `user?.email?.toLowerCase().includes('admin')` to grant `isHospitalAdmin = true`, and checks `r.toLowerCase().includes('admin')` to grant `isDoctor = true`. Any user with "admin" in their email string (e.g. `badminton.club@gmail.com` or `administrative.assistant@hospital.org`) or any administrator is granted doctor consultation workstation access without holding clinical queue assignments.
- **Impact:** Privilege escalation; unauthorized workstation rendering.

### 2. `SEC-RLS-01`: Supabase Data API Unshielded by Policies & Missing RLS on Incidents Table (CRITICAL)
- **Location:** `backend/prisma/migrations/`, `backend/prisma/supabase-hardening.sql`
- **Vulnerability:** While `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was added across several migrations, **zero RLS policies (`CREATE POLICY`) were ever defined**. Furthermore, `frontend_incidents` was created without enabling RLS at all (`backend/prisma/migrations/20261114122210_add_frontend_incidents/migration.sql`). The `REVOKE ALL ON ALL TABLES FROM anon, authenticated;` statements exist solely in an unapplied documentation script (`supabase-hardening.sql`).
- **Impact:** If the Supabase PostgREST Data API is reachable via the public publishable anon key, unshielded tables could be queried or manipulated directly, bypassing NestJS backend guards.

### 3. `SEC-SESS-01`: Account Switching Retains Stale TanStack Query Cache in Memory (CRITICAL)
- **Location:** `frontend/src/lib/auth.tsx` (`signOut()`, Lines 190–197)
- **Vulnerability:** `signOut()` in `auth.tsx` clears Supabase sessions and session storage, but **never calls `queryClient.clear()` or `queryClient.resetQueries()`**.
- **Impact:** When a doctor or receptionist logs out and a patient (or another staff member) signs in on the same browser terminal, patient lists (`myPatients`), queue data (`doctor-queues`), and audit logs remain populated in the TanStack in-memory cache, leaking cross-account clinical and PII data.

---

## 4. High-Severity Findings Summary

| Finding ID | Title | Component | Impact |
|---|---|---|---|
| **`SEC-AUTH-02`** | Staff Account Auto-Registration as Patients in Background | `TokenTracker.tsx` (L390-394) | Degrades database integrity by silently creating rogue patient profiles for doctors and admins visiting `/track`. |
| **`SEC-AUTH-03`** | `isPatient` Inferred from Generic Session Existence | `auth.tsx` (L236) | `isPatient = Boolean(user)` treats every authenticated account as a patient regardless of actual patient profile existence. |
| **`SEC-AUTH-04`** | Empty Global Roles Defaulted to Patient in User Directory | `GlobalUserDirectory.tsx` (L84, L243), `superAdminService.ts` (L122) | Clinical staff (doctors with valid queue assignments) are misclassified as "Patient" in Super Admin directory. |
| **`SEC-API-01`** | Unvalidated `selectedQueueId` Dispatches Invalid Route `POST /queues//appointment-slots` | `DoctorConsole.tsx` (L250-273), `api-client.ts` (L509) | Missing client/SDK queue ID validation causes malformed HTTP requests and blocks appointment slot publishing. |
| **`SEC-AUTH-05`** | Open `/track` Route Without Role Restriction | `App.tsx` (L106), `TokenTracker.tsx` | Staff accounts are not blocked from patient tracker; creates clinical and patient identity confusion. |
| **`SEC-RATE-01`** | Sensitive Clinical Endpoints Lack Explicit Rate Limiting | `appointments.controller.ts`, `hospital.controller.ts` | Walk-in issuance, appointment bookings, and UHID lookups lack dedicated throttling, leaving them vulnerable to enumeration. |

---

## 5. Compliance & Isolation Verification Status

| Security Domain | Status | Notes |
|---|---|---|
| **Multi-Tenant Hospital Isolation** | **VERIFIED (Backend)** | `HospitalAdminController` enforces `this.hospitalScope(actor)` across administrative queries. Super Admin can supervise all hospitals; Hospital Admins are strictly scoped to their assigned `hospitalId`. |
| **Doctor Queue Scoping** | **VERIFIED (Backend)** | `HospitalController` verifies `queue.doctorId === actor` on `callNext`, `complete`, `skip`, and `setPriority`. Doctors cannot mutate unassigned queues. |
| **Receptionist Scoping** | **VERIFIED (Backend)** | Receptionist actions (`registerWalkInPatient`, `issueWalkIn`, `transfer`) verify `receptionAssignment` membership in target department. |
| **Public TV Signage Zero-PII** | **VERIFIED** | `GET /public/queues/:publicQueueId` is marked `@Public()`, queries only `sequence` and `waitingCount`, and strips all patient names, UHIDs, and contact info. |
| **Credential & Secret Exposure** | **VERIFIED CLEAN** | No database passwords, JWT secrets, or Supabase `service_role` keys are committed in Git history or bundled into frontend assets. |

---

## 6. Recommended Next Steps

1. **Phase 1 (Immediate Remediation - P0):**
   - Eliminate email substring matching in `auth.tsx` and `StaffLoginPage.tsx`.
   - Add `queryClient.clear()` to `signOut()` in `auth.tsx`.
   - Remove auto-registration `useEffect` in `TokenTracker.tsx` and block staff-only accounts from `/track`.
   - Fix user directory role resolution in `superAdminService.ts` and `GlobalUserDirectory.tsx`.
   - Add queue validation in `DoctorConsole.tsx` and `api-client.ts`.
2. **Phase 2 (Database & RLS Hardening - P1):**
   - Apply explicit RLS policies to all clinical tables (`Patient`, `QueueToken`, `HospitalQueue`, `Appointment`, `frontend_incidents`).
   - Run `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` in Supabase migration.
3. **Phase 3 (Infrastructure Hardening - P2):**
   - Add dedicated `@Throttle` decorators to `POST /appointments`, `POST /walk-ins`, and `GET /staff/patients/lookup`.
   - Restrict Swagger `/docs` access in production environments.
