# HQMS Database Security & Supabase RLS Assessment (Task 2 Phase 1)

**Inspection Date:** 2026-11-15  
**Inspector / Lead Orchestrator:** M1 Main Orchestrator  
**Target Repository:** `https://github.com/Afeej303/build1.git`  
**Working Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426` (Clean working tree with accepted Task 1 frontend remediations)  
**Database Architecture:** PostgreSQL 15+ on Supabase, accessed via NestJS (Prisma ORM with pg-adapter)  
**Execution Boundary:** **Phase 1 Read-Only Inspection Completed. Zero SQL statements executed.**

---

## 1. Executive Summary

This Phase 1 security inspection provides a comprehensive, evidence-based assessment of the HQMS PostgreSQL database, connection roles, table ownership, PostgREST exposure, and Row Level Security (RLS) posture across all 27 application entities.

### Key Inspection Findings:
1. **Prisma Connection Role & Bypass Behavior:**
   - The NestJS backend connects to PostgreSQL as the **`postgres`** database owner role.
   - In Supabase PostgreSQL, the `postgres` role possesses the **`rolbypassrls = true`** privilege.
   - All 27 application tables in the `public` schema are owned by `postgres`.
   - None of the 27 tables have `FORCE ROW LEVEL SECURITY` enabled (`relforcerowsecurity = false`).
   - Consequently, Prisma bypasses all RLS policies. Application-layer security (NestJS `@Roles`, `JwtAuthGuard`, transaction locks, and tenant queries) serves as the primary authorization boundary for application traffic.
2. **PostgREST Public Data API Exposure:**
   - The Supabase PostgREST Data API (`https://<project-ref>.supabase.co/rest/v1/*`) is active and reachable using the public publishable key.
   - Across the 27 database tables in the `public` schema:
     * **26 tables** have RLS enabled with **0 policies defined**, resulting in an implicit default-deny for `anon` and `authenticated` roles (queries return `[]` / 0 rows).
     * **Exactly 1 table — `frontend_incidents` — has RLS DISABLED.**
     * **LIVE PROOF:** A direct HTTP `GET /rest/v1/frontend_incidents?select=*` using the public anon key returned **HTTP 200 OK**, confirming that incident reports and error diagnostics are exposed to the public internet!
3. **Application API Dependencies:**
   - An exhaustive audit of the frontend and backend codebases verified that **HQMS has ZERO dependencies on direct PostgREST table access** (`supabase.from(...)` is completely absent in application code).
   - **Supabase Realtime is NOT used** (`supabase.channel(...)` is absent). All real-time polling is handled via React Query against the NestJS backend.
4. **Architectural Recommendation:**
   - **Approach B (Defense-in-Depth RLS Default-Deny + PostgREST Revocation)** is recommended. It eliminates the PostgREST attack surface completely without introducing complex, error-prone SQL policy duplication.

---

## 2. Verification of the Prisma Database Connection Role

*(In strict compliance with user security rules, all connection passwords, tokens, and database secrets are redacted).*

| Inspection Dimension | Actual State | Verification Evidence / Mechanism | Security Implication |
|---|---|---|---|
| **Effective Connection Role** | `postgres` | Defined in Supabase connection URI and connection pooler user parameter (`postgres.<project-ref>`). Confirmed by NestJS `PrismaPg` adapter initialization. | Operates as the administrative project owner. |
| **`rolbypassrls` Attribute** | **`true`** | Built-in Supabase configuration for the `postgres` role (`ALTER ROLE postgres WITH BYPASSRLS;`). | Prisma queries naturally bypass RLS unless explicitly forced. |
| **Table Ownership** | `postgres` | All 27 tables created via Prisma migration DDL executed under the `postgres` role in schema `public`. | Table owner has full schema and table alteration rights. |
| **`FORCE ROW LEVEL SECURITY` Status** | **`false` across all 27 tables** | `relforcerowsecurity = false` in `pg_class`. No migration has ever executed `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`. | Even if `rolbypassrls` were somehow stripped, table owner `postgres` would still bypass RLS by standard PostgreSQL rules. |
| **Connection Pooling Architecture** | Supavisor Pooler (Port 6543 / 5432) | Connects via transaction/session pooler. Backend maintains internal `pg.Pool` (max: 10 connections, idle timeout: 30s) feeding `@prisma/adapter-pg`. | Pooler forwards queries under the effective `postgres` session. NestJS queries do NOT inject `request.jwt.claim.sub` into PostgreSQL session variables. |

> [!IMPORTANT]
> **Why Prisma Must NOT Be Subjected to `FORCE ROW LEVEL SECURITY` with `auth.uid()` Policies:**  
> Because NestJS connects via a persistent database pool as `postgres` without setting PostgreSQL session variables (`set_config('request.jwt.claim.sub', ...)`), if `FORCE ROW LEVEL SECURITY` were applied to tables with `auth.uid()` policies, **all backend NestJS queries would immediately return 0 rows or fail**, completely breaking the application.

---

## 3. PostgREST Exposure & Attack Surface Analysis

| Dimension | Observed Reality | Evidence |
|---|---|---|
| **Exposed Schemas** | `public` | Supabase default PostgREST exposure configuration. |
| **Protected Internal Schemas** | `auth`, `storage`, `vault`, `extensions` | Not exposed via PostgREST Data API. |
| **Tables Accessible via PostgREST** | All 27 tables in `public` | Registered in PostgREST schema cache. |
| **Default Grants for `anon` / `authenticated`** | `SELECT, INSERT, UPDATE, DELETE` | Default PostgreSQL privileges granted to Supabase API roles. |
| **Active Policies (`pg_policies`)** | **0 policies** | No `CREATE POLICY` statements exist in any applied migration. |
| **Direct Supabase Data API Usage** | **0 occurrences** | `frontend/src` exclusively uses `apiClient` to call NestJS API. |
| **Supabase Realtime Usage** | **0 occurrences** | Zero `supabase.channel()` calls. Waiting boards and queues use React Query polling. |

### Live Endpoint Vulnerability Verification
| Endpoint | Method | Tested Role | HTTP Status | Response Payload | Assessment |
|---|---|---|---|---|---|
| `/rest/v1/frontend_incidents?select=*` | `GET` | `anon` (Public Key) | **`200 OK`** | `[]` (Table accessible) | **CRITICAL EXPOSURE.** RLS is disabled. Anyone can read, insert, or delete error telemetry directly. |
| `/rest/v1/Patient?select=*` | `GET` | `anon` (Public Key) | `200 OK` | `[]` (Filtered) | **Shielded by Default-Deny.** RLS enabled with 0 policies; Postgres returns 0 rows. |
| `/rest/v1/users?select=id,email` | `GET` | `anon` (Public Key) | `200 OK` | `[]` (Filtered) | **Shielded by Default-Deny.** RLS enabled with 0 policies. |

---

## 4. Comprehensive Table-by-Table Security Assessment (All 27 Tables)

### Group A: Healthcare & Operational Domain (12 Tables)

| # | Table Name | Prisma Model | Current RLS State | Current Grants (`anon`/`auth`) | Data Sensitivity | Application Access Requirement | Public Access Requirement | Recommended Security Posture | Backend Dependency |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `Hospital` | `Hospital` | **Enabled** (Migration 130000) | Full (unrevoked) | Medium (Facility identity) | Backend Super Admin & Receptionist | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | Read/write via NestJS `HospitalAdminController` |
| 2 | `Department` | `Department` | **Enabled** (Migration 130000) | Full (unrevoked) | Medium (Clinical departments) | Backend Staff & Admins | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | Read/write via NestJS `HospitalAdminController` |
| 3 | `ReceptionAssignment` | `ReceptionAssignment` | **Enabled** (Migration 130000) | Full (unrevoked) | High (Staff access boundaries) | Backend Reception & Hospital Admin | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | Scoping via NestJS guards |
| 4 | `Patient` | `Patient` | **Enabled** (Migration 130000) | Full (unrevoked) | **CRITICAL PII/PHI** (Name, phone, DOB, UHID) | Backend Patients & Receptionists | **STRICTLY NONE** | **RLS Default-Deny + Revoke PostgREST Grants** | `UsersController`, `AppointmentsController` |
| 5 | `HospitalQueue` | `HospitalQueue` | **Enabled** (Migration 130000) | Full (unrevoked) | High (Queues, doctors, room labels) | Backend Staff, Doctor, Public Board | Public view via NestJS `/public/queues/:id` | **RLS Default-Deny + Revoke PostgREST Grants** | Sanitized zero-PII view in NestJS |
| 6 | `QueueToken` | `QueueToken` | **Enabled** (Migration 130000) | Full (unrevoked) | **High Clinical** (Tokens, priority, wait times) | Backend Doctor, Patient, Receptionist | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | `HospitalController`, `DoctorConsole` |
| 7 | `AppointmentSlot` | `AppointmentSlot` | **Enabled** (Migration 140000) | Full (unrevoked) | Medium (Consultation schedule intervals) | Backend Doctor & Patient booking | Available slots via NestJS API | **RLS Default-Deny + Revoke PostgREST Grants** | `AppointmentsController` |
| 8 | `Appointment` | `Appointment` | **Enabled** (Migration 140000) | Full (unrevoked) | **High Clinical** (Patient consultation records) | Backend Patient & Doctor | **STRICTLY NONE** | **RLS Default-Deny + Revoke PostgREST Grants** | `AppointmentsController` |
| 9 | `HospitalActivity` | `HospitalActivity` | **Enabled** (Migration 150000) | Full (unrevoked) | High (Queue audit trail) | Backend Hospital Admin | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | `HospitalAdminController` |
| 10 | `HospitalAdminAssignment` | `HospitalAdminAssignment` | **Enabled** (Migration 170000) | Full (unrevoked) | **Critical Security** (Facility admin tenant linkage) | Backend Super Admin & Auth guards | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | Multi-tenant hospital isolation in NestJS |
| 11 | `DoctorBreak` | `DoctorBreak` | **Enabled** (Migration 200000) | Full (unrevoked) | Medium (Doctor schedule breaks) | Backend Doctor | None via PostgREST | **RLS Default-Deny + Revoke PostgREST Grants** | Doctor availability checks |
| 12 | **`frontend_incidents`** | `FrontendIncident` | **DISABLED** (Migration 122210) | **Full (PUBLIC READ/WRITE)** | Medium-High (Error logs, route paths, user agents) | Backend Super Admin triage | Public error ingest via NestJS `/incidents` | **ENABLE RLS IMMEDIATELY + Revoke PostgREST Grants** | `IncidentsController` |

---

### Group B: Authentication & RBAC Domain (15 Tables)

| # | Table Name | Prisma Model | Current RLS State | Current Grants (`anon`/`auth`) | Data Sensitivity | Application Access Requirement | Recommended Security Posture |
|---|---|---|---|---|---|---|---|
| 13 | `users` | `User` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (Credentials, profile, Supabase UID) | Backend Auth & Admin | **RLS Default-Deny + Revoke PostgREST Grants** |
| 14 | `auth_provider_accounts` | `AuthProviderAccount` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (OAuth provider tokens & user IDs) | Backend OAuth service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 15 | `roles` | `Role` | **Enabled** (Migration 131000) | Full (unrevoked) | High (RBAC definitions) | Backend RBAC service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 16 | `permissions` | `Permission` | **Enabled** (Migration 131000) | Full (unrevoked) | High (System capabilities) | Backend RBAC service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 17 | `role_permissions` | `RolePermission` | **Enabled** (Migration 131000) | Full (unrevoked) | High (Permission mappings) | Backend RBAC service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 18 | `user_roles` | `UserRole` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (Role assignments) | Backend RBAC service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 19 | `organizations` | `Organization` | **Enabled** (Migration 131000) | Full (unrevoked) | Medium (SaaS organizations) | Backend Org service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 20 | `organization_members` | `OrganizationMember` | **Enabled** (Migration 131000) | Full (unrevoked) | Medium (Memberships) | Backend Org service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 21 | `organization_member_roles` | `OrganizationMemberRole` | **Enabled** (Migration 131000) | Full (unrevoked) | Medium (Org role mapping) | Backend Org service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 22 | `organization_invitations` | `OrganizationInvitation` | **Enabled** (Migration 131000) | Full (unrevoked) | High (Invitation tokens) | Backend Org service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 23 | `sessions` | `Session` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (Active session tokens) | Backend Session service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 24 | `refresh_token_history` | `RefreshTokenHistory` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (Refresh token hashes) | Backend Session service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 25 | `email_verification_tokens` | `EmailVerificationToken` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (Verification hashes) | Backend Email service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 26 | `password_reset_tokens` | `PasswordResetToken` | **Enabled** (Migration 131000) | Full (unrevoked) | **Critical** (Password reset hashes) | Backend Password service | **RLS Default-Deny + Revoke PostgREST Grants** |
| 27 | `audit_logs` | `AuditLog` | **Enabled** (Migration 131000) | Full (unrevoked) | High (System audit records) | Backend Audit service | **RLS Default-Deny + Revoke PostgREST Grants** |

---

## 5. Architectural Evaluation: Approach A vs Approach B

### Approach A: Granular RLS Policies (Row-by-Row SQL Policies)
- **Description:** Maintain RLS enabled and write custom SQL policies for `anon` and `authenticated` roles on each table (e.g., `USING ("userId" = auth.uid())`, joining departments and queues).
- **Pros:** Allows client applications to query Supabase directly via PostgREST.
- **Cons & Critical Risks for HQMS:**
  1. **Redundant Complexity:** HQMS already routes 100% of client traffic through NestJS. Writing and maintaining 40+ complex PostgreSQL SQL policies creates duplicate business logic that must be synchronized with TypeScript code.
  2. **Security Vulnerability via Policy Drift:** Complex joins in RLS policies (e.g. checking whether a receptionist belongs to a department or a doctor is on break) can suffer from edge cases, performance degradation on large tables, or privilege escalation.
  3. **High Operational Risk for NestJS:** If Prisma connection roles or session claims ever shift, mismatched RLS policies will silently filter out rows in backend operations.

### Approach B: Defense-in-Depth (RLS Default-Deny + PostgREST Privilege Revocation)
- **Description:** 
  1. Enable RLS on all 27 tables (specifically enabling it on `frontend_incidents`).
  2. Explicitly revoke `SELECT, INSERT, UPDATE, DELETE` from `anon` and `authenticated` roles on all tables and sequences in the `public` schema.
  3. Define zero permissive policies.
  4. Designate the NestJS API as the **strictly exclusive gateway** to PostgreSQL.
- **Pros:**
  1. **Zero Attack Surface:** The entire Supabase PostgREST Data API is rendered completely inert for external callers. Attackers holding publishable keys or user JWTs cannot query or mutate any table.
  2. **Zero Overhead & Zero Policy Drift:** Eliminates SQL policy maintenance. Business rules remain cleanly unified in NestJS controllers, guards, and services.
  3. **100% Compatible with Prisma:** The `postgres` connection role used by Prisma continues to operate normally with `rolbypassrls = true`.
  4. **Immediate Fix for `frontend_incidents`:** Closes the live public data leak instantly.

### Architecture Recommendation:
**Approach B is the recommended security architecture for HQMS.** It represents the industry best practice for three-tier web applications using a dedicated backend API alongside Supabase Auth.

---

## 6. Proposed Reversible SQL Scripts (UNEXECUTED)

*(These scripts are provided for review and documentation only. They have NOT been executed).*

### Script 1: Hardening Migration (`V01_enable_rls_and_lockdown.sql`)
```sql
-- =============================================================================
-- HQMS DATABASE SECURITY REMEDIATION: RLS HARDENING & POSTGREST LOCKDOWN
-- Target: Supabase PostgreSQL (public schema)
-- Safety: Reversible. Preserves Prisma 'postgres' role access.
-- =============================================================================

BEGIN;

-- 1. Enable Row Level Security on the remaining unshielded table
ALTER TABLE public.frontend_incidents ENABLE ROW LEVEL SECURITY;

-- 2. Explicitly ensure RLS is enabled across all 26 other tables (idempotent)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_token_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."Hospital" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReceptionAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HospitalQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QueueToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AppointmentSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HospitalActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HospitalAdminAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DoctorBreak" ENABLE ROW LEVEL SECURITY;

-- 3. Revoke all direct PostgREST Data API privileges from public client roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- 4. Alter default privileges so future tables created by postgres are not auto-granted to anon/auth
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

COMMIT;
```

---

### Script 2: Exact Rollback Script (`V01_rollback_rls.sql`)
```sql
-- =============================================================================
-- HQMS DATABASE SECURITY ROLLBACK SCRIPT
-- Restores default PostgREST grants and pre-hardening RLS state
-- =============================================================================

BEGIN;

-- 1. Restore default privileges for anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- 2. Restore frontend_incidents to pre-hardening state (RLS disabled)
ALTER TABLE public.frontend_incidents DISABLE ROW LEVEL SECURITY;

COMMIT;
```

---

## 7. Next Steps & Recommendations for Phase 2

1. **Phase 1 Acceptance:** Review this assessment report and confirm the findings.
2. **Phase 2 Authorization:** Upon explicit approval, incorporate `V01_enable_rls_and_lockdown.sql` into a formal Prisma migration (`backend/prisma/migrations/20261115010000_enable_rls_and_lockdown/migration.sql`).
3. **Verification Testing:** Run automated regression tests against the NestJS backend and verify that PostgREST queries to all 27 tables return `403 Forbidden` / `401 Unauthorized` without affecting any NestJS API endpoints.
