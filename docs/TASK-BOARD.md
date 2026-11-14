# Task Board

## Status definitions

- **Backlog:** not started.
- **Ready:** requirements and dependencies are clear.
- **In progress:** actively being implemented.
- **Blocked:** blocker and needed action are stated.
- **Review:** ready for another member to inspect.
- **Done:** acceptance criteria met, checks run and docs updated.

## Planning tasks — complete before coding

| ID | Task | Owner | Priority | Status | Acceptance criteria |
|---|---|---|---|---|---|
| P-01 | Inspect starter project and map actual structure | M2 + M3 | High | Ready | Stack, paths and constraints documented |
| P-02 | Define MVP boundary and acceptance criteria | All | High | Ready | `PROJECT.md` agreed |
| P-03 | Select M3 extra features | All; M3 documents | High | Ready | `EXTRA-FEATURE-PLAN.md` approved before coding |
| P-04 | Agree architecture and API contracts | M1 + M2; M3 consulted | High | Ready | `ARCHITECTURE.md` and `API-CONTRACT.md` usable |
| P-05 | Document database/data model | M2 | High | Ready | `DATABASE-SCHEMA.md` matches MVP plan |

## Implementation tasks

| ID | Task | Owner | Priority | Status | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| MVP-01 | Build complete MVP backend and business logic | M2 | High | Backlog | P-01, P-02, P-04, P-05 | MVP server-side acceptance criteria pass |
| MVP-02 | Build MVP frontend and connect to backend | M1 | High | Backlog | P-02, P-04 | Critical user journeys work against M2 contract |
| EXT-01 | Build selected P1 enhancements | M3 | Agreed | Backlog | P-03, relevant contracts | Enhancement criteria and tests pass |
| INT-01 | Integrate and verify end-to-end demo | All | High | Backlog | MVP-01, MVP-02, EXT-01 as applicable | MVP works; selected enhancements integrate without breaking it |

## Task update rules

1. Every task has one directly responsible owner.
2. M2 owns MVP backend/business logic; M1 owns MVP frontend; M3 owns only selected enhancements.
3. Split tasks that cannot be completed and verified in a short work session.
4. Record blockers immediately and name the person/action needed.
5. Keep MVP tasks higher priority than enhancement tasks.
6. Update status as work changes.
7. Do not mark Done without evidence of checks or an explanation why checks were unavailable.

## Current blockers

| Blocker | Impact | Needed from | Status |
|---|---|---|---|
| [None / TODO] | | | |
