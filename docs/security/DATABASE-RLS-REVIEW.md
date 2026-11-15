# HQMS Database & Supabase Row Level Security (RLS) Review
**Audit Date:** 2026-11-14  
**Auditor / Orchestrator:** M1 Main Orchestrator  
**Repository:** `https://github.com/Afeej303/build1.git`  
**Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426`  
**Target Database:** PostgreSQL 15+ (Prisma ORM & Supabase PostgreSQL)  
**Scope:** Review of all 26 database entities, 12 migrations, table grants, sequence permissions, and Supabase PostgREST access.

---

## 1. Executive Database Security Assessment

The HQMS backend interacts with PostgreSQL via NestJS and Prisma ORM using a privileged PostgreSQL connection string (`DATABASE_URL`). Within NestJS, multi-tenant boundaries (hospital isolation, queue ownership, department reception scopes) are enforced through parameterized queries and transaction blocks.

However, in Supabase architectures where the PostgreSQL database also powers the **Supabase PostgREST Data API** (`/rest/v1/*`), client applications or external attackers possessing the public `VITE_SUPABASE_PUBLISHABLE_KEY` can make direct HTTP requests to PostgreSQL tables.

### Critical Finding
Across all 12 migration files in `backend/prisma/migrations/`:
- **`ENABLE ROW LEVEL SECURITY;` was added to 24 tables.**
- **`ENABLE ROW LEVEL SECURITY;` was completely omitted for `frontend_incidents`.**
- **ZERO `CREATE POLICY` statements were ever executed in any migration.**
- **ZERO `REVOKE ALL ON ALL TABLES FROM anon, authenticated;` statements exist in the active migration chain.**

The hardening commands exist exclusively in an unapplied manual script: `backend/prisma/supabase-hardening.sql`.

---

## 2. Comprehensive Entity RLS & Grant Audit Matrix

| Database Entity / Table Name | Migration File | RLS Enabled? | RLS Forced? | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | PostgREST Direct API Exposure Risk | Finding Ref |
|---|---|---|---|---|---|---|---|---|---|
| `users` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW (Denies anon if RLS applied) | — |
| `auth_provider_accounts` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `roles` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `permissions` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `role_permissions` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `user_roles` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `organizations` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `organization_members` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `organization_member_roles` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `organization_invitations` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `sessions` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `refresh_token_history` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `email_verification_tokens` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `password_reset_tokens` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| `audit_logs` | `20261114131000_protect_auth_tables` | YES | NO | None (Implicit Deny) | None | None | None | LOW | — |
| **`frontend_incidents`** | `20261114122210_add_frontend_incidents` | **NO** | **NO** | **NONE (PUBLIC)** | **NONE** | **NONE** | **NONE** | **CRITICAL (Open to anon/auth)** | `SEC-RLS-01` |
| `Hospital` | `20261114130000_hospital_queues` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM (Depends on role grants) | `SEC-RLS-01` |
| `Department` | `20261114130000_hospital_queues` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |
| `ReceptionAssignment` | `20261114130000_hospital_queues` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |
| `Patient` | `20261114130000_hospital_queues` | YES | NO | None (Implicit Deny) | None | None | None | HIGH (Contains PHI) | `SEC-RLS-01` |
| `HospitalQueue` | `20261114130000_hospital_queues` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |
| `QueueToken` | `20261114130000_hospital_queues` | YES | NO | None (Implicit Deny) | None | None | None | HIGH (Clinical wait states) | `SEC-RLS-01` |
| `AppointmentSlot` | `20261114140000_appointments` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |
| `Appointment` | `20261114140000_appointments` | YES | NO | None (Implicit Deny) | None | None | None | HIGH (Patient bookings) | `SEC-RLS-01` |
| `HospitalActivity` | `20261114150000_patient_profiles_...` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |
| `HospitalAdminAssignment` | `20261114170000_hospital_admin_...` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |
| `DoctorBreak` | `20261114200000_doctor_breaks` | YES | NO | None (Implicit Deny) | None | None | None | MEDIUM | `SEC-RLS-01` |

---

## 3. Detailed Tenant Isolation & Access Analysis

### 3.1 Patient Isolation
- **Intended Rule:** Patients may read and update only their own patient records, appointments, and tokens.
- **Backend Enforcement:**
  - `GET /users/me/patients`: Uses `where: { userId }`.
  - `PATCH /users/me/patients/:id`: Uses `where: { id, userId }`.
  - `GET /users/me/appointments`: Uses `where: { patient: { userId } }`.
  - `POST /appointments/:id/cancel`: Uses `where: { id, patient: { userId } }`.
  - `GET /users/me/queue-tokens`: Uses `where: { patient: { userId } }`.
- **Database Layer Risk:** If direct PostgREST is queried using a valid JWT without Prisma, PostgreSQL returns zero rows because RLS is enabled with no policies. However, if PostgREST schema cache is refreshed or permissive defaults are granted, lack of explicit `CREATE POLICY` leaves behavior dependent on default role grants.

### 3.2 Doctor Scoping
- **Intended Rule:** Doctors may only call tokens, set priority, or complete consultations on queues where `doctorId === actor`.
- **Backend Enforcement:**
  - `callNext`, `complete`, `skip`, `missed`, `setPriority` all execute:
    ```typescript
    const queue = await this.lockQueue(tx, token.queueId);
    if (queue.doctorId !== actor) this.denyQueue();
    ```
  - This is strictly enforced in the backend.

### 3.3 Hospital Admin Isolation
- **Intended Rule:** Hospital Admin A cannot read or modify Hospital B's departments, queues, staff, or activity logs.
- **Backend Enforcement:**
  - `HospitalAdminController` routes (`/admin/hospitals/:hospitalId/*`) invoke `await this.hospitalScope(actor)`.
  - For Hospital Admin accounts, `hospitalScope` returns:
    ```typescript
    { admins: { some: { userId: actor } } }
    ```
  - Injected into `where: { id: hospitalId, ...scope }`. If Hospital Admin A attempts to access Hospital B, the query matches 0 rows and returns HTTP 404/403. Cross-tenant access is blocked.

### 3.4 Unshielded Entity: `frontend_incidents`
- **Intended Rule:** Incident reports should be triaged only by platform Super Admins.
- **Database Layer Flaw:** Table `frontend_incidents` was created in migration `20261114122210_add_frontend_incidents/migration.sql` with no RLS enabled. If PostgREST is exposed, anyone with the public anon key can `SELECT * FROM frontend_incidents` and read frontend error traces, route names, and user agents.

---

## 4. Required Database Hardening Remediation

Execute a formal Prisma migration: `20261115000000_supabase_rls_hardening.sql`:

```sql
-- 1. Enable RLS on any remaining unshielded tables
ALTER TABLE public.frontend_incidents ENABLE ROW LEVEL SECURITY;

-- 2. Revoke all direct PostgREST table privileges from anon and authenticated roles
-- This guarantees that ALL queries MUST go through the NestJS backend
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3. In the event PostgREST direct access is ever enabled for specific tables,
-- define explicit owner-scoped policies:
CREATE POLICY "patient_own_read" ON public."Patient"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid());

CREATE POLICY "patient_own_appointments" ON public."Appointment"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Patient" p
    WHERE p.id = "Appointment"."patientId" AND p."userId" = auth.uid()
  ));
```
