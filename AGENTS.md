# Shared Agent Instructions

These instructions apply to every coding agent working in this repository.

## 1. Read before acting

Read `README.md` and the relevant project documents before planning or editing:
- `docs/PROJECT.md`
- `docs/EXTRA-FEATURE-PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/TASK-BOARD.md`
- `docs/API-CONTRACT.md`
- `docs/DATABASE-SCHEMA.md`
- `docs/DECISIONS.md`
- `docs/INTEGRATION-STATUS.md`
- Your role prompt in `docs/AGENT-PROMPTS/`

If information is missing, identify it and ask/record an open question. Do not invent requirements, endpoints, schemas, credentials or infrastructure.

## 2. Team roles — follow this split

### M1 — Frontend developer
Owns the MVP frontend: UI, client-side state, accessibility, responsive behavior and API consumption. Coordinates interface details with M2.

### M2 — Main MVP developer
M2 is the primary developer and owns the complete MVP's backend, business logic and all functionality required for the MVP. This includes server-side behavior, APIs, authentication/authorization, validation, persistence, core business rules and backend tests. M2 is responsible for making the MVP function end-to-end with M1.

### M3 — Extra-feature developer
M3 works in parallel with M1 and M2 to research, implement and test additional features that are outside the agreed MVP. The team must select and prioritize these features in `docs/EXTRA-FEATURE-PLAN.md` before implementation begins. M3's default workspace is `enhancements/`.

M3 is not the owner of unfinished MVP business logic. Do not move MVP requirements to M3 merely because they are complex. If a proposed feature is necessary for the MVP to meet its acceptance criteria, it belongs in the MVP plan and is owned by M1/M2 according to the architecture.

## 3. Feature selection before coding

Before implementation:
1. M1, M2 and M3 agree on the MVP boundary and acceptance criteria.
2. Together, choose M3's extra features. Evaluate user value, demo impact, feasibility, time, dependencies, risk and integration cost.
3. Mark each feature as `Selected`, `Optional` or `Rejected` in `docs/EXTRA-FEATURE-PLAN.md`.
4. Define each selected feature's scope, owner (M3), acceptance criteria, dependencies, interface/integration point and fallback if unfinished.
5. Ensure the extra-feature plan does not remove time or resources required for the MVP.
6. Only then begin parallel implementation.

Do not independently invent or start a large enhancement that has not been agreed by the team.

## 4. Ownership and shared files

Default areas:
- M1: `frontend/`
- M2: `backend/` and agreed MVP implementation areas
- M3: `enhancements/`
- Shared: root configuration, `shared/`, docs and integration wiring

These are conventions. Follow the actual ownership map in `docs/ARCHITECTURE.md` if the starter project differs. Do not edit another member's owned files without coordination. Coordinate changes to shared files and interfaces before editing.

## 5. Planning and implementation

- Confirm the task exists in `docs/TASK-BOARD.md` and has an owner.
- Work only on the agreed task and scope.
- Inspect existing code before proposing replacements.
- Preserve project conventions unless a change is agreed and documented.
- Prefer small, reviewable changes over rewrites.
- Do not duplicate existing functionality.
- Do not commit secrets, tokens, private data or local environment files.
- Use environment variables; update `.env.example` with names and safe placeholders only.
- Explain new dependencies and document setup changes.

## 6. Contracts and integration

- Treat `docs/API-CONTRACT.md` as the shared agreement.
- M2 is the primary owner of MVP backend contracts; M1 and M3 are consumers/partners as applicable.
- M3 must coordinate any enhancement interface with M2 and, if it affects UI, M1.
- Never silently rename endpoints, fields, types, events or error formats.
- Keep mocks aligned with agreed contracts.
- For external services, document credentials/configuration, cost/rate limits, failure behavior and fallback. Never hardcode secrets.

## 7. Testing and quality

Before reporting completion:
- Run relevant tests, linting, type checks or build commands available.
- Add/update tests for new logic and bug fixes.
- Test success, validation failure and relevant error paths.
- Verify that changes respect contracts and do not break MVP journeys.
- If checks cannot run, state why. Never claim unrun tests passed.

M3 must test enhancements independently and verify their integration path without destabilizing the MVP. The MVP remains the primary delivery priority.

## 8. Documentation

Update docs when scope, architecture, APIs, schema, dependencies, setup, integration or known issues change. M3 updates the extra-feature plan and integration status for enhancement work. Use `docs/HANDOFFS/HANDOFF-TEMPLATE.md` for cross-member handoffs.

## 9. Shared `main` branch rules

The team uses only `main`; do not create feature branches unless the team changes this policy.

Before starting:
```bash
git status
git pull --ff-only origin main
```

Work only in your agreed area. Before committing:
```bash
git status
git diff
```

Stage only intended files:
```bash
git add path/to/your/files
git commit -m "Add concise description"
```

Before pushing:
```bash
git pull --rebase origin main
git push origin main
```

If a conflict occurs, stop and coordinate with the affected member. Do not use `reset --hard`, force-push or discard another member's changes. Resolve collaboratively, run relevant tests, and continue. If uncertain, use `git rebase --abort` and ask for help.

Never run `git push --force` or `git push --force-with-lease`. Avoid `git add .` blindly.

Because all members push to one branch, simultaneous pushes can be rejected and overlapping edits can conflict. Communicate before shared-file changes, commit small changes, pull frequently, and avoid editing the same files concurrently.

## 10. Agent completion report

Report:
1. What was implemented.
2. Files created/changed.
3. Interfaces, dependencies or configuration affected.
4. Tests/build/lint commands run and actual results.
5. Known bugs, limitations and unverified assumptions.
6. Action needed from another member.
7. Documentation updated.

Do not claim integration merely because code works locally.


## Task Board Ownership

- Every member is responsible for keeping their assigned tasks updated.
- Agents must update task status for their assigned work.
- When multiple agents work under one member, their coordinator
  consolidates task updates.
- The human member reviews and confirms agent updates.
- M1 owns frontend task tracking.
- M2 owns backend task tracking and overall MVP progress.
- M3 owns enhancement task tracking and feature testing.
- All members must report blockers and cross-module dependencies.
- Never mark a task complete without verifying its acceptance criteria.