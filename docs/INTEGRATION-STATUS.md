# Integration Status

Update this document as components become available and are tested together.

## 1. Current status

- **Last updated:** 2026-11-14 12:20 UTC
- **Integrated commit:** d3d709c
- **Overall status:** In progress (Backend complete; ready for M1 Admin Center frontend integration)
- **Known critical blocker:** None currently

## 2. Component readiness

| Component | Owner | Implemented | Locally tested | Integrated | Notes |
|---|---|---:|---:|---:|---|
| Frontend | M1 | No | No | No | Ready to connect to backend Admin Center endpoints |
| Backend | M2 | Yes | Yes | No | Complete MVP backend, SaaS provisioning, stats & incident reporting implemented |
| Feature modules | M3 | No | No | No | Voice announcements enhancement in progress |
| Database | M2 | Yes | Yes | No | Prisma schema migrated with incident models and tenant assignments |
| End-to-end journeys | All | No | No | No | E2E integration pending M1 frontend screens |

## 3. Integration checklist

- [x] All members can clone the repository.
- [x] Setup instructions work on all three laptops.
- [x] Environment variables are documented; no secrets are committed.
- [x] API/interface contract is agreed.
- [ ] Frontend can call the required backend interfaces.
- [ ] Feature modules are connected through agreed interfaces.
- [x] Database schema and migrations match the implementation.
- [x] Critical success paths tested end-to-end (backend smoke tests pass).
- [x] Important failure/validation paths tested.
- [x] Demo account and synthetic data are ready (`backend/.env.m1-all-accounts.json`).
- [x] Known limitations are documented.

## 4. Interface verification

| Interface | Producer | Consumer | Verified by | Result / evidence |
|---|---|---|---|---|
| First walk-in queue workflow (APIs 001-006) | Backend (M2) | Frontend (M1) | M2 local smoke test | Verified with real Supabase Auth accounts |
| Hospital Admin Provisioning (`POST /admin/hospitals/:id/provision-admin`) | Backend (M2) | Frontend (M1) | M2 unit & smoke tests | Verified - Supabase admin user created, local User & HospitalAdminAssignment linked |
| Staff Provisioning & Status (`POST /admin/hospitals/:id/staff`, `PATCH status`) | Backend (M2) | Frontend (M1) | M2 unit & smoke tests | Verified - Staff provisioned with roles, tenant isolation and role boundaries enforced |
| Receptionist Limits & Scoping (`PUT/DELETE /admin/departments/:id/receptionists/:id`) | Backend (M2) | Frontend (M1) | M2 unit tests | Verified - Tenant isolation enforced, 409 `RECEPTIONIST_LIMIT_REACHED` on >5 |
| Hospital Queue List (`GET /admin/hospitals/:id/queues`) | Backend (M2) | Frontend (M1) | M2 unit tests | Verified - Returns all hospital queues across departments with doctor and room info |
| Operational Statistics (`GET /admin/hospitals/:id/stats/*`, `GET /admin/stats`) | Backend (M2) | Frontend (M1) | M2 unit tests | Verified - Doctor, receptionist, appointment aggregations and platform stats |
| Incident Reporting (`POST /incidents`, `GET/PATCH /admin/incidents`) | Backend (M2) | Frontend (M1) | M2 unit tests | Verified - Authenticated error capture, rate-limited, PII sanitized, triage lifecycle |

## 5. Bugs and blockers

| ID | Severity | Description | Owner | Status | Workaround |
|---|---|---|---|---|---|
| None | - | No blocking issues currently | - | Closed | - |

## 6. Known limitations

- Frontend incident reporting diagnostics PII stripping is application-layer only.
- Supabase Admin API for provisioning requires `SUPABASE_SERVICE_ROLE_KEY` in production env.
- Department receptionist capacity is capped at 5 per department.

## 7. Demo readiness

- **Ready journeys:** Core walk-in queue workflow, appointment booking, doctor dashboard, SaaS hospital admin provisioning, staff management, stats aggregation, incident reporting backend.
- **Unready journeys:** M1 frontend UI integration with Admin Center endpoints.
- **Fallback if a live integration fails:** Seeded test accounts and synthetic data in `backend/.env.m1-all-accounts.json` with mocked responses if needed.

## First walk-in workflow verification

The NestJS backend passed a local HTTP smoke test against the shared build1 Supabase test project with four real synthetic Auth accounts. Verified receptionist lookup and issuance, duplicate check-in, doctor scope and dashboard, concurrent call-next, completion, private patient tracking, and public response fields. The test accounts and fixture records were removed after verification. Hosted API verification and frontend integration are pending.
