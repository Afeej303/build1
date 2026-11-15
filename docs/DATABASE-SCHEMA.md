# HQMS Database and Data Model (P-05 Specification)

## 1. Storage Overview

- **Database / Storage Technology:** PostgreSQL 15+ hosted on Supabase (managed cloud PostgreSQL).
- **ORM / Query Engine:** Prisma ORM 5.x with generated typed PrismaClient.
- **Schema Name:** `public` schema.
- **Migration Approach:** Declarative Prisma migrations (`backend/prisma/migrations/`) version-controlled and applied via `prisma migrate deploy`.
- **Connection Architecture:**
  - **Prisma Application Layer:** Connects using direct PostgreSQL connection pooler as role `postgres` with `rolbypassrls = true`. Application-layer multi-tenant scoping and NestJS Guards enforce access control.
  - **Supabase Auth / PostgREST Layer:** Upstream Supabase Auth manages JWT signing. PostgREST API roles (`anon`, `authenticated`) interact with `public` schema subject to PostgreSQL Row Level Security (RLS).
- **Data Retention & Audit Constraints:**
  - Soft deletion on key entities (`deletedAt` timestamp on `User`, `HospitalQueue`, `Organization`).
  - Strict immutability on audit logs (`AuditLog`, `HospitalActivity`) — rows cannot be updated or deleted by normal application roles.
  - PII Protection: Patient names and UHIDs are restricted to facility staff; public displays only project zero-PII display codes (e.g., `TK-101`). Diagnostic incidents undergo mandatory PII stripping before persistence.

---

## 2. Entity Directory (27 Core Models)

The data model comprises 27 relational tables organized across 6 functional domains:

| Entity | Purpose | Domain | Primary Relationships |
|---|---|---|---|
| `User` | Platform user accounts mapped to Supabase identities | Identity & Auth | AuthProviderAccount, UserRole, HospitalAdminAssignment, ReceptionAssignment, DoctorQueues |
| `AuthProviderAccount` | Third-party / OAuth identity provider bindings | Identity & Auth | `User` (M:1) |
| `Role` | Global RBAC role definitions (`super_admin`, `hospital_admin`, `doctor`, `receptionist`, `patient`) | RBAC | RolePermission, UserRole |
| `Permission` | Granular capability definitions (e.g., `hospital:create`, `queue:call`) | RBAC | RolePermission |
| `RolePermission` | Join table associating permissions to roles | RBAC | `Role` (M:1), `Permission` (M:1) |
| `UserRole` | Join table associating global roles to users | RBAC | `User` (M:1), `Role` (M:1) |
| `Organization` | Enterprise organization tenant boundary | Multi-Tenancy | OrganizationMember, OrganizationInvitation |
| `OrganizationMember` | Membership of a user within an organization tenant | Multi-Tenancy | `Organization` (M:1), `User` (M:1), OrganizationMemberRole |
| `OrganizationMemberRole` | Tenant-scoped roles within an organization | Multi-Tenancy | `OrganizationMember` (M:1), `Role` (M:1) |
| `OrganizationInvitation` | Pending invitations to join an organization | Multi-Tenancy | `Organization` (M:1) |
| `Session` | Active user authentication sessions and device tracking | Identity & Auth | `User` (M:1) |
| `RefreshTokenHistory` | Refresh token lineage and rotation audit for replay detection | Identity & Auth | `Session` (M:1) |
| `EmailVerificationToken` | One-time tokens for account verification | Identity & Auth | `User` (M:1) |
| `PasswordResetToken` | One-time tokens for secure password recovery | Identity & Auth | `User` (M:1) |
| `Hospital` | Physical or logical hospital facility tenant | Facility Topology | Department, HospitalAdminAssignment, HospitalActivity |
| `Department` | Clinical specialty department (e.g. Cardiology, OPD) | Facility Topology | `Hospital` (M:1), HospitalQueue, ReceptionAssignment |
| `HospitalAdminAssignment` | Scoped administrative authority linking an admin to a specific hospital | Facility Scoping | `Hospital` (M:1), `User` (M:1) |
| `ReceptionAssignment` | Desk receptionist counter mapping within a department | Facility Scoping | `Department` (M:1), `User` (M:1) |
| `HospitalQueue` | Consultation room queue and walk-in intake pipeline | Queue Engine | `Department` (M:1), `Doctor` (`User`), QueueToken, AppointmentSlot |
| `DoctorBreak` | Break scheduling and availability toggle for attending physicians | Queue Engine | `Doctor` (`User`), `HospitalQueue` (M:1) |
| `Patient` | Clinical patient record with hospital-scoped UHID | Clinical Data | `Hospital` (M:1), `LinkedUser` (`User` optional), QueueToken, Appointment |
| `QueueToken` | Physical or digital waiting token for consultation | Queue Engine | `HospitalQueue` (M:1), `Patient` (M:1), `AttendingDoctor` (`User` optional) |
| `AppointmentSlot` | Scheduled time window for outpatient consultations | Scheduling | `HospitalQueue` (M:1), Appointment |
| `Appointment` | Patient booking against an appointment slot | Scheduling | `AppointmentSlot` (1:1), `Patient` (M:1), `BookedBy` (`User`) |
| `AuditLog` | Platform-wide security and administration audit trail | Audit & Logging | `Actor` (`User` optional) |
| `HospitalActivity` | Clinical operational activity stream (token calls, skips, check-ins) | Audit & Logging | `Hospital` (M:1), `Department` (M:1), `Actor` (`User` optional) |
| `FrontendIncident` | Client diagnostic logs, UI freezes, and thermal printer telemetry | Diagnostics | `Reporter` (`User` optional) |

---

## 3. Core Domain Entity Specifications

### 3.1 Facility Topology & Access Boundaries

#### `Hospital`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Fields:**
  - `name`: `VARCHAR(120)`, Required
  - `code`: `VARCHAR(32)`, Optional, Unique
  - `status`: `ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED')`, Default: `'ACTIVE'`
  - `createdAt`: `TIMESTAMPTZ`, Default: `now()`
  - `updatedAt`: `TIMESTAMPTZ`, Default: `now()`
- **Indexes:** `UNIQUE(name)`

#### `Department`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Foreign Keys:** `hospitalId` references `Hospital(id)` ON DELETE CASCADE
- **Fields:**
  - `name`: `VARCHAR(120)`, Required
  - `hospitalId`: `UUID`, Required
  - `createdAt`: `TIMESTAMPTZ`, Default: `now()`
  - `updatedAt`: `TIMESTAMPTZ`, Default: `now()`
- **Indexes:** `UNIQUE(hospitalId, name)`, `INDEX(hospitalId)`

#### `HospitalAdminAssignment`
- **Primary Key:** Composite `(hospitalId, userId)`
- **Foreign Keys:**
  - `hospitalId` references `Hospital(id)` ON DELETE CASCADE
  - `userId` references `User(id)` ON DELETE CASCADE
- **Invariants:** Grants Hospital Administrator privileges strictly within the assigned `hospitalId`.

#### `ReceptionAssignment`
- **Primary Key:** Composite `(userId, departmentId)`
- **Foreign Keys:**
  - `userId` references `User(id)` ON DELETE CASCADE
  - `departmentId` references `Department(id)` ON DELETE CASCADE
- **Invariants:** Limits receptionist intake operations to queues within the assigned department and hospital. Max 5 receptionists per department enforced at application layer.

---

### 3.2 Queue Management & Token State Machine

#### `HospitalQueue`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Foreign Keys:**
  - `departmentId` references `Department(id)` ON DELETE CASCADE
  - `doctorId` references `User(id)` ON DELETE SET NULL (Optional)
- **Fields:**
  - `name`: `VARCHAR(120)`, Required
  - `roomLabel`: `VARCHAR(120)`, Optional (e.g., `"Room 101"`, `"Counter 3"`)
  - `publicQueueId`: `VARCHAR(64)`, Unique, Non-guessable slug for public TV board display
  - `acceptingWalkIns`: `BOOLEAN`, Default: `true`
  - `status`: `ENUM('ACTIVE', 'PAUSED', 'CLOSED')`, Default: `'ACTIVE'`
  - `deletedAt`: `TIMESTAMPTZ`, Optional
- **Indexes:** `UNIQUE(publicQueueId)`, `INDEX(departmentId)`, `INDEX(doctorId)`

#### `QueueToken`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Foreign Keys:**
  - `queueId` references `HospitalQueue(id)` ON DELETE CASCADE
  - `patientId` references `Patient(id)` ON DELETE CASCADE
  - `calledByDoctorId` references `User(id)` ON DELETE SET NULL
- **Fields:**
  - `displayNumber`: `VARCHAR(16)`, Required (e.g., `"TK-001"`, `"A-012"`)
  - `sequenceNumber`: `SERIAL` / `INTEGER`, Monotonically increasing per queue day
  - `status`: `ENUM('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED')`, Default: `'WAITING'`
  - `source`: `ENUM('WALK_IN', 'ONLINE_APPOINTMENT', 'EMERGENCY')`, Default: `'WALK_IN'`
  - `priority`: `INTEGER`, Default: `0` (higher value = elevated triage priority)
  - `issuedAt`: `TIMESTAMPTZ`, Default: `now()`
  - `calledAt`: `TIMESTAMPTZ`, Optional
  - `completedAt`: `TIMESTAMPTZ`, Optional
- **Invariants:**
  - Database constraint enforces at most one `WAITING` or `CALLED` token per patient per queue.
  - At most one `CALLED` / `SERVING` active token per queue at any time.

---

### 3.3 Appointment Scheduling

#### `AppointmentSlot`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Foreign Keys:** `queueId` references `HospitalQueue(id)` ON DELETE CASCADE
- **Fields:**
  - `startTime`: `TIMESTAMPTZ`, Required
  - `endTime`: `TIMESTAMPTZ`, Required
  - `capacity`: `INTEGER`, Default: `1`
  - `isAvailable`: `BOOLEAN`, Default: `true`
- **Indexes:** `INDEX(queueId, startTime, endTime)`

#### `Appointment`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Foreign Keys:**
  - `slotId` references `AppointmentSlot(id)` ON DELETE CASCADE (Unique 1:1)
  - `patientId` references `Patient(id)` ON DELETE CASCADE
  - `bookedById` references `User(id)` ON DELETE RESTRICT
- **Fields:**
  - `status`: `ENUM('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED')`, Default: `'BOOKED'`
  - `bookedAt`: `TIMESTAMPTZ`, Default: `now()`
  - `checkedInAt`: `TIMESTAMPTZ`, Optional
  - `cancelledAt`: `TIMESTAMPTZ`, Optional
- **Indexes:** `UNIQUE(slotId)`, `INDEX(patientId, status)`

---

### 3.4 Diagnostics & Telemetry

#### `FrontendIncident`
- **Primary Key:** `id` (UUID, default: `gen_random_uuid()`)
- **Foreign Keys:** `reportedBy` references `User(id)` ON DELETE SET NULL (Optional)
- **Fields:**
  - `severity`: `ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`, Required
  - `category`: `ENUM('API_ERROR', 'UI_FREEZE', 'AUTH_FAILURE', 'DATA_MISMATCH', 'PERFORMANCE', 'OTHER')`, Required
  - `affectedRoute`: `VARCHAR(200)`, Optional
  - `component`: `VARCHAR(500)`, Optional
  - `errorMessage`: `VARCHAR(500)`, Optional
  - `diagnostics`: `JSONB`, Optional (PII-sanitized client metadata)
  - `status`: `ENUM('OPEN', 'INVESTIGATING', 'RESOLVED')`, Default: `'OPEN'`
  - `notes`: `TEXT`, Optional
  - `createdAt`: `TIMESTAMPTZ`, Default: `now()`
  - `updatedAt`: `TIMESTAMPTZ`, Default: `now()`
- **Indexes:** `INDEX(status, severity)`, `INDEX(createdAt)`

---

## 4. Entity Relationships (ER Architecture)

```
[Hospital] 1 ──── N [Department] 1 ──── N [HospitalQueue] 1 ──── N [QueueToken]
    │                    │                      │                       │
    │                    │                      ├──── N [ApptSlot]      └── M:1 [Patient]
    │                    │                      │         │ 1                   │
    │                    │                      │         │ 1                   │
    ├─ N [AdminAssign]   └─ N [ReceptAssign]    │      [Appt] ── M:1 [User] ────┘ (Optional link)
    │        │                   │              │
    └─ N [HospitalActivity]      │              └─ M:1 [Doctor (User)]
                                 │
                           M:1 [User]
```

---

## 5. Seed & Synthetic Test Accounts

The following verified synthetic accounts are seeded for acceptance testing and validation. No real patient data exists in any environment.

| Role | Email | Seed Credentials | Assignment |
|---|---|---|---|
| **Super Admin** | `super-admin@hospital.org` | Seeded via Auth Provider | System-wide authority |
| **Hospital Admin** | `hospital-admin@hospital.org` | Seeded via Auth Provider | City General Hospital (`hospitalId`) |
| **Doctor** | `doctor@hospital.org` | Seeded via Auth Provider | General OPD Queue (`Room 101`) |
| **Receptionist** | `reception@hospital.org` | Seeded via Auth Provider | OPD Intake Counter 1 |
| **Patient 1** | `patient1@hospital.org` | Seeded via Auth Provider | UHID: `M1-4d1422a8-1` |
| **Patient 2** | `patient2@hospital.org` | Seeded via Auth Provider | UHID: `M1-4d1422a8-2` |

---

## 6. Security & Row Level Security (RLS) Posture

- **Current State:**
  - 26 tables in `public` have Row Level Security enabled with default-deny policies for PostgREST API roles (`anon`, `authenticated`).
  - Table `frontend_incidents` has RLS disabled, exposing direct table queries to PostgREST clients possessing the public anon key.
- **Remediation Proposal (SEC-02):**
  - Execute `ALTER TABLE "frontend_incidents" ENABLE ROW LEVEL SECURITY;`
  - Revoke direct public schema access from PostgREST roles:
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`
  - All application queries are routed through the NestJS backend via direct Prisma connection (`postgres` role), rendering NestJS completely immune to RLS restrictions while sealing the external PostgREST exposure.
