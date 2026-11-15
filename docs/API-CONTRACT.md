# API and Interface Contract

**Status:** Updated after M1 feedback for final acceptance review under P-04. No build1 endpoints are implemented yet. This draft covers the first walk-in journey within the [hospital MVP](mvp.md).

## Conventions

- JSON over HTTP. Deployment URL and API prefix are TBD.
- Protected requests send `Authorization: Bearer <Supabase access token>`. The NestJS starter verifies identity and resolves app roles and permissions from the database.
- Public signup can establish patient access. Staff access requires an authorized assignment. Hospital and department boundaries and doctor queue assignments are enforced by the server.
- Error responses use `{ statusCode, code, message }`. The machine-readable `code` is required for the cases defined below. Use 400 for malformed input, 401 for missing or invalid authentication, 403 for forbidden actions, 404 for unavailable resources, and 409 for conflicting queue transitions. Return structured errors without private patient details.

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
| Confirm staff assignment scope rules. | M1 + M2 |
| Which patient lookup and registration screens are required for the first integration? | M1 + M2 |
| How do priority, tie-breaking, duplicate check-in, and repeat transitions work? | M2 + team |
| Define how wait estimates are calculated. | M1 + M2 |
| Which enhancement interfaces need contracts in this slice? | M3 + M2 |
| What triggers rescheduling and when is patient confirmation required? | M1 + M2 |

M1 and M2 agree on paths, fields, errors, and acceptance checks before implementation. Update the shared contract and relevant mocks together when an agreed interface changes.

## Revision for M1 review

The following proposals extend the first slice. IDs are opaque strings. All list endpoints return `{ "items": [...] }`. Empty collections return 200 with an empty array. Exact UHID lookup returns 404 when no accessible patient matches.

| Interface | Access and response item |
|---|---|
| `GET /staff/queues?departmentId=...` | Signed-in staff. Return accessible queues with `id`, `name`, `department: { id, name }`, `doctor: { id, name }` or null, `roomLabel` or null, and `acceptingWalkIns` (boolean availability for walk-ins). Doctors see assigned queues. Receptionists see queues within their authorized scope. The department filter is optional. |
| `GET /staff/patients/lookup?patientNumber=...` | Authorized receptionist. Exact UHID lookup using the `patientNumber` query parameter returns `items` containing one `{ id, patientNumber, displayName }` within staff scope. The returned `id` is the `patientId` for check-in. Confirm the match using UHID and name. Exact UHID is the lookup method for this slice. No match returns 404 with `PATIENT_NOT_FOUND`. |
| `GET /queues/{queueId}/dashboard` | Assigned doctor or authorized receptionist. Return `{ queueId, department: { id, name }, roomLabel, activeToken, waitingTokens, updatedAt }`. `activeToken` is null when idle. The room label is nullable. Both token views include core token fields and a staff-only `priority` label. Array order is the waiting order. Priority labels and ordering rules remain TBD. The active token includes `calledAt`. For the assigned doctor it also includes `patient: { id, patientNumber, displayName }`. The waiting list omits patient identification. |
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

The authorized staff queue list also includes `publicQueueId` for generating waiting-room QR codes. The frontend builds its public page URL from that identifier and calls API-006. The printed QR opens `/display/board/:publicQueueId`. The signed-in frontend route `/display/track/:tokenId` loads an individual token through API-005. The QR opens the aggregate display. A patient's personal position uses API-005 with authentication and ownership checks. Token slips can be rendered and printed from the frontend.

### Machine-readable errors

| HTTP | Code | Client handling |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Show invalid fields and allow correction. |
| 401 | `AUTHENTICATION_REQUIRED` | Refresh the session or return to sign-in. |
| 403 | `INSUFFICIENT_PERMISSION` | Show that the action is unavailable to the current role or assignment. |
| 404 | `RESOURCE_NOT_FOUND` | Refresh a stale resource selection when a more specific code does not apply. |
| 403 | `UNAUTHORIZED_QUEUE_ACCESS` | The signed-in staff member lacks access to the requested queue. |
| 404 | `TOKEN_NOT_FOUND` | The requested token is missing or hidden from the caller. Use the same response for another patient's token. |
| 404 | `PATIENT_NOT_FOUND` | No accessible patient matches the UHID or submitted patient ID. |
| 409 | `QUEUE_NOT_AVAILABLE` | An accessible queue is currently closed to walk-ins. Refresh queue selection. |
| 409 | `DUPLICATE_WALK_IN` | Refresh queue state and show that the patient already has an active token in the selected queue. |
| 409 | `NO_ELIGIBLE_TOKENS` | Refresh and show that no token can be called now. |
| 409 | `CONSULTATION_ALREADY_ACTIVE` | Refresh and restore the active token. |
| 409 | `INVALID_STATE_TRANSITION` | Refresh and show the current state. |

Queue mutations must check authorization before returning workflow conflicts. Duplicate check-in means one active token per patient per queue in this proposal. Any broader duplicate rule remains open.

### Refresh behavior

Start with configurable polling at 5 seconds for staff and public views and 10 seconds for signed-in patient tracking. Refresh affected queries immediately after successful mutations and after a queue conflict. Pause polling on hidden tabs. Refresh on window focus, when the tab becomes visible again, and when connectivity returns. Stop polling an individual token once terminal. Prevent overlapping requests and back off after repeated failures. Keep the last successful view visible with a stale or offline indicator during interruptions. Realtime notifications can be added later using the same HTTP views.

### Acceptance checks for M1 and M2

- A receptionist can discover a queue and find a seeded patient by UHID, issue a token, and render a slip.
- Reloading the doctor's dashboard restores the active token and waiting list. A doctor outside the assignment is denied.
- Competing call-next requests leave a single active token and the other request receives a conflict code.
- A patient can restore their active token after reload. Another patient receives 404 with `TOKEN_NOT_FOUND` for that token.
- A public QR opens `/display/board/:publicQueueId` and loads the queue display without sign-in and exposes no private token or patient details.

## First workflow ordering

Call the oldest eligible waiting token first, ordered by issue time then a unique database-generated sequence. The waiting list and call-next operation use the same ordering. Priority override behavior remains open for team confirmation.

## Appointment booking and cancellation draft

Proposed for M1 and M2 review. This slice covers published doctor slots, booking, listing and cancellation. Existing walk-ins continue through the queue workflow. Automatic rescheduling, reminders and appointment check-in rules need separate agreement.

| ID | Proposed interface | Access | Success |
|---|---|---|---|
| API-007 | `GET /queues/{queueId}/appointment-slots?from=...&to=...` | Signed-in patient or assigned staff | 200 with `{ items }` of published, available slots in a bounded date range |
| API-008 | `POST /appointments` | Patient for their own record in the queue's hospital, or receptionist assigned to its department | 201 with the booked appointment |
| API-009 | `GET /users/me/appointments?from=...&to=...` | Signed-in patient or assigned doctor | 200 with `{ items }` scoped to the caller's patient record or assigned queues |
| API-010 | `POST /appointments/{appointmentId}/cancel` | Owning patient or assigned receptionist | 200 with the cancelled appointment |

A slot includes `id`, `queueId`, `startsAt`, `endsAt`, `departmentName`, and nullable `doctorName` and `roomLabel`. Send UTC timestamps and display them in the agreed hospital timezone. A booking request includes `slotId`. Reception also sends `patientId` from UHID lookup. Patient requests derive the patient record from the authenticated app account and the slot's hospital.

Proposed booking response:

```json
{
  "id": "<appointment ID>",
  "status": "BOOKED",
  "slot": {
    "id": "<slot ID>",
    "queueId": "<queue ID>",
    "startsAt": "2026-11-15T05:30:00Z",
    "endsAt": "2026-11-15T05:45:00Z",
    "departmentName": "General Medicine",
    "doctorName": "Demo Doctor",
    "roomLabel": "Demo Room 1"
  }
}
```

The response uses the existing error envelope. Proposed codes are `SLOT_UNAVAILABLE` (409) when a published slot becomes unavailable, `APPOINTMENT_NOT_FOUND` (404) when missing or hidden, and `INVALID_APPOINTMENT_TRANSITION` (409) when cancellation is disallowed. Apply ownership and staff-scope checks before disclosing appointment details.

### Acceptance checks

- A patient can discover a published slot, book it and see it again after refresh.
- Two concurrent booking attempts for one slot leave one active booking. The other request receives `SLOT_UNAVAILABLE`.
- A receptionist can book in their assigned department for a patient in the same hospital. A receptionist outside that scope cannot book.
- An assigned doctor can list appointments for their queues. Another patient cannot access or cancel a booking they do not own.
- A successful cancellation releases a future slot if it remains published and eligible for booking.

### Open decisions for M1 and M2

- Who publishes and edits slots, and how the patient finds queues to book.
- Hospital timezone, allowed booking range, slot length and cancellation cutoff.
- How a patient with multiple matching records selects the right record and which staff fields the appointment list needs.
- How booked patients check in and enter the live queue, and when automatic rescheduling asks for confirmation.

### Publishing and check-in

- `POST /queues/{queueId}/appointment-slots` accepts `{ startsAt, endsAt }` as ISO timestamps with explicit offsets. The assigned doctor receives `201` with the slot shape. Overlapping slots across their queues return `409 APPOINTMENT_SLOT_OVERLAP`.
- `POST /appointments/{appointmentId}/check-in` accepts no body. Assigned receptionists receive `200` with the core queue token shape. A booked appointment can be checked in on its calendar day in Asia/Kolkata. Repeat requests return the same token. A separate active token in the same queue returns `409 DUPLICATE_WALK_IN`.

### Patient discovery and registration

All three routes require a Supabase bearer token.

| Interface | Response |
|---|---|
| `GET /appointment-queues` | `{ items }` of queues with active assigned doctors. Each item includes `id`, `name`, `roomLabel`, `hospital: { id, name }`, `departmentName`, and `doctorName`. |
| `GET /users/me/patients` | `{ items }` of patient records linked to the signed-in account. Each item includes `id`, `hospitalId`, `patientNumber`, and `displayName`. |
| `POST /patients/self` | `201` with the patient record. Send `{ hospitalId, displayName }`. The server generates the UHID on first registration and returns the existing record on repeat. |

Select a queue, register at its hospital if needed, then load available slots using that queue ID. Self-registration returns `404 HOSPITAL_NOT_FOUND` for an unknown hospital or `409 PATIENT_NOT_AVAILABLE` when existing linked records require reception to resolve the match.

### Receptionist registration for walk-ins

Send `{ queueId, displayName }` to `POST /staff/patients` when the patient has no existing record. The caller must be assigned to the selected queue's department as a receptionist. The server uses that department's hospital and returns `201` with `{ id, hospitalId, patientNumber, displayName }`. An inaccessible queue returns `403 UNAUTHORIZED_QUEUE_ACCESS`.

Use the returned `id` as `patientId` in the existing `POST /walk-ins` request. Keep the returned record after registration so a failed token request can be retried without creating another patient. Each successful registration creates a new record. Use UHID lookup for returning patients. Reception registration creates an unlinked patient, so staff should provide the token slip for the public queue board.

### Live integration additions

- `GET /users/me/patients` includes nullable `phone`, `gender`, and `dateOfBirth` alongside `displayName` (full name). `PATCH /users/me/patients/{patientId}` updates the caller's own record and returns the profile. Send any of `displayName`, `phone`, `gender`, or `dateOfBirth`. Submit date of birth as YYYY-MM-DD. Responses serialize it at UTC midnight. Use null to clear optional fields.
- `GET /staff/appointments?from=...&to=...` lists appointments in the receptionist's assigned departments. Each row includes `id`, `status`, `slot`, `queueTokenId`, and `patient: { id, patientNumber, displayName }`. The date range uses an inclusive start and exclusive end, up to 31 days. Use earlier ranges for history.
- Appointment responses include `queueTokenId`, which is null until check-in. The check-in response is the queue token itself. Use its `id` with `GET /queue-tokens/{tokenId}`.
- Booking the same slot twice returns `409 SLOT_UNAVAILABLE`. Booking overlapping slots for the same patient record returns `409 PATIENT_APPOINTMENT_OVERLAP`.
- `GET /staff/audit-log` returns the latest 100 events across the caller's assigned reception departments. Each item has `id`, `departmentId`, `actorId`, `action`, `createdAt`, `appointmentId`, `tokenId`, and `source`. Booking sources are `ONLINE` and `RECEPTION`. Events start with this release and include appointment booking, cancellation, check-in, walk-in registration and issuance, call-next, and consultation completion. Retried check-in does not add another event.
- Email/password auth and session refresh use Supabase Auth. Google sign-in requires enabling Google in the Supabase project and configuring the frontend callback.

### Skipped and missed tokens

The assigned doctor can send a bodyless `POST /queue-tokens/{tokenId}/skip` or `POST /queue-tokens/{tokenId}/missed`. Both respond with `200` and the existing token response shape. These actions transition `CALLED` to the terminal status `SKIPPED` or `MISSED` and free the queue for call-next. A token in any other state returns `409 INVALID_STATE_TRANSITION`. Patient tracking exposes the final status, while the public board and active lists omit terminal tokens. The audit log records `TOKEN_SKIPPED` or `TOKEN_MARKED_MISSED`.

### Hospital administration

These endpoints require a bearer token for a user with the global `super_admin` role. Use the existing `GET /users` endpoint to find active application user IDs.

| Method and path | Request | Success |
|---|---|---|
| `GET /admin/hospitals` | None | 200 array of hospitals with departments, queues, and receptionist user IDs |
| `POST /admin/hospitals` | `{ name }` | 201 hospital |
| `POST /admin/hospitals/{hospitalId}/departments` | `{ name }` | 201 department |
| `POST /admin/departments/{departmentId}/queues` | `{ name, roomLabel? }` | 201 queue with a generated `publicQueueId` |
| `PATCH /admin/queues/{queueId}` | `{ doctorId?, acceptingWalkIns? }` | 200 updated queue. Send `doctorId: null` to clear the assignment. |
| `PUT /admin/departments/{departmentId}/receptionists/{userId}` | None | 200 with `{ departmentId, userId }`. Repeats keep the same assignment. |
| `DELETE /admin/departments/{departmentId}/receptionists/{userId}` | None | 204, including when the assignment was already absent |

Assign existing active accounts by their app user ID. Users without the global super-admin role receive 403.

### Delegated hospital administrators

The platform `super_admin` can grant hospital access with `PUT /admin/hospitals/{hospitalId}/admins/{userId}` and revoke it with `DELETE` on the same path. The grant returns `200` with `{ hospitalId, userId }`. Revocation returns `204`. Use the active signed-in user's application ID from `GET /users/me`.

`GET /admin/hospitals` returns every hospital for platform super admins and only assigned hospitals for delegated admins. A user without either type of access receives `403`. Use the returned list to populate the hospital selector. The response includes `admins: [{ userId }]` alongside the existing departments list.

Delegated admins can use the department, queue, doctor and receptionist management routes within their assigned hospitals. An out-of-scope resource returns `404`. Hospital creation, granting or revoking hospital admin access, and the global user directory require platform privileges. Staff assignment accepts an existing active app user ID.

### Queue priority and wait estimates

The assigned doctor can send `{ priority, reason }` to `POST /queue-tokens/{tokenId}/priority` for a waiting token. Use `1` for priority and `0` for standard. Call-next and patient position use priority first, then issue time and sequence. The audit event `TOKEN_PRIORITY_CHANGED` includes the reason, actor and timestamp. The public board does not expose the reason.

Patient tracking and the public board estimate wait from the latest 20 completed consultation durations and the number ahead. The estimate is null before a completed duration is available. The public estimate is for a new arrival at the end of the queue.

### Queue transfers

Send `{ queueId }` to `POST /queue-tokens/{tokenId}/transfer`. Reception must be assigned to both departments, and both queues must belong to the same hospital. A waiting walk-in can move to a queue accepting walk-ins. It keeps its token ID and display number and joins the destination at the current time within its priority class. The endpoint returns the updated token with status 200. Called tokens and appointment tokens require a different workflow and return `409 INVALID_STATE_TRANSITION`. A conflicting active token in the destination returns `409 DUPLICATE_WALK_IN`. Cross-department transfers appear in both departments' audit logs.

### Daily hospital reports

Authorized administrators can retrieve `GET /admin/hospitals/{hospitalId}/report?date=YYYY-MM-DD` or download its department totals from `GET /admin/hospitals/{hospitalId}/report.csv?date=YYYY-MM-DD`. The report uses Asia/Kolkata calendar days. The JSON response includes the unique patient count and each department's token count, completed count, and average minutes from issuance to call. The CSV uses department IDs. The reports contain aggregate data.

### Dependent profiles

Register your own profile at the hospital with `POST /patients/self`, then send `{ hospitalId, displayName }` to `POST /patients/dependents`. Each successful request creates a dependent with its own UHID. `GET /users/me/patients` lists the primary and dependent profiles with an `isDependent` flag. Use the existing profile PATCH endpoint to add demographic details to an owned dependent.

Pass the selected dependent's `patientId` with `slotId` to `POST /appointments`. Omitting `patientId` selects only the primary profile. The server checks account ownership or reception assignment and the slot's hospital. The existing owned appointment and token lists include dependents.

### Signup confirmation in the test project

Use Supabase email/password signup. If Supabase returns a session, continue to onboarding immediately. If the session is null, show the email confirmation prompt. On the build1 test project, turning off **Confirm email** in the Supabase Email provider avoids sending a signup confirmation email. This dashboard setting is separate from the backend migration. Password recovery still sends email.

For patient identification, render a QR containing only the patient's UHID. Reception scans it into the existing `GET /staff/patients/lookup?patientNumber=...` flow and verifies the returned name. The QR carries no demographic information and grants no access by itself.

### Reschedule to the next available slot

The patient account that owns the booking or an assigned receptionist can send `{ currentSlotId }` to `POST /appointments/{appointmentId}/reschedule`. The request moves a future `BOOKED` appointment to the earliest later available slot in the same queue that does not overlap another active appointment for the patient. It keeps the appointment ID, releases the original slot and returns the updated appointment. This action takes effect immediately and records `APPOINTMENT_RESCHEDULED`.

If the booking changed since it was loaded or can no longer be moved, the API returns `409 INVALID_APPOINTMENT_TRANSITION`. If a suitable slot is unavailable or another booking claims it first, the API returns `409 SLOT_UNAVAILABLE` and preserves the current booking.

### Doctor breaks

The assigned doctor can create a break with `POST /users/me/doctor-breaks` and body `{ startsAt, endsAt }` using ISO timestamps with offsets. A break conflicting with a booked or checked-in appointment returns `409 BREAK_OVERLAPS_BOOKING`. A break overlapping another break returns `409 BREAK_OVERLAP`.

List your breaks with `GET /users/me/doctor-breaks?from=...&to=...` and remove a break with `DELETE /users/me/doctor-breaks/{breakId}` (204). Slot discovery hides slots overlapping breaks. Booking and rescheduling enforce the same restriction. Resolve existing bookings before adding a conflicting break.

### Patient notifications

Call `GET /users/me/notifications` with the patient's bearer token. It returns `{ items }` with up to 50 events for the signed-in account's own and dependent profiles, newest first. Each event contains `id`, `action`, `createdAt`, and nullable `appointmentId` and `tokenId`.

Actions cover bookings, rescheduling, cancellations, check-in, walk-in issuance, call-next, completion, skipped tokens, and missed tokens. Use the IDs to open the existing appointment list or token tracker. Poll this endpoint for updates. This feed provides recorded activity and has no read receipts or scheduled delivery.

### PDF report export

Call `GET /admin/hospitals/{hospitalId}/report.pdf?date=YYYY-MM-DD` with an authorized admin bearer token. It returns a PDF attachment with the daily patient count and department aggregates. It uses the same hospital scope and date range as the JSON report.

## Admin Center API (SaaS Multi-Hospital)

This section documents the administrative and operational endpoints supporting multi-hospital SaaS provisioning, counter management, operational metrics, and client error reporting.

### Summary of endpoints

| ID | Method | Path | Access role | Description | Success |
|---|---|---|---|---|---|
| ADM-001 | `POST` | `/admin/hospitals/:hospitalId/provision-admin` | `super_admin` | Create Supabase auth user and assign `hospital_admin` role | 201 Created with provisioned admin profile |
| ADM-002 | `POST` | `/admin/hospitals/:hospitalId/staff` | `hospital_admin` | Provision doctor or receptionist account within tenant | 201 Created with staff details |
| ADM-003 | `GET` | `/admin/hospitals/:hospitalId/staff` | `hospital_admin`, `super_admin` | List all staff members in the hospital | 200 OK with staff items |
| ADM-004 | `PATCH` | `/admin/hospitals/:hospitalId/staff/:userId/status` | `hospital_admin` | Update staff account status (`ACTIVE`, `INACTIVE`, `SUSPENDED`) | 200 OK with updated user status |
| ADM-005 | `PUT` | `/admin/departments/:departmentId/receptionists/:userId` | `hospital_admin`, `super_admin` | Assign receptionist to department (enforces isolation + max 5 per dept) | 200 OK with assignment |
| ADM-006 | `DELETE` | `/admin/departments/:departmentId/receptionists/:userId` | `hospital_admin`, `super_admin` | Remove receptionist assignment from department | 204 No Content |
| ADM-007 | `GET` | `/admin/departments/:departmentId/receptionists` | `hospital_admin`, `super_admin` | List receptionists assigned to a department | 200 OK with receptionist array |
| ADM-008 | `GET` | `/admin/hospitals/:hospitalId/queues` | `hospital_admin`, `super_admin` | List all queues across departments in hospital | 200 OK with queue items |
| ADM-009 | `GET` | `/admin/hospitals/:hospitalId/activity?date=YYYY-MM-DD` | `hospital_admin`, `super_admin` | Daily operational activity log | 200 OK with activity events |
| ADM-010 | `GET` | `/admin/hospitals/:hospitalId/stats/doctors?date=YYYY-MM-DD` | `hospital_admin`, `super_admin` | Doctor consultation & performance metrics | 200 OK with doctor metrics |
| ADM-011 | `GET` | `/admin/hospitals/:hospitalId/stats/receptionists?date=YYYY-MM-DD` | `hospital_admin`, `super_admin` | Receptionist token issuance and check-in metrics | 200 OK with receptionist metrics |
| ADM-012 | `GET` | `/admin/hospitals/:hospitalId/stats/appointments?date=YYYY-MM-DD` | `hospital_admin`, `super_admin` | Aggregated appointment status counts | 200 OK with appointment metrics |
| ADM-013 | `GET` | `/admin/stats` | `super_admin` | Platform-wide operational statistics | 200 OK with global statistics |
| ADM-014 | `POST` | `/incidents` | Any authenticated user | Submit client runtime error / exception report | 201 Created with incident confirmation |
| ADM-015 | `GET` | `/admin/incidents` | `super_admin` | List incident reports (filters: `status`, `severity`) | 200 OK with incident list |
| ADM-016 | `GET` | `/admin/incidents/:id` | `super_admin` | Inspect full incident details with diagnostic payload | 200 OK with incident details |
| ADM-017 | `PATCH` | `/admin/incidents/:id` | `super_admin` | Update incident status (`OPEN`, `INVESTIGATING`, `RESOLVED`) | 200 OK with updated incident |

---

### Endpoint specifications and payloads

#### ADM-001 · Provision hospital administrator
- **Access:** `super_admin` only
- **Behavior:** Invokes Supabase Admin API to create auth credentials (`email_confirm: true`, no password required). Creates local `User` record, assigns `HospitalAdminAssignment`, and grants `hospital_admin` global role. User completes authentication via Supabase magic link / password reset.

**Request:**
```json
{
  "email": "admin.metro@example.com",
  "name": "Metro Admin User"
}
```

**Success Response (201 Created):**
```json
{
  "userId": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "email": "admin.metro@example.com",
  "name": "Metro Admin User",
  "hospitalId": "hosp_1a2b3c4d",
  "supabaseUserId": "sup_8f7e6d5c-4b3a-2109-8765-43210fedcba9"
}
```

#### ADM-002 · Provision staff member
- **Access:** `hospital_admin` (scoped to their own hospital)
- **Rules:** Cannot assign `hospital_admin` or `super_admin` role (`403 ROLE_NOT_ASSIGNABLE`). If `role` is `receptionist` and `departmentId` is supplied, creates a `ReceptionAssignment`.

**Request:**
```json
{
  "email": "dr.sharma@example.com",
  "name": "Dr. Amit Sharma",
  "role": "doctor",
  "departmentId": "dept_cardiology"
}
```

**Success Response (201 Created):**
```json
{
  "userId": "usr_2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
  "email": "dr.sharma@example.com",
  "name": "Dr. Amit Sharma",
  "role": "doctor",
  "hospitalId": "hosp_1a2b3c4d",
  "departmentId": "dept_cardiology"
}
```

#### ADM-003 · List hospital staff
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Success Response (200 OK):**
```json
{
  "items": [
    {
      "id": "usr_2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
      "name": "Dr. Amit Sharma",
      "email": "dr.sharma@example.com",
      "status": "ACTIVE",
      "role": "doctor",
      "departmentAssignments": [
        {
          "departmentId": "dept_cardiology",
          "departmentName": "Cardiology"
        }
      ]
    }
  ]
}
```

#### ADM-004 · Update staff status
- **Access:** `hospital_admin` (scoped to own staff)
- **Request:**
```json
{
  "status": "SUSPENDED"
}
```
*Allowed status values: `ACTIVE`, `INACTIVE`, `SUSPENDED`.*

- **Success Response (200 OK):**
```json
{
  "id": "usr_2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
  "email": "dr.sharma@example.com",
  "name": "Dr. Amit Sharma",
  "status": "SUSPENDED"
}
```

#### ADM-005 · Assign receptionist with limit check
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Rules:** Tenant isolation enforced against department's hospital. Maximum 5 receptionists per department. Re-assigning an already assigned receptionist returns 200 without duplicate count.
- **Request:** No body. Path parameters: `:departmentId`, `:userId`.
- **Success Response (200 OK):**
```json
{
  "departmentId": "dept_cardiology",
  "userId": "usr_receptionist_01"
}
```

#### ADM-006 · Remove receptionist assignment
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Request:** No body.
- **Success Response (204 No Content)**

#### ADM-007 · List department receptionists
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Success Response (200 OK):**
```json
{
  "items": [
    {
      "userId": "usr_receptionist_01",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "status": "ACTIVE"
    }
  ]
}
```

#### ADM-008 · List hospital queues
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Success Response (200 OK):**
```json
{
  "items": [
    {
      "id": "q_cardio_1",
      "name": "Cardiology General Queue",
      "departmentId": "dept_cardiology",
      "departmentName": "Cardiology",
      "roomLabel": "Room 101",
      "doctorId": "usr_2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
      "doctorName": "Dr. Amit Sharma",
      "acceptingWalkIns": true,
      "publicQueueId": "cardio-gen-101"
    }
  ]
}
```

#### ADM-009 · Hospital activity log
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Query Params:** `date` (format: `YYYY-MM-DD`, default: today)
- **Success Response (200 OK):**
```json
{
  "date": "2026-11-14",
  "hospitalId": "hosp_1a2b3c4d",
  "events": [
    {
      "id": "evt_001",
      "timestamp": "2026-11-14T08:30:00Z",
      "type": "TOKEN_ISSUED",
      "actorId": "usr_receptionist_01",
      "departmentId": "dept_cardiology",
      "details": "Walk-in token A-014 issued"
    }
  ]
}
```

#### ADM-010 · Doctor performance stats
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Query Params:** `date` (format: `YYYY-MM-DD`)
- **Success Response (200 OK):**
```json
{
  "date": "2026-11-14",
  "hospitalId": "hosp_1a2b3c4d",
  "doctors": [
    {
      "doctorId": "usr_2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
      "doctorName": "Dr. Amit Sharma",
      "departmentName": "Cardiology",
      "consultationsCompleted": 18,
      "averageConsultationMinutes": 12.5,
      "skippedTokens": 1,
      "missedTokens": 0
    }
  ]
}
```

#### ADM-011 · Receptionist activity stats
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Query Params:** `date` (format: `YYYY-MM-DD`)
- **Success Response (200 OK):**
```json
{
  "date": "2026-11-14",
  "hospitalId": "hosp_1a2b3c4d",
  "receptionists": [
    {
      "receptionistId": "usr_receptionist_01",
      "name": "Rajesh Kumar",
      "tokensIssued": 42,
      "appointmentsCheckedIn": 15
    }
  ]
}
```

#### ADM-012 · Hospital appointment stats
- **Access:** `hospital_admin` (own hospital), `super_admin`
- **Query Params:** `date` (format: `YYYY-MM-DD`)
- **Success Response (200 OK):**
```json
{
  "date": "2026-11-14",
  "hospitalId": "hosp_1a2b3c4d",
  "summary": {
    "totalBooked": 60,
    "checkedIn": 52,
    "cancelled": 5,
    "completed": 48,
    "noShow": 3
  }
}
```

#### ADM-013 · Platform operational statistics
- **Access:** `super_admin` only
- **Success Response (200 OK):**
```json
{
  "totalHospitals": 12,
  "activeDoctors": 84,
  "activeReceptionists": 36,
  "activeQueues": 92,
  "tokensIssuedToday": 1420,
  "consultationsCompletedToday": 1285,
  "openIncidents": 2
}
```

#### ADM-014 · Submit incident report
- **Access:** Any authenticated user
- **Rate Limit:** 10 requests / minute / user
- **Request:**
```json
{
  "severity": "ERROR",
  "message": "Cannot read properties of undefined (reading 'queueId')",
  "component": "QueueDashboard",
  "url": "/doctor/dashboard",
  "diagnostics": {
    "stack": "TypeError: Cannot read properties...",
    "appVersion": "1.0.0",
    "userAgent": "Mozilla/5.0..."
  }
}
```
*Allowed severity values: `INFO`, `WARNING`, `ERROR`, `CRITICAL`.*

- **Success Response (201 Created):**
```json
{
  "id": "inc_7a8b9c0d-1e2f",
  "status": "OPEN",
  "createdAt": "2026-11-14T09:15:00Z"
}
```

#### ADM-015 · List incidents
- **Access:** `super_admin` only
- **Query Params:** `status` (`OPEN`, `INVESTIGATING`, `RESOLVED`), `severity` (`INFO`, `WARNING`, `ERROR`, `CRITICAL`), `limit`, `offset`
- **Success Response (200 OK):**
```json
{
  "items": [
    {
      "id": "inc_7a8b9c0d-1e2f",
      "severity": "ERROR",
      "message": "Cannot read properties of undefined (reading 'queueId')",
      "component": "QueueDashboard",
      "status": "OPEN",
      "reporterId": "usr_doctor_12",
      "createdAt": "2026-11-14T09:15:00Z"
    }
  ]
}
```

#### ADM-016 · Get incident details
- **Access:** `super_admin` only
- **Success Response (200 OK):**
```json
{
  "id": "inc_7a8b9c0d-1e2f",
  "severity": "ERROR",
  "message": "Cannot read properties of undefined (reading 'queueId')",
  "component": "QueueDashboard",
  "url": "/doctor/dashboard",
  "status": "OPEN",
  "reporterId": "usr_doctor_12",
  "diagnostics": {
    "stack": "TypeError: Cannot read properties...",
    "appVersion": "1.0.0",
    "userAgent": "Mozilla/5.0..."
  },
  "createdAt": "2026-11-14T09:15:00Z",
  "updatedAt": "2026-11-14T09:15:00Z"
}
```

#### ADM-017 · Update incident status
- **Access:** `super_admin` only
- **Request:**
```json
{
  "status": "RESOLVED"
}
```
*Allowed status values: `OPEN`, `INVESTIGATING`, `RESOLVED`.*

- **Success Response (200 OK):**
```json
{
  "id": "inc_7a8b9c0d-1e2f",
  "status": "RESOLVED",
  "updatedAt": "2026-11-14T09:45:00Z"
}
```

---

### Machine-readable error codes (Admin & Incidents)

| HTTP | Code | Description & Client Handling |
|---|---|---|
| 409 | `RECEPTIONIST_LIMIT_REACHED` | Returned by `PUT /admin/departments/:departmentId/receptionists/:userId` when a department already has 5 active receptionists. UI should prompt user to remove an existing receptionist first. |
| 403 | `ROLE_NOT_ASSIGNABLE` | Returned by `POST /admin/hospitals/:hospitalId/staff` when a `hospital_admin` attempts to provision forbidden roles (`hospital_admin` or `super_admin`). |
| 409 | `EMAIL_ALREADY_REGISTERED` | Returned by provisioning endpoints when the provided email already exists in Supabase identity provider. Prompt user to use a different email or link existing account. |
| 400 | `VALIDATION_ERROR` | Required fields missing or malformed (e.g. invalid email format, unknown status or severity enum value). |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, expired, or invalid Supabase bearer token. |
| 403 | `INSUFFICIENT_PERMISSION` | Caller does not possess the required global role or tenant scope. |
| 404 | `RESOURCE_NOT_FOUND` | Specified hospital, department, queue, user, or incident does not exist within the caller's authorized scope. |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded. The `Retry-After` header gives the wait time in seconds. |

Appointment reads use the default route limit (60 requests per minute by default). The additional `auth` bucket applies only to the NestJS authentication controller, which is unavailable in Supabase mode. Supabase handles its own provider-side limits. Rejected validation attempts count against the applicable buckets because throttling runs before DTO validation. The limit for `POST /incidents` remains 10 submissions per minute.

On 400, correct the request before retrying. On 429, pause polling and retries for the indicated interval, then resume the usual cadence. If no header is available, use bounded exponential backoff with jitter. Avoid automatically retrying mutations unless the operation is known to be idempotent.
