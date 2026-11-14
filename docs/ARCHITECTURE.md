# Architecture and Ownership

## 1. Architecture summary

- **Application type:** [TODO]
- **Frontend stack:** [TODO]
- **Backend stack:** [TODO]
- **Database/storage:** [TODO]
- **External services:** [TODO]
- **Deployment/runtime:** [TODO]

Do not force a frontend/backend split if the starter project uses another architecture. Describe the actual structure.

## 2. Team ownership

| Member | Primary responsibility | Default path |
|---|---|---|
| M1 | Frontend implementation for MVP | `frontend/` |
| M2 | Main developer; complete MVP backend and business logic | `backend/` and agreed MVP areas |
| M3 | Pre-agreed extra features, integrations and tests, built in parallel | `enhancements/` |

M2 owns all business logic and functionality required for the MVP. M3 owns only agreed enhancements outside the MVP. M1 owns the frontend and coordinates with M2 on API/UI integration.

## 3. Repository map

| Path | Purpose | Primary owner |
|---|---|---|
| `frontend/` | UI, client state and API consumption, if applicable | M1 |
| `backend/` | MVP server, APIs, business logic, persistence and auth, if applicable | M2 |
| `enhancements/` | Additional features beyond MVP, adapters and feature tests | M3 |
| `shared/` | Shared types/contracts/utilities, if needed | Agreement |
| `docs/` | Project and engineering documentation | All; M3 coordinates |

### Actual project mapping
[After inspecting the starter code, replace/amend the table. Preserve existing project structure where appropriate.]

## 4. MVP vs enhancements

- **MVP:** defined in `docs/PROJECT.md`; M1/M2 deliver it.
- **Enhancements:** selected before coding in `docs/EXTRA-FEATURE-PLAN.md`; M3 develops them in parallel.
- An enhancement must not become a hidden MVP dependency unless the team explicitly revises the MVP scope and ownership.

## 5. Component responsibilities and flow

| Component | Responsibility | Inputs | Outputs | Owner |
|---|---|---|---|---|
| Frontend | MVP UI and client behavior | User input, API responses | User-facing views/actions | M1 |
| Backend | Complete MVP business rules and services | Requests, persisted data | Validated responses and state changes | M2 |
| Enhancements | Optional capabilities beyond MVP | Agreed API/module inputs | Enhancement result | M3 |

[Describe actual request/data flow and integration points.]

## 6. Local development

- Prerequisites: [TODO]
- Install: [TODO]
- Configure environment: [TODO]
- Run: [TODO]
- Test: [TODO]

## 7. Environment configuration

| Variable | Used by | Required? | Description | Safe example |
|---|---|---:|---|---|
| `TODO` | [TODO] | Yes/No | [TODO] | [TODO] |

Never include real secrets.

## 8. Dependencies and risks

| From | Depends on | Contract / mechanism | Owner(s) | Risk / fallback |
|---|---|---|---|---|
| Enhancement [EF-XX] | MVP service | [TODO] | M2 + M3 | [TODO] |
