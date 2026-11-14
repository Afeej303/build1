# API and Interface Contract

> This document is the shared agreement between producers and consumers. It can describe HTTP APIs, local module interfaces, events or another integration mechanism.

## 1. Contract conventions

- **Base URL / transport:** [TODO]
- **Authentication mechanism:** [TODO]
- **Content type / serialization:** [TODO]
- **Common error format:** [TODO]
- **Versioning approach:** [TODO]

Do not invent endpoints or payloads. Mark undecided details as `TBD` and assign an owner.

## 2. Endpoint / interface inventory

| ID | Method / event / function | Path or signature | Purpose | Producer | Consumer | Status |
|---|---|---|---|---|---|---|
| API-001 | [TODO] | [TODO] | [TODO] | M2/M3 | M1/M3 | Proposed |

## 3. Contract detail template

### [API-ID] — [Name]

- **Method and path / signature:** [TODO]
- **Purpose:** [TODO]
- **Authentication:** [TODO]
- **Request:**
```json
{
  "example": "Replace with the agreed request shape"
}
```
- **Success response:**
```json
{
  "example": "Replace with the agreed response shape"
}
```
- **Errors:** [status/code and meaning]
- **Validation rules:** [TODO]
- **Producer owner:** [TODO]
- **Consumer owner:** [TODO]
- **Mock / test location:** [TODO]

## 4. Shared data types

| Type | Fields | Meaning | Source of truth |
|---|---|---|---|
| [TODO] | [TODO] | [TODO] | [TODO] |

## 5. Change process

1. Propose the change and explain why.
2. Identify all producers and consumers affected.
3. Get agreement from affected members before changing implementation.
4. Update this document and mocks/tests.
5. Implement and verify both sides.
6. Record the change in `docs/DECISIONS.md` if it materially changes architecture or behavior.

## 6. Open contract questions

| Question | Owner | Status |
|---|---|---|
| [TODO] | [TODO] | Open |
