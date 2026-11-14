# HQMS consolidated integration contract for M1 review

Baseline: official main at 9b6edb81a7781146576c60faa2f7a1b4dd2d5829. See [source audit](M1-BACKEND-GAP-AUDIT.md) for the frontend mapping and [current API contract](API-CONTRACT.md) for shipped interfaces. This draft supersedes endpoint proposals and tracker paths in the audit. Existing contracts below were confirmed in source. Proposed routes and fields require M1 review before implementation or migrations.

| Requirement | Decision | Review needed |
|---|---|---|
| Live mode without automatic mock fallback | APPROVED | M1 owns frontend changes. |
| Reuse hospital activity for facility audit | APPROVED WITH CONDITIONS | Confirm filters, cursor, event coverage and platform access below. |
| Public board and authenticated patient tracker | APPROVED | Confirm own-only reads for dual-role users and the meaning of updatedAt. |
| Invitation-based activation | APPROVED WITH CONDITIONS | Review endpoint and Supabase flow below before implementation. |
| Reception counters and assignments | NEEDS CLARIFICATION | Confirm desk cardinality and whether capacity is contractual. |
| Recurring doctor schedules | NEEDS CLARIFICATION | Confirm slot generation and treatment of existing bookings. |
| Central incidents | NEEDS CLARIFICATION | Confirm reporters, assignees and retention. |
| Operating hours, overrides and broadcasts | NEEDS CLARIFICATION | Confirm precedence, booking effects and audience. |
| Printer registry | NEEDS CLARIFICATION | Confirm supported transports and hardware gateway owner. |
| Mixed live/mock results, public patient PII, password-bearing provisioning responses and remote printing without a gateway | NOT APPROVED | Excluded from the proposed contract. |

## Shared rules for proposed endpoints

Use Supabase bearer authentication and backend-verified identity. URL identifiers select resources. Scope every read and write by active backend assignment and verify nested ownership in the same query or transaction. A hospital admin manages assigned hospitals, with platform-only actions reserved for the super admin. A receptionist can access capabilities specifically granted by an active department or counter assignment. Public projections use explicit field allowlists.

Success responses are JSON unless 204 is indicated. Create returns 201, reads and updates return 200. Proposed collections return { items, nextCursor }, with a default limit of 50 and maximum of 100. Validate filters, UUIDs, date ranges and enum fields. Reuse the existing error envelope including statusCode, error, message and code where provided. Return 401 for absent or invalid sessions, 403 for missing role or permission, 404 for missing or out-of-scope resources, and 409 for lifecycle or version conflicts. Time instants use ISO 8601 UTC. Recurring schedules use local wall times plus an IANA timezone.

Administrative database writes and their audit events commit together. Audit records include actor, scope, action, target, time and an allowlisted change summary. Any external side effect has a separately tracked delivery outcome. Index foreign keys and dominant scoped filters. New backend-owned tables need explicit Supabase Data API grants and RLS decisions. Publish approved DTOs and error cases in OpenAPI.

## Live integration — APPROVED

M1 selects live or demo mode at startup. Live mode surfaces network, authentication, validation and server errors with loading, empty, error and retry states. A successful empty response alone produces the empty state. A mutation succeeds only on a successful live response. Refetch affected queries after successful writes. Demo mode uses separate clients and cache keys, with an explicit build or startup switch. Remove bundled credentials and demo identifiers from live builds. Account rotation remains an owner-coordinated operation.

## Facility audit — APPROVED WITH CONDITIONS

**Existing** GET /admin/hospitals/{hospitalId}/activity?date=YYYY-MM-DD returns { items }. Each item has id, departmentId, departmentName, actorId, action, tokenId, appointmentId, reason and createdAt. The existing date window uses UTC+05:30 and the response caps at 500. The backend resolves actor from the session. Super admins can select any hospital. Other actors need a HospitalAdminAssignment for the requested hospital. ReceptionAssignment is irrelevant. GET /staff/audit-log remains the desk stream. GET /audit-logs is the separate permission-gated platform security stream using audit:read. Confirm that hospital roles never receive platform audit access.

**Proposal** Extend the same GET with departmentId?, actorId?, from?, to?, cursor?, limit?. Accept legacy date or a paired from/to UTC range with an exclusive upper bound. Preserve the existing date-only response and behavior. Expanded queries return { items, nextCursor } ordered by createdAt and id descending. Bind cursor to scope and filters. Reject a department outside the hospital. Preserve existing fields and add hospitalId and source where verified. Hospital-level events need an explicit hospital scope and nullable department. Use HospitalActivity for operations and preserve AuditLog for platform security. Index hospital/time/id and verify filtered query plans. Approve administrative event coverage and safe reason visibility before expanding the stream.

## Board and tracker — APPROVED

### Public UI /display/:publicQueueId

GET /public/queues/{publicQueueId} is unauthenticated and returns:

    { publicQueueId: string, departmentName: string, roomLabel: string|null,
      currentDisplayNumber: string|null, waitingCount: number,
      estimatedWaitMinutes: number|null, updatedAt: ISODateTime }

Unknown slugs return 404 RESOURCE_NOT_FOUND. The printed public QR opens /display/{publicQueueId}. Keep patient identity, UHID, appointment identifiers and individual token IDs out of the public response and QR. Refresh every five seconds by default with focus and reconnect refresh. The current updatedAt is the queue record timestamp. It is unsuitable as a standalone event cursor or proof of freshness. Use successful fetch time for TV freshness until a data revision is agreed.

### Authenticated UI /track

- GET /users/me/queue-tokens?status=active → { items: PatientToken[] }. Active means WAITING or CALLED.
- GET /queue-tokens/{tokenId} → PatientToken. The backend filters by authenticated user ownership. Unknown or unowned IDs return 404 TOKEN_NOT_FOUND.
- GET /users/me/appointments?from={UTC}&to={UTC} → { items: Appointment[] }. Current source accepts a valid range up to 31 days and returns appointments owned by the caller or assigned to the caller as doctor. The patient tracker requires an own-only backend view for any dual-role caller. Proposal: add scope=patient, enforce the patient ownership predicate, keep existing behavior for existing callers and have M1 always send scope=patient. This parameter is proposed and is unavailable in the pinned source.

    PatientToken = { id, queueId, displayNumber: string, status, issuedAt,
      departmentName, doctorName: string|null, roomLabel: string|null,
      patientsAhead: number, estimatedWaitMinutes: number|null, updatedAt }
    Appointment = { id, status, queueTokenId: string|null, slot: {
      id, queueId, startsAt, endsAt, departmentName,
      doctorName: string|null, roomLabel: string|null } }

Use appointment queueTokenId for detail reads after check-in. Poll active token state every ten seconds by default. Refetch after actions, focus and reconnect. Polling is the current live update mechanism. Preserve terminal status via token detail when the token leaves the active list. Confirm whether owned dependent profiles appear in the same tracker or require explicit profile selection.

## Staff invitations — APPROVED WITH CONDITIONS

Existing provisioning and assignment controllers link Supabase identities and establish local role grants. Current password-based provisioning needs a migration path to one invitation lifecycle. Continue reusing verified identity mapping and existing assignment records after acceptance. Hospital admins can invite only doctor or receptionist staff in their own hospitals. Only super admins can invite hospital admins. Platform-role grants have a separate privileged flow.

| Proposed API | Request | Response |
|---|---|---|
| POST /admin/hospitals/{hospitalId}/staff-invitations | { email, displayName, role, departmentId?, queueId? } and Idempotency-Key header | 201 Invitation |
| GET /admin/hospitals/{hospitalId}/staff-invitations | status?, role?, cursor?, limit? | { items: Invitation[], nextCursor } |
| GET /admin/hospitals/{hospitalId}/staff-invitations/{id} | Path IDs | Invitation |
| POST /admin/hospitals/{hospitalId}/staff-invitations/{id}/resend | No body. Reissue and invalidate the prior app activation secret. | Invitation |
| DELETE /admin/hospitals/{hospitalId}/staff-invitations/{id} | Pending invite ID | 204 after revocation |
| POST /staff-invitations/accept | Verified Supabase bearer session plus { activationToken } | { invitationId, userId, hospitalId, role, assignmentIds, acceptedAt } |

Invitation contains id, hospitalId, email, displayName, role, departmentId, queueId, status, deliveryStatus, expiresAt, createdAt, acceptedAt and revokedAt. Nullable scope and lifecycle fields use null. Status is PENDING, ACCEPTED, REVOKED or EXPIRED. Delivery status is QUEUED, SENT or FAILED. Neither the password nor activation link is returned to the admin.

1. Store StaffInvitation with hospital, optional department/queue, normalized email, role, inviter, token digest, expiry, accepted user and timestamps. Reuse User, HospitalAdminAssignment, ReceptionAssignment and queue doctor relationships. Validate role-specific scope and queue eligibility. Enforce at most one effective pending invite per normalized email, role and identical scope. Proposed app expiry is 24 hours, bounded by the actual provider link validity where applicable.
2. Deliver through a retryable server worker with an allowlisted redirect and server-only Supabase admin credentials. For new identities, evaluate the Supabase Admin invite flow or server-generated invite links with approved SMTP so the app activation secret can travel in the intended workflow. For existing Supabase identities, use an app invitation email and require sign-in to that verified account. Never reset an existing password or merge identities based on an email string alone.
3. Use the provider's supported callback/session exchange. New users set their password with Supabase in the activation session. Validate provider identity and verified email server-side. Prototype the password completion gate for new accounts against actual provider capabilities before accepting this contract. Existing verified identities retain their authentication method.
4. In one transaction lock the pending invitation, check digest, expiry, revocation and verified identity, recheck scope eligibility, activate the user assignment and consume the invite. A repeat from the same accepting identity can return the prior receipt without reapplying grants. Provide stable INVITATION_EXPIRED, INVITATION_REVOKED, INVITATION_ALREADY_ACCEPTED and INVITATION_CONFLICT codes where appropriate. Revocation removes pending authorization even if an email link still permits Supabase sign-in. Audit creation, resend, revocation, acceptance and delivery failure without recording links or tokens.

Reuse one provisioning service across staff and hospital admin paths. Plan legacy caller migration with M1. Confirm email limits, SMTP, callback allowlist, provider expiry and cleanup of orphaned pending identities in a test project. The provider flow is a design proposal and has not been validated against a live configuration.

## Remaining resource contracts — NEEDS CLARIFICATION

| Feature and existing capability | Proposed operations and DTO | Database and scope |
|---|---|---|
| Reception counters. Departmental receptionist GET/PUT/DELETE already exists. Counter data in the UI is synthetic. | GET/POST /admin/departments/{id}/counters; GET/PATCH/DELETE /admin/departments/{id}/counters/{counterId}. Write { label, number, enabled } → { id, departmentId, label, number, enabled, updatedAt }. Extend existing receptionist assignment path with PATCH { counterId?, status? } → { userId, departmentId, counterId, status }. DELETE archives or clears assignment as appropriate. | Add Counter, unique active number per department and indexed optional counter relation on ReceptionAssignment. Enforce same-department counter and active hospital assignment. Confirm whether a counter has multiple operators and who can change capacity. |
| Recurring doctors. Appointments already read concrete slots and DoctorBreak exists. | GET/POST /admin/hospitals/{id}/doctor-schedules; GET/PATCH/DELETE /admin/hospitals/{id}/doctor-schedules/{scheduleId}. Write { queueId, doctorId, weekday, startLocal, endLocal, slotMinutes, effectiveFrom, effectiveTo?, version? } → schedule with id, timezone, version and updatedAt. GET collection supports doctorId, queueId and effective date filters. | Add DoctorSchedule scoped by queue and doctor. Reuse slot publication service and check doctor assignment, overlapping schedules, breaks, facility hours and concurrent writes. Confirm generation horizon, DST policy, delegated write permission and handling of existing booked slots. |
| Incidents. POST /incidents and platform GET/PATCH /admin/incidents already persist FrontendIncident. Hospital UI is browser-only. | Extend POST /incidents { title, severity, category, diagnosticCode?, componentKey?, safeMetadata?, hospitalId?, departmentId? } → { id, status, createdAt }. GET /admin/hospitals/{id}/incidents, GET/PATCH detail and GET detail/history. Filters include status, severity, assigneeUserId, from/to. PATCH { severity?, status?, assigneeUserId?, version } → incident summary. Keep platform list/detail and add platform history. | Add verified hospital/department scope, assigned investigator and IncidentEvent. Reporters supply a resource selector and the server validates membership. Hospital managers see own incidents. Unscoped events are platform-only. Restrict and redact diagnostic fields. Confirm retention and who can assign investigations. |
| Operating hours and exceptions. Queue acceptance is currently a manual flag. | GET/PUT /admin/hospitals/{id}/operating-hours and GET/PUT/DELETE /admin/departments/{id}/operating-hours. PUT { timezone, weekly: [{ weekday, windows: [{ opensAt, closesAt }] }], version? } → schedule plus updatedAt. Department inherits facility timezone and DELETE resets inheritance. GET/POST /admin/hospitals/{id}/schedule-exceptions and GET/PATCH/DELETE on each exception. Write { departmentId?, kind, startsAt, endsAt, windows?, reasonCode?, version? } → exception. GET /hospitals/{id}/operating-status?departmentId=&at= → { isOpen, timezone, effectiveSource, nextChangeAt }. | Add OperatingSchedule and ScheduleException. One shared evaluator. Proposed precedence is emergency closure, then dated exception, department schedule and hospital default. Admin writes require hospital scope. Staff/patient reads require appropriate hospital context. Confirm holiday precedence, overnight windows and effects on existing bookings. |
| Emergency broadcasts. The patient activity feed supplies individual updates. | GET/POST /admin/hospitals/{id}/broadcasts; GET/PATCH/DELETE detail. Write { title, message, severity, startsAt, expiresAt, departmentId?, audience, version? } → broadcast with id and status. DELETE retracts. GET /hospitals/{id}/broadcasts → active authorized broadcasts for that caller. | Add Broadcast with verified tenant and optional department. Derive audience visibility server-side. Confirm explicit public audience approval before expanding the board DTO. Filter active messages by timestamp. External delivery is a separate dependency. |
| Printer registry. The UI displays a profile, and token DTOs support slip rendering. | GET/POST /admin/hospitals/{id}/printers and GET/PATCH/DELETE detail. Write { name, transport, deviceRef?, networkAddress?, profile: { paperWidthMm: 80, feedLines, cutMode }, version? } → Printer with id, status and lastSeenAt. PUT/DELETE /admin/departments/{id}/counters/{counterId}/printer with { printerId } for PUT. GET /staff/counters/{counterId}/printer returns workstation-safe fields. | Add Printer and scoped counter assignment with tenant-verified foreign keys. Restrict network details to admin/gateway roles. Report UNKNOWN until trusted telemetry exists. Archive with history. WebUSB needs browser permission. LPR and a cloud spooler need a trusted gateway on the printer network, heartbeat, authenticated jobs and receipts, bounded retries and duplicate handling. Registry phase has zero remote printing APIs. |

## Review and verification gates

1. P0. M1 reviews live mode, tracking, scoped audit and invitation contracts. Verify cross-hospital access failures, mixed-role patient isolation, anonymous board field allowlist, concurrent booking and repeated check-in with the same token.
2. P0. Review persistent desks and recurring schedule semantics. Prototype invitation callback, expiration, revoked link and existing identity cases before any migration.
3. P1. Approve schedules, exceptions, incidents, broadcasts and registry after roles, audiences, retention and schema changes are agreed. Document approved APIs in OpenAPI.
4. P2. Evaluate hardware gateway and background delivery separately. Existing polling covers initial live display. No realtime or gateway dependency was verified.

This review is source-based. No database, Supabase account, API, frontend or M3 changes were made as part of this document, and no live testing was performed.
