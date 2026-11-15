# HQMS API Authorization & Endpoint Security Matrix
**Audit Date:** 2026-11-14  
**Auditor / Orchestrator:** M1 Main Orchestrator  
**Repository:** `https://github.com/Afeej303/build1.git`  
**Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426`  
**Scope:** Complete inventory of all 56 backend endpoints across 12 controllers  
**Evaluation Personas:**
- **Anon**: Anonymous unauthenticated requester
- **Pat**: Authenticated Patient (user without staff assignments)
- **Doc**: Authenticated Doctor (with assignments in Hospital A)
- **Rec**: Authenticated Receptionist (with assignments in Hospital A)
- **Adm-A**: Authenticated Hospital Admin assigned to Hospital A
- **Adm-B**: Authenticated Hospital Admin assigned to Hospital B
- **Super**: Authenticated Platform Super Admin (`roles: ['super_admin']`)

---

## Authorization Key
- **ALLOW**: Request is authorized and data is scoped to caller's entitlement.
- **DENY**: Request is rejected with HTTP 401 Unauthorized or HTTP 403 Forbidden.
- **SCOPE**: Access allowed, but response is strictly filtered to caller's assigned tenant/queue/department.
- **OWN**: Access allowed only for resources owned by caller's user ID / patient record.
- **WARN**: Security risk or authorization flaw identified (see Finding cross-reference).

---

## 1. Clinical Workstation & Queue Operations (`HospitalController`)

| Method | Route Path | Guards & Decorators | Authorization & Scoping Logic | Anon | Pat | Doc | Rec | Adm-A | Adm-B | Super | Finding Ref |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/staff/queues` | `JwtAuthGuard` | `where: { ...this.staffScope(actor) }`. Scoped to doctor's assigned queues or receptionist's assigned departments. | DENY | DENY | SCOPE | SCOPE | DENY | DENY | DENY | — |
| `GET` | `/staff/patients/lookup` | `JwtAuthGuard` | Scoped to receptionist's assigned hospital departments. Strict exact UHID lookup. | DENY | DENY | DENY | SCOPE | DENY | DENY | DENY | `SEC-RATE-01` |
| `POST` | `/staff/patients` | `JwtAuthGuard`, DTO | Receptionist assignment required in target queue's department. Creates patient under queue's hospital. | DENY | DENY | DENY | SCOPE | DENY | DENY | DENY | — |
| `GET` | `/staff/audit-log` | `JwtAuthGuard` | Scoped to receptionist's assigned departments (`HospitalActivity`). | DENY | DENY | DENY | SCOPE | DENY | DENY | DENY | — |
| `POST` | `/walk-ins` | `JwtAuthGuard`, DTO | Receptionist assignment required. Enforces `acceptingWalkIns` and unique active token. | DENY | DENY | DENY | SCOPE | DENY | DENY | DENY | `SEC-RATE-01` |
| `GET` | `/queues/:queueId/dashboard` | `JwtAuthGuard`, UUID | Scoped via `staffScope(actor)`. Patient names exposed only to assigned doctor; waiting list anonymized. | DENY | DENY | SCOPE | SCOPE | DENY | DENY | DENY | — |
| `POST` | `/queues/:queueId/call-next` | `JwtAuthGuard`, UUID | Strict check: `queue.doctorId === actor`. Atomic token status transition WAITING -> CALLED. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/queue-tokens/:tokenId/transfer` | `JwtAuthGuard`, UUID, DTO | Receptionist must hold assignments in both source and destination departments. Same hospital only. | DENY | DENY | DENY | SCOPE | DENY | DENY | DENY | — |
| `POST` | `/queue-tokens/:tokenId/priority` | `JwtAuthGuard`, UUID, DTO | Strict check: `queue.doctorId === actor`. Sets priority 0/1 with audited reason. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/queue-tokens/:tokenId/complete` | `JwtAuthGuard`, UUID | Strict check: `queue.doctorId === actor`. Transitions CALLED -> COMPLETED. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/queue-tokens/:tokenId/skip` | `JwtAuthGuard`, UUID | Strict check: `queue.doctorId === actor`. Transitions CALLED -> SKIPPED. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/queue-tokens/:tokenId/missed` | `JwtAuthGuard`, UUID | Strict check: `queue.doctorId === actor`. Transitions CALLED -> MISSED. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `GET` | `/users/me/notifications` | `JwtAuthGuard` | Scoped to caller's owned patient appointments and tokens via raw SQL. | DENY | OWN | OWN | OWN | OWN | OWN | OWN | — |
| `GET` | `/users/me/queue-tokens` | `JwtAuthGuard` | Scoped strictly to `patient.userId === actor`. Returns active WAITING/CALLED tokens. | DENY | OWN | OWN | OWN | OWN | OWN | OWN | — |
| `GET` | `/queue-tokens/:tokenId` | `JwtAuthGuard`, UUID | Scoped strictly to `id === tokenId AND patient.userId === actor`. No IDOR possible. | DENY | OWN | DENY | DENY | DENY | DENY | DENY | — |
| `GET` | `/public/queues/:publicQueueId` | `@Public()` | Public signage. Exposes only sequence number and waiting count. Zero PII. | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | — |

---

## 2. Appointments & Patient Scheduling (`AppointmentsController`)

| Method | Route Path | Guards & Decorators | Authorization & Scoping Logic | Anon | Pat | Doc | Rec | Adm-A | Adm-B | Super | Finding Ref |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/appointment-queues` | `JwtAuthGuard` | Public discovery of active appointment queues and doctor names. | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | — |
| `GET` | `/users/me/patients` | `JwtAuthGuard` | Scoped strictly to `patient.userId === actor`. | DENY | OWN | OWN | OWN | OWN | OWN | OWN | — |
| `PATCH` | `/users/me/patients/:patientId` | `JwtAuthGuard`, UUID, DTO | Updates display name, phone, dob, gender for caller-owned patient profile. | DENY | OWN | OWN | OWN | OWN | OWN | OWN | — |
| `GET` | `/staff/appointments` | `JwtAuthGuard` | Scoped to receptionist's assigned hospital departments. Filterable by date/queue. | DENY | DENY | DENY | SCOPE | DENY | DENY | DENY | — |
| `POST` | `/patients/dependents` | `JwtAuthGuard`, DTO | Creates family dependent under caller's user ID and target hospital. | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | — |
| `POST` | `/patients/self` | `JwtAuthGuard`, DTO | Registers self as patient under target hospital. | DENY | ALLOW | WARN | WARN | WARN | WARN | WARN | `SEC-AUTH-02` |
| `GET` | `/users/me/doctor-breaks` | `JwtAuthGuard` | Scoped strictly to `doctorId === actor`. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/users/me/doctor-breaks` | `JwtAuthGuard`, DTO | Doctor registers scheduled break time. Validates against existing bookings. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `DELETE` | `/users/me/doctor-breaks/:breakId`| `JwtAuthGuard`, UUID | Deletes break where `id === breakId AND doctorId === actor`. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/queues/:queueId/appointment-slots` | `JwtAuthGuard`, UUID, DTO | Doctor publishes future slot. Checks `queue.doctorId === actor`. | DENY | DENY | SCOPE | DENY | DENY | DENY | DENY | `SEC-API-01` |
| `GET` | `/queues/:queueId/appointment-slots` | `JwtAuthGuard`, UUID | Discovers available upcoming unbooked slots for booking. Date range clamped. | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | — |
| `POST` | `/appointments` | `JwtAuthGuard`, DTO | Patient or receptionist books appointment. Enforces concurrency lock on slot. | DENY | SCOPE | DENY | SCOPE | DENY | DENY | DENY | `SEC-RATE-01` |
| `POST` | `/appointments/:id/check-in` | `JwtAuthGuard`, UUID | Patient or receptionist checks in future appointment on appointment date. | DENY | OWN | DENY | SCOPE | DENY | DENY | DENY | — |
| `GET` | `/users/me/appointments` | `JwtAuthGuard` | Returns appointments where `patient.userId === actor OR slot.queue.doctorId === actor`. | DENY | OWN | SCOPE | DENY | DENY | DENY | DENY | — |
| `POST` | `/appointments/:id/reschedule` | `JwtAuthGuard`, UUID, DTO | Patient or receptionist reschedules booking to next available slot in queue. | DENY | OWN | DENY | SCOPE | DENY | DENY | DENY | — |
| `POST` | `/appointments/:id/cancel` | `JwtAuthGuard`, UUID | Patient or receptionist cancels future booking. Transitions status to CANCELLED. | DENY | OWN | DENY | SCOPE | DENY | DENY | DENY | — |

---

## 3. Hospital Administration & Multi-Tenant Management (`HospitalAdminController`)

| Method | Route Path | Guards & Decorators | Authorization & Scoping Logic | Anon | Pat | Doc | Rec | Adm-A | Adm-B | Super | Finding Ref |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/admin/hospitals` | `JwtAuthGuard` | Evaluates `hospitalScope(actor)`. Super Admin gets all; Hospital Admin gets assigned facility. | DENY | DENY | DENY | DENY | SCOPE | SCOPE | ALLOW | — |
| `POST` | `/admin/hospitals` | `JwtAuthGuard`, `@Roles('super_admin')` | Creates new hospital tenant. Platform Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/report` | `JwtAuthGuard`, UUID | Enforces `where: { id, ...hospitalScope(actor) }`. Denies cross-hospital access. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/report.csv` | `JwtAuthGuard`, UUID | Exports daily queue metrics CSV for authorized hospital only. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/report.pdf` | `JwtAuthGuard`, UUID | Exports daily queue metrics PDF for authorized hospital only. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/activity` | `JwtAuthGuard`, UUID | Enforces `where: { id, ...hospitalScope(actor) }`. Denies Hospital Admin B on Hospital A. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/stats/doctors` | `JwtAuthGuard`, UUID | Enforces `hospitalScope(actor)`. Doctor consult metrics for assigned hospital. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/stats/receptionists` | `JwtAuthGuard`, UUID | Enforces `hospitalScope(actor)`. Intake metrics for assigned hospital. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/stats` | `JwtAuthGuard`, `@Roles('super_admin')` | Platform-wide operational aggregate metrics. Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/stats/appointments` | `JwtAuthGuard`, UUID | Enforces `hospitalScope(actor)`. Appointment booking metrics. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `POST` | `/admin/hospitals/:id/departments` | `JwtAuthGuard`, UUID, DTO | Enforces `hospitalScope(actor)`. Creates clinical department in facility. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `POST` | `/admin/departments/:id/queues` | `JwtAuthGuard`, UUID, DTO | Enforces `hospital: await this.hospitalScope(actor)`. Creates queue in department. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `PATCH`| `/admin/queues/:id` | `JwtAuthGuard`, UUID, DTO | Assigns doctor, room, walk-in toggle. Verifies queue belongs to caller's hospital scope. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `PUT` | `/admin/departments/:id/receptionists/:userId` | `JwtAuthGuard`, UUID | Assigns receptionist to department. Caps at 5 per department. Enforces hospital scope. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `DELETE`| `/admin/departments/:id/receptionists/:userId`| `JwtAuthGuard`, UUID | Removes receptionist from department. Enforces hospital scope. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/departments/:id/receptionists` | `JwtAuthGuard`, UUID | Lists receptionists assigned to department. Enforces hospital scope. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/queues` | `JwtAuthGuard`, UUID | Lists all queues in hospital. Enforces hospital scope. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `PUT` | `/admin/hospitals/:id/admins/:userId` | `JwtAuthGuard`, `@Roles('super_admin')` | Assigns Hospital Admin to facility. Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `DELETE`| `/admin/hospitals/:id/admins/:userId` | `JwtAuthGuard`, `@Roles('super_admin')` | Revokes Hospital Admin from facility. Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `POST` | `/admin/hospitals/:id/provision-admin` | `JwtAuthGuard`, `@Roles('super_admin')` | Provisions Supabase user and assigns `hospital_admin`. Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `POST` | `/admin/hospitals/:id/staff` | `JwtAuthGuard`, UUID, DTO | Provisions `doctor` or `receptionist` for facility. Enforces hospital scope and role check. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `PATCH`| `/admin/hospitals/:id/staff/:userId/status` | `JwtAuthGuard`, UUID, DTO | Sets staff status (ACTIVE, INACTIVE, SUSPENDED). Enforces hospital scope and user staff check. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |
| `GET` | `/admin/hospitals/:id/staff` | `JwtAuthGuard`, UUID | Aggregates all doctors, receptionists, and admins in hospital. Enforces hospital scope. | DENY | DENY | DENY | DENY | SCOPE | DENY | ALLOW | — |

---

## 4. Platform Incident Triage & Feedback (`IncidentsController`)

| Method | Route Path | Guards & Decorators | Authorization & Scoping Logic | Anon | Pat | Doc | Rec | Adm-A | Adm-B | Super | Finding Ref |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/incidents` | `JwtAuthGuard`, `@Throttle(10/min)` | Any authenticated user reports an incident. Diagnostics sanitized of PII. | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | — |
| `GET` | `/admin/incidents` | `JwtAuthGuard`, `@Roles('super_admin')` | Lists platform-wide frontend incidents. Super Admin exclusively. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | `SEC-INPUT-01` |
| `GET` | `/admin/incidents/:id` | `JwtAuthGuard`, `@Roles('super_admin')` | Retrieves specific incident. Super Admin exclusively. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `PATCH`| `/admin/incidents/:id` | `JwtAuthGuard`, `@Roles('super_admin')` | Updates incident status (OPEN, INVESTIGATING, RESOLVED). Super Admin exclusively. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |

---

## 5. Platform User & Role Governance (`UsersController`, `RolesController`, `AuditController`)

| Method | Route Path | Guards & Decorators | Authorization & Scoping Logic | Anon | Pat | Doc | Rec | Adm-A | Adm-B | Super | Finding Ref |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/users/me` | `JwtAuthGuard` | Retrieves authenticated caller's profile, roles, permissions, and staffAssignments. | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | — |
| `PATCH`| `/users/me` | `JwtAuthGuard`, DTO | Updates caller's display name and avatarUrl. | DENY | OWN | OWN | OWN | OWN | OWN | OWN | — |
| `PATCH`| `/users/me/password` | `JwtAuthGuard`, DTO | Changes password for native auth accounts. | DENY | OWN | OWN | OWN | OWN | OWN | OWN | — |
| `GET` | `/users` | `JwtAuthGuard`, `@Roles('super_admin', 'admin')` | Paginated platform user directory. Missing `staffAssignments` in response. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | `SEC-AUTH-04` |
| `GET` | `/users/:id` | `JwtAuthGuard`, `@Roles('super_admin', 'admin')` | Retrieves user details. Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `PATCH`| `/users/:id/status` | `JwtAuthGuard`, `@Roles('super_admin')` | Activates/suspends user platform-wide. Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `GET` | `/roles` | `JwtAuthGuard`, `@RequirePermissions('roles:read')` | Lists defined RBAC roles. Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `GET` | `/audit-logs` | `JwtAuthGuard`, `@RequirePermissions('audit:read')` | Global audit log trail. Super Admin only. | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | — |
| `GET` | `/docs` | `@Public()` | Swagger OpenAPI documentation. Unauthenticated. | WARN | WARN | WARN | WARN | WARN | WARN | WARN | `SEC-INFRA-01` |
