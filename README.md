# Buildathon Project

A shared workspace for a three-person Buildathon practice team.

## Team responsibilities

| Member | Responsibility | Default ownership |
|---|---|---|
| M1 | Frontend implementation for the MVP | `frontend/` |
| M2 | Main developer: complete backend, business logic and all functionality required for the MVP | `backend/` and any agreed MVP areas |
| M3 | Pre-planned extra features: research, implementation and testing in parallel with MVP development | `enhancements/` |

**M2 is the primary MVP developer.** M2 owns the complete MVP's business logic and backend functionality. M1 builds the frontend and coordinates with M2 on the interface. M3 does not own missing MVP work: M3 develops additional, non-MVP features that the team selected before implementation begins.

The folder names are defaults, not a requirement to force a particular architecture. If the chosen starter project has a different structure, document the actual mapping in `docs/ARCHITECTURE.md`.

## First steps for each new practice topic

1. Create a new repository and add M1 and M2 as collaborators.
2. Clone the repository on all three laptops.
3. Give a planning agent the problem brief and ask it to populate the documentation.
4. As a team, define the MVP and its acceptance criteria.
5. **Before coding starts, choose and prioritize M3's extra features** in `docs/EXTRA-FEATURE-PLAN.md`. Agree on their scope, feasibility, integration points and fallback behavior.
6. Agree on architecture and the M1/M2 interface in `docs/ARCHITECTURE.md` and `docs/API-CONTRACT.md`.
7. Assign tasks in `docs/TASK-BOARD.md`.
8. Start the MVP and extra-feature work in parallel.
9. Follow `AGENTS.md` in every agent environment.

## Work split

- **M1:** frontend screens, client-side state, user experience and API consumption.
- **M2:** all MVP backend functionality, business logic, data model, APIs, validation, authentication/authorization and core server-side tests.
- **M3:** only the pre-agreed enhancements beyond MVP. Research, build and test these while M1/M2 build the MVP. Coordinate integration points, but avoid blocking core MVP progress.

## Documentation

- `docs/PROJECT.md` — problem, users, scope, MVP and acceptance criteria
- `docs/EXTRA-FEATURE-PLAN.md` — features selected for M3 before coding
- `docs/ARCHITECTURE.md` — stack, components, folder map and data flow
- `docs/TASK-BOARD.md` — owners, status, dependencies and acceptance criteria
- `docs/API-CONTRACT.md` — agreed interfaces between components
- `docs/DATABASE-SCHEMA.md` — entities, fields and relationships
- `docs/DECISIONS.md` — important decisions and rationale
- `docs/INTEGRATION-STATUS.md` — integration checklist and known issues
- `docs/HANDOFFS/` — concise cross-member handoff notes
- `docs/AGENT-PROMPTS/` — role-specific prompts for M1, M2 and M3

## Run locally

Add actual stack-specific install and run commands after inspecting the selected starter project. Do not invent commands before then.

## Shared-main Git workflow

The team intentionally uses one branch, `main`, for rapid sharing. This is simple but increases the risk of conflicting pushes and temporarily broken code. Read the Git workflow in `AGENTS.md` before committing.
