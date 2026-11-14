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
| API-001 | `GET /users/me` | Signed-in user | 200 app profile with global roles, permissions, and staff assignments |
| API-002 | `POST /walk-ins` | Receptionist authorized for the queue | 201 token for an existing patient |
| API-003 | `POST /queues/{queueId}/call-next` | Doctor assigned to the queue | 200 called token, or 409 if there is no eligible token or a consultation is already active |
| API-004 | `POST /queue-tokens/{tokenId}/complete` | Doctor responsible for the active token | 200 completed token, or 409 if the transition is no longer valid |
| API-005 | `GET /queue-tokens/{tokenId}` | Patient who owns the token | 200 personal queue status |
| API-006 | `GET /public/queues/{publicQueueId}` | Public QR or waiting-room display | 200 public queue summary |

### API-001 · Current user

Proposed response excerpt, extending the starter profile:

```json
{"id":"<app user ID>","email":"patient@example.com","name":"Patient","roles":[],"permissions":[],"staffAssignments":[]}
```

The profile ID is the app user ID. Patient records use a separate patient ID. Global roles and permissions describe platform access. The proposed `staffAssignments` array contains entries with `role`, `hospitalId`, `department: { id, name }` or null, and `queues: [{ id, name, doctorName, roomLabel }]`. Doctor and room labels are nullable. Each entry represents one authorized scope. A hospital-wide assignment can have a null department. The UI supports multiple entries and uses the staff queue endpoint for current availability.

### API-002 · Issue a walk-in token

Request:

```json
{"patientId":"<patient ID>","queueId":"<queue ID>"}
```

Response:

```json
{"id":"<token ID>","queueId":"<queue ID>","displayNumber":"A-014","status":"WAITING","issuedAt":"2026-11-14T05:30:00Z"}
```

The server validates the patient record and staff access to the selected queue and generates the display number. Start with a pre-existing patient record for this slice. Guest registration, dependent relationships, duplicate check-in behavior, and how reception looks up patient IDs need agreement.

### API-003 and API-004 · Call and complete

Both requests have no body. Each returns the core API-002 token fields with updated status, excluding the slip. The call response includes `calledAt` as an ISO timestamp. Proposed sequence is `WAITING → CALLED → COMPLETED`. For this slice, `CALLED` represents the active token. Claim the next eligible token atomically so competing requests cannot call two tokens for the same queue. Apply the completion only to the current assigned token. Repeated completion returns 409 under this proposal. Priority ordering and tie-breaking are TBD.

### API-005 · Patient token status

```json
{"id":"<token ID>","queueId":"<queue ID>","displayNumber":"A-014","status":"WAITING","departmentName":"General Medicine","doctorName":"Dr. Rao","roomLabel":"Room 2","patientsAhead":2,"estimatedWaitMinutes":null,"updatedAt":"2026-11-14T05:30:00Z"}
```

Derive the patient identity from the authenticated account. Another patient cannot retrieve the token. `estimatedWaitMinutes` is nullable until an estimate is available.

### API-006 · Public queue status

```json
{"publicQueueId":"<public queue ID>","departmentName":"General Medicine","roomLabel":"Room 2","currentDisplayNumber":"A-014","waitingCount":3,"estimatedWaitMinutes":null,"updatedAt":"2026-11-14T05:30:00Z"}
```

The public response includes an aggregate waiting count and the current display number. It excludes patient names, contact details, patient identifiers, internal token IDs, and priority reasons. The current display number is nullable when idle. Doctor and room labels are nullable where unavailable. See Refresh behavior for the initial transport and cadence.

## Decisions to close

| Question | Owner |
|---|---|
| Confirm staff assignment scopes and the frontend public QR route. | M1 + M2 |
| Which patient lookup and registration screens are required for the first integration? | M1 + M2 |
| How do priority, tie-breaking, duplicate check-in, and repeat transitions work? | M2 + team |
| Confirm polling defaults and define how wait estimates are calculated. | M1 + M2 |
| Which enhancement interfaces need contracts in this slice? | M3 + M2 |
| What triggers rescheduling and when is patient confirmation required? | M1 + M2 |

M1 and M2 agree on paths, fields, errors, and acceptance checks before implementation. Update the shared contract and relevant mocks together when an agreed interface changes.

## Revision for M1 review

The following proposals extend the first slice. IDs are opaque strings. All list endpoints return `{ "items": [...] }`. Empty collections return 200 with an empty array.

| Interface | Access and response item |
|---|---|
| `GET /staff/queues?departmentId=...` | Signed-in staff. Return accessible queues with `id`, `name`, `department: { id, name }`, `doctor: { id, name }` or null, `roomLabel` or null, and `acceptingWalkIns` (boolean availability for walk-ins). Doctors see assigned queues. Receptionists see queues within their authorized scope. The department filter is optional. |
| `GET /staff/patients/lookup?patientNumber=...` | Authorized receptionist. Exact UHID lookup using the `patientNumber` query parameter returns `items` containing at most one `{ id, patientNumber, displayName }` within staff scope. The returned `id` is the `patientId` for check-in. Confirm the match using UHID and name. Name and phone search remain TBD. |
| `GET /queues/{queueId}/dashboard` | Assigned doctor or authorized receptionist. Return `{ activeToken, waitingTokens, updatedAt }`. `activeToken` is null when idle. Both views include core token fields and a staff-only `priority` label. Array order is the waiting order. Priority labels and ordering rules remain TBD. The active token includes `calledAt`. For the assigned doctor it also includes `patient: { id, patientNumber, displayName }`. The waiting list omits patient identification. |
| `GET /users/me/queue-tokens?status=active` | Patient. Return only their `WAITING` and `CALLED` tokens using the API-005 shape, so the UI can restore tracking after refresh. |

### Token slip and QR

Extend API-002's success response with `slip`:

```json
{
  "departmentName": "General Medicine",
  "roomLabel": "Room 2",
  "publicQueueId": "general-medicine-2"
}
```

The authorized staff queue list also includes `publicQueueId` for generating waiting-room QR codes. The frontend builds its public page URL from that identifier and calls API-006. The frontend route is for M1 to confirm. The QR opens the aggregate display. A patient's personal position uses API-005 with authentication and ownership checks. Token slips can be rendered and printed from the frontend.

### Machine-readable errors

| HTTP | Code | Client handling |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Show invalid fields and allow correction. |
| 401 | `AUTHENTICATION_REQUIRED` | Refresh the session or return to sign-in. |
| 403 | `INSUFFICIENT_PERMISSION` | Show that the action is unavailable to the current role or assignment. |
| 404 | `RESOURCE_NOT_FOUND` | Refresh stale selections. Use this for another patient's private token to avoid revealing whether it exists. |
| 409 | `DUPLICATE_CHECK_IN` | Refresh queue state and show that the patient already has an active token in the selected queue. |
| 409 | `NO_WAITING_TOKENS` | Refresh and show an empty queue. |
| 409 | `ACTIVE_TOKEN_EXISTS` | Refresh and restore the active token. |
| 409 | `INVALID_TOKEN_TRANSITION` | Refresh and show the current state. |

Queue mutations must check authorization before returning workflow conflicts. Duplicate check-in means one active token per patient per queue in this proposal. Any broader duplicate rule remains open.

### Refresh behavior

Start with configurable polling at 5 seconds for staff and public views and 10 seconds for signed-in patient tracking. Refresh affected queries immediately after successful mutations and after a queue conflict. Pause polling on hidden tabs. Refresh on window focus, when the tab becomes visible again, and when connectivity returns. Stop polling an individual token once terminal. Prevent overlapping requests and back off after repeated failures. Keep the last successful view visible with a stale or offline indicator during interruptions. Realtime notifications can be added later using the same HTTP views.

### Acceptance checks for M1 and M2

- A receptionist can discover a queue and find a seeded patient by UHID, issue a token, and render a slip.
- Reloading the doctor's dashboard restores the active token and waiting list. A doctor outside the assignment is denied.
- Competing call-next requests leave a single active token and the other request receives a conflict code.
- A patient can restore their active token after reload. Another patient receives a 404 for that token.
- A public QR loads the queue display without sign-in and exposes no private token or patient details.
