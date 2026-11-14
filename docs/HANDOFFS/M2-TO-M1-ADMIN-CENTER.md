# Handoff: Admin Center Backend — Provisioning, Stats, Incidents

- **Date/time:** 2026-11-14 12:20 UTC
- **From:** M2
- **To:** M1
- **Related task:** MVP-01 (backend complete) → MVP-03, MVP-04, MVP-05
- **Relevant commit:** see latest `main` — "Update docs: Admin Center API contract, integration status, task board, M1 handoff"

## What changed

M2 has implemented and pushed the full Admin Center backend. This covers:

1. **Hospital admin provisioning** — `super_admin` can create Supabase users and assign the `hospital_admin` role in one call.
2. **Staff provisioning** — `hospital_admin` can create `doctor` and `receptionist` accounts within their hospital.
3. **Staff management** — list staff, activate/deactivate/suspend.
4. **Receptionist & counter management** — assignments now enforce tenant isolation and a hard cap of 5 receptionists per department.
5. **Operational statistics** — per-hospital activity logs and performance stats for doctors, receptionists, and appointments; platform-wide stats for `super_admin`.
6. **Incident reporting** — any authenticated user can POST a frontend error report; `super_admin` can list, view, and triage incidents.

All new endpoints are documented in `docs/API-CONTRACT.md` under **§ Admin Center API (SaaS Multi-Hospital)**.

## Files / modules

- `backend/src/hospital/hospital-admin.controller.ts` — new provisioning + staff endpoints (A, B, C, D)
- `backend/src/stats/stats.controller.ts` — new stats + activity endpoints
- `backend/src/incidents/incidents.controller.ts` — incident CRUD
- `docs/API-CONTRACT.md` — new section appended
- `docs/INTEGRATION-STATUS.md` — updated
- `docs/TASK-BOARD.md` — updated
- `docs/HANDOFFS/M2-TO-M1-ADMIN-CENTER.md` — this file

## Interface / configuration impact

### Authentication

Every admin endpoint requires:
```
Authorization: Bearer <supabase_access_token>
```
Obtain the token from Supabase Auth on the frontend (`session.access_token`). The backend validates it and resolves the caller's roles/permissions.

### New environment variable (backend only — M1 does not need this)

```
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # required for provisioning endpoints
```
This key is never exposed to the browser. M1 only forwards the user's own bearer token.

### Provisioning — password handling

> **M1 must NOT collect, generate, or display passwords for provisioned users.**

When M2 creates a Supabase user via the Admin API, Supabase sends the new user a **magic link / password-reset email** automatically. The provisioned user sets their own password on first sign-in. The API response contains only `{ userId, email, name, hospitalId, supabaseUserId }` (or `role`, `departmentId` for staff). No password field is ever returned.

### Role boundary

`hospital_admin` can only assign `doctor` or `receptionist` roles when provisioning staff. Attempting to assign `hospital_admin` or `super_admin` returns:
```json
{ "statusCode": 403, "code": "ROLE_NOT_ASSIGNABLE", "message": "hospital_admin cannot assign this role" }
```

### Incident reporting — React error boundaries

Call `POST /incidents` from your React `componentDidCatch` / `ErrorBoundary`. Example payload:

```json
{
  "severity": "ERROR",
  "message": "Cannot read properties of undefined (reading 'id')",
  "component": "AppointmentList",
  "url": "/appointments",
  "diagnostics": {
    "componentStack": "...",
    "appVersion": "1.0.0",
    "userAgent": "Mozilla/5.0 ..."
  }
}
```

**⚠️ PII / security rule:** The `diagnostics` object must NEVER contain patient names, IDs, PHI, tokens, passwords, or session data. The backend strips known suspicious keys (`token`, `password`, `secret`, `authorization`, `patientId`, `patientNumber`, `displayName`) but **M1 must also sanitize** before sending. When in doubt, omit the key.

The endpoint is rate-limited (max 10 requests per user per minute). On success it returns `201 { id, status: "OPEN" }`.

## How to run or verify

```bash
# Start the backend
cd c:\files\NEST\authentication\build1\backend
npm run start:dev

# Test provisioning (replace TOKEN and IDs with real values from test accounts)
curl -X POST http://localhost:3000/admin/hospitals/<hospitalId>/provision-admin \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"newadmin@example.com","name":"New Admin"}'

# Test incident reporting
curl -X POST http://localhost:3000/incidents \
  -H "Authorization: Bearer <any_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"severity":"ERROR","message":"Test error","component":"TestBoundary","url":"/test","diagnostics":{"appVersion":"1.0.0"}}'
```

Test accounts are available in `backend/.env.m1-all-accounts.json` (super_admin, hospital_admin, doctor, receptionist, patient credentials).

## Tests performed

- `npm run typecheck` — passed (0 errors)
- `npm test` — passed; new unit tests cover provisioning, staff CRUD, stats aggregation, incident lifecycle

## Known limitations / bugs

1. **PII stripping is application-layer only.** The backend drops known suspicious `diagnostics` keys on ingestion, but this is not a cryptographic guarantee. M1 must sanitize client-side before sending.
2. **Supabase Admin API requires `SUPABASE_SERVICE_ROLE_KEY` in production.** Provisioning endpoints will return 500 if this env var is absent. Ensure it is set in the production deployment environment before M1 wires up the provisioning UI.
3. **Receptionist limit is enforced at 5 per department.** The `PUT /admin/departments/:departmentId/receptionists/:userId` endpoint now returns `409 RECEPTIONIST_LIMIT_REACHED` when the cap is hit. M1 should handle this code and show a friendly message.
4. **Stats endpoints return empty arrays** for dates with no activity — M1 should render a zero-state rather than a loading spinner.

## Action needed from recipient

| Action | Owner | Expected outcome |
|---|---|---|
| Wire up provisioning UI to `POST /admin/hospitals/:hospitalId/provision-admin` and `POST /admin/hospitals/:hospitalId/staff` | M1 | MVP-03: super_admin and hospital_admin can create users via UI |
| Connect stats dashboards to new stats endpoints | M1 | MVP-04: Dashboards show live data instead of mocks |
| Add `POST /incidents` call in React error boundaries | M1 | MVP-05: Frontend errors are captured and visible to super_admin |
| Handle new error codes: `RECEPTIONIST_LIMIT_REACHED`, `ROLE_NOT_ASSIGNABLE`, `EMAIL_ALREADY_REGISTERED` | M1 | Users see friendly, actionable error messages |
| Confirm test accounts in `backend/.env.m1-all-accounts.json` are accessible and correct | M1 | Unblocks frontend integration testing |
