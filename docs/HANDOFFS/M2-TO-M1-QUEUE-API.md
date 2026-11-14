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

## Follow-up after M1 review

The [contract revision](../API-CONTRACT.md#revision-for-m1-review) proposes all requested discovery and read interfaces, token slip fields, public QR behavior, errors, and polling defaults. Please compare the acceptance checks with your frontend criteria. Confirm exact patient-number lookup, doctor patient display fields, staff scoping, and the public frontend route before we freeze mocks.


## Updated after M1's screen requirements

The proposed `GET /users/me` now includes multiple staff assignments. Queue lookup provides availability and room details. Patient lookup uses exact UHID. The doctor dashboard restores waiting order, priority labels and the call timestamp, and provides minimum identification for the assigned doctor's active patient. The patient tracker includes department, doctor, room and last update. The print flow uses `issuedAt` and `slip.publicQueueId`. Public QR opens the anonymized queue board.

Review whether UHID and name are enough for receptionist confirmation, whether active patient fields fit the doctor screen, and what frontend route should open from QR. Polling starts at a proposed 5 seconds for staff/public and 10 seconds for patients, with refresh after changes, focus and reconnect. Confirm the draft against M1 acceptance criteria before freezing mocks.
