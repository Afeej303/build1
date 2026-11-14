# Handoff — First hospital queue API draft

- **Date:** 2026-11-14
- **From:** M2
- **To:** M1
- **Related task:** P-04
- **Relevant commit:** Local draft

## What changed

[API-CONTRACT.md](../API-CONTRACT.md) proposes the first integration journey from sign-in and walk-in token issuance through calling, completion, and patient/public tracking.

## Interface and configuration impact

Review the proposed payloads and authorization for each screen. The frontend would use Supabase sign-in and send the access token to protected NestJS endpoints. The public QR display uses a separate response with queue-level fields. API base URL and polling or realtime behavior are TBD.

## How to review

Walk through these cases using the contract examples:

1. An authorized receptionist issues a token for an existing patient.
2. The assigned doctor calls and completes it. An unassigned doctor is denied.
3. The patient can view their token. A second patient cannot view it.
4. The public display can load without login and contains no patient identifiers.

## Tests performed

Documentation draft only. The build1 backend exposes no endpoints yet.

## Decisions needed from M1

Confirm the fields and errors needed by the receptionist, doctor, patient, and waiting-room screens. Flag whether the first demo needs a registration screen or can use seeded patients. Agree with M2 on staff scope discovery and queue refresh before wiring frontend mocks to the contract.

## Final frontend acceptance review

M1 confirmed exact UHID plus patient name for reception. The doctor dashboard now specifies queue, department and room context, active patient identification, call time, priority and ordered waiting tokens. No patient notes are part of the payload.

The QR opens `/display/board/:publicQueueId`. Signed-in patient tracking uses `/display/track/:tokenId`. The polling defaults are 5 seconds for staff and public views and 10 seconds for patients, with refresh after mutations, on focus and on reconnect.

The contract maps all eight frontend-requested error codes to HTTP statuses. M1 should check the revised shapes and codes against their acceptance criteria before live integration. Backend implementation and verification are pending.
