# API and Interface Contract

**Status:** Proposed for M1/M2 review under P-04. No build1 endpoints are implemented yet. This draft covers the first walk-in journey within the [hospital MVP](mvp.md).

## Conventions

- JSON over HTTP. Deployment URL and API prefix are TBD.
- Protected requests send `Authorization: Bearer <Supabase access token>`. The NestJS starter verifies identity and resolves app roles and permissions from the database.
- Public signup can establish patient access. Staff access requires an authorized assignment. Hospital and department boundaries and doctor queue assignments are enforced by the server.
- Proposed error body includes `statusCode`, `message`, and an optional machine-readable `code`. Use 400 for malformed input, 401 for missing or invalid authentication, 403 for forbidden actions, 404 for unavailable resources, and 409 for conflicting queue transitions. Return structured errors without private patient details.

## First integration slice

All paths, fields, and queue state names below are proposals except `GET /users/me`, which already exists in the standalone starter and would be carried into build1.

| ID | Proposed interface | Access | Success |
|---|---|---|---|
| API-001 | `GET /users/me` | Signed-in user | 200 app profile with global roles and permissions |
| API-002 | `POST /walk-ins` | Receptionist authorized for the queue | 201 token for an existing patient |
| API-003 | `POST /queues/{queueId}/call-next` | Doctor assigned to the queue | 200 called token, or 409 if there is no eligible token or a consultation is already active |
| API-004 | `POST /queue-tokens/{tokenId}/complete` | Doctor responsible for the active token | 200 completed token, or 409 if the transition is no longer valid |
| API-005 | `GET /queue-tokens/{tokenId}` | Patient who owns the token | 200 personal queue status |
| API-006 | `GET /public/queues/{publicQueueId}` | Public QR or waiting-room display | 200 public queue summary |

### API-001 · Current user

Response excerpt from the starter:

```json
{"id":"<app user ID>","email":"patient@example.com","name":"Patient","roles":[],"permissions":[]}
```

The profile ID is the app user ID. Patient records use a separate patient ID. The starter returns global roles and permissions. How the UI discovers hospital-scoped staff assignments is TBD.

### API-002 · Issue a walk-in token

Request:

```json
{"patientId":"<patient ID>","queueId":"<queue ID>"}
```

Response:

```json
{"id":"<token ID>","queueId":"<queue ID>","displayNumber":"A-014","status":"WAITING"}
```

The server validates the patient record and staff access to the selected queue and generates the display number. Start with a pre-existing patient record for this slice. Guest registration, dependent relationships, duplicate check-in behavior, and how reception looks up patient IDs need agreement.

### API-003 and API-004 · Call and complete

Both requests have no body. Each returns the API-002 token shape with the updated status. Proposed sequence is `WAITING → CALLED → COMPLETED`. For this slice, `CALLED` represents the active token. Claim the next eligible token atomically so competing requests cannot call two tokens for the same queue. Apply the completion only to the current assigned token. Repeated completion returns 409 under this proposal. Priority ordering and tie-breaking are TBD.

### API-005 · Patient token status

```json
{"id":"<token ID>","queueId":"<queue ID>","displayNumber":"A-014","status":"WAITING","patientsAhead":2,"estimatedWaitMinutes":null}
```

Derive the patient identity from the authenticated account. Another patient cannot retrieve the token. `estimatedWaitMinutes` is nullable until an estimate is available.

### API-006 · Public queue status

```json
{"publicQueueId":"<public queue ID>","currentDisplayNumber":"A-014","waitingCount":3,"estimatedWaitMinutes":null,"updatedAt":"2026-11-14T05:30:00Z"}
```

The public response includes an aggregate waiting count and the current display number. It excludes patient names, contact details, patient identifiers, internal token IDs, and priority reasons. The current display number is nullable when idle. Refresh transport and cadence are TBD.

## Decisions to close

| Question | Owner |
|---|---|
| How should the UI discover staff scope and navigate after sign-in? | M1 + M2 |
| Which patient lookup and registration screens are required for the first integration? | M1 + M2 |
| How do priority, tie-breaking, duplicate check-in, and repeat transitions work? | M2 + team |
| What refresh mechanism and wait estimate should the two tracking screens use? | M1 + M2 |
| Which enhancement interfaces need contracts in this slice? | M3 + M2 |
| What triggers rescheduling and when is patient confirmation required? | M1 + M2 |

M1 and M2 agree on paths, fields, errors, and acceptance checks before implementation. Update the shared contract and relevant mocks together when an agreed interface changes.
