# Task Board

## Status definitions

- **Backlog:** not started.
- **Ready:** requirements and dependencies are clear.
- **In progress:** actively being implemented.
- **Blocked:** blocker and needed action are stated.
- **Review:** ready for another member to inspect.
- **Done:** acceptance criteria met, checks run and docs updated.

## Planning tasks — complete before coding

| ID | Task | Owner | Priority | Status | Acceptance criteria |
|---|---|---|---|---|---|
| P-01 | Inspect starter project and map actual structure | M2 + M3 | High | Ready | Stack, paths and constraints documented |
| P-02 | Define MVP boundary and acceptance criteria | All | High | Ready | `PROJECT.md` agreed |
| P-03 | Select M3 extra features | All; M3 documents | High | Ready | `EXTRA-FEATURE-PLAN.md` approved before coding |
| P-04 | Agree architecture and API contracts | M1 + M2; M3 consulted | High | Done | `ARCHITECTURE.md` and `API-CONTRACT.md` updated with complete Admin Center & SaaS APIs |
| P-05 | Document database/data model | M2 | High | Done | Complete 27-table Prisma data model and schema specifications documented in `DATABASE-SCHEMA.md`. |

## Implementation tasks

| ID | Task | Owner | Priority | Status | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| MVP-01 | Build complete MVP backend and business logic | M2 | High | Done | P-01, P-02, P-04, P-05 | Deployed commit `b2a7b38` at `192.168.1.249:3000` verified healthy; focused tests passing. |
| MVP-02 | Build MVP frontend and connect to backend | M1 | High | Done | P-02, P-04 | All critical user journeys verified live against M2 contract. |
| SEC-01 | Task 1: M1 Frontend & Identity Remediation | M1 | High | Done | P-04 | Remediate 8 identity/auth vulnerabilities (email substring checks, role separation, dual-role patient access, retryable error handling, cache clearing). 296 test assertions pass; production build succeeds. Verified live against `192.168.1.249:3000`. |
| SEC-02 | Task 2: HQMS Security & Database RLS Review | M1 + M2 | High | Done | SEC-01 | Complete audit of all 27 DB tables; identified `frontend_incidents` PostgREST exposure; formulated exact remediation SQL and rollback SQL for user authorization. |
| MVP-03 | Connect Admin Center to new provisioning endpoints | M1 | High | Done | MVP-01 | Admin Center wired to `POST /admin/hospitals/:id/provision-admin`, `POST /admin/hospitals/:id/staff`, and `PATCH status`. |
| MVP-04 | Connect Admin Center stats to new stat endpoints | M1 | Medium | Done | MVP-01 | Operational stats wired to `GET /admin/hospitals/:id/stats/appointments`, `stats/doctors`, and `/admin/stats`. |
| MVP-05 | Frontend implements incident reporting on error boundaries | M1 | Medium | Done | MVP-01 | Incident logging connected to `POST /incidents` with PII-sanitized telemetry and offline fallback. |
| BUG-01 | Fix patient sign-in blank page caused by MobileFloatingNav hook order | M1 | High | Done | - | Navigation from landing to patient sign-in and back renders without hook errors; verified repeated browser navigation with no console warnings/errors and successful frontend build |
| EXT-01 | Web Speech API Voice Announcements & Chime | M3 | Agreed | Done | P-03, relevant contracts | Web Speech API speech synthesis integrated into `/display` on token calling, complementing Web Audio chime with zero-PII room announcements. |
| EXT-02 | Thermal Token Slip Printing Layout | M3 | Agreed | Done | P-03 | Dedicated `@media print` layout for 80mm/58mm thermal rolls isolating `#thermal-slip` and hiding surrounding UI. |
| EXT-03 | Public TV Waiting Board Zero-PII Display | M3 | Agreed | Done | P-03 | Fullscreen TV display at `/display` and `/display/:roomId` with zero PII and live 5s sync. |
| INT-01 | Integrate and verify end-to-end demo | All | High | Done | MVP-01, MVP-02, EXT-01..03 | All 5 critical user flows verified passing live against deployed backend `b2a7b38`. |

## Task update rules

1. Every task has one directly responsible owner.
2. M2 owns MVP backend/business logic; M1 owns MVP frontend; M3 owns only selected enhancements.
3. Split tasks that cannot be completed and verified in a short work session.
4. Record blockers immediately and name the person/action needed.
5. Keep MVP tasks higher priority than enhancement tasks.
6. Update status as work changes.
7. Do not mark Done without evidence of checks or an explanation why checks were unavailable.

## Current blockers

| Blocker | Impact | Needed from | Status |
|---|---|---|---|
| None currently | - | - | - |
