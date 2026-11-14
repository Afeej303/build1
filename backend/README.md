# Backend — M2

Default owner: M2, the main MVP developer. This directory contains the complete MVP backend, business logic, APIs, validation, authentication/authorization, persistence and backend tests.

M2 owns all functionality required for MVP acceptance. Adapt to the chosen framework or preserve the starter project's existing backend location. Record the actual mapping in `docs/ARCHITECTURE.md`.

The NestJS and Supabase Auth starter is available in this directory. See the [setup guide](docs/reuse.md) for environment and database commands and the [frontend auth guide](docs/frontend-auth.md) for sign-in. Hospital workflow interfaces are defined in [the shared API contract](../docs/API-CONTRACT.md).

## First workflow verification

Apply migrations to a dedicated development database. Sign in once as each test user and call `GET /users/me` for the app ID. Create a Hospital and Department, link the receptionist through ReceptionAssignment, and link the doctor through HospitalQueue.doctorId. Set a unique publicQueueId. Create a synthetic Patient in the same hospital with a UHID and link it to the patient account.

Verify UHID lookup, token issuance, call-next, completion, patient-only tracking, and the anonymized public board. With two waiting tokens, submit two concurrent call-next requests and confirm that only one succeeds. The demo uses STANDARD priority, a sequence-based display number, and null wait estimates. Priority overrides, numbering reset rules and wait estimation remain open.

## Shared test API deployment

In Render, connect the build1 repo and select `backend/render.yaml` as the Blueprint path. The service root is `backend` and the health route is `/health`. Enter the test database URLs, Supabase project URL and publishable key, and the frontend origin when prompted. In the service environment settings, add the downloaded Supabase CA certificate as a secret file named `prod-ca-2021.crt`. The deployment reads it from `/etc/secrets/prod-ca-2021.crt`. Retry deployment after adding the file if the first startup fails.

Confirm `GET /health` reports `database: connected` before sharing the API base URL. The smoke test used temporary users and queue records, so provision separate synthetic fixtures for M1's testing.
