# M3 Extra-Feature Plan

This document must be completed and agreed by all three members **before implementation begins**.

M3's role is to develop and test additional features in parallel while M1 and M2 build the MVP. These features are not required for the MVP's acceptance criteria. They should add meaningful differentiation without putting MVP delivery at risk.

## 1. Selection rules

Evaluate each candidate against:
- User value and relevance to the problem
- Demo impact / visible differentiation
- Feasibility within the available time
- Dependencies on M1, M2, data or external services
- Integration effort and risk
- Cost, API limits, connectivity and fallback options

Do not select a feature solely because it uses AI, OSINT, maps or another fashionable technology. It must solve a real user problem and be demonstrable.

## 2. Candidate features

| ID | Feature idea | User value | Demo impact | Feasibility | Dependencies / risk | Decision |
|---|---|---|---|---|---|---|
| EF-01 | [Describe a candidate] | High/Med/Low | High/Med/Low | High/Med/Low | [TODO] | Proposed |

Decision values: `Selected`, `Optional`, `Rejected`.

## 3. Selected features — M3 commitment

For each selected feature, complete this block.

### EF-XX — [Feature name]

- **Problem it solves:** [TODO]
- **Target user:** [TODO]
- **Why it is beyond MVP:** [Explain why the MVP can work without it.]
- **Expected behavior:** [TODO]
- **Acceptance criteria:** [Observable, testable outcomes]
- **Implementation approach:** [TODO]
- **Integration point:** [API, module interface, event, UI entry point, etc.]
- **Dependencies:** [M1/M2 work, data, APIs, credentials, packages]
- **Fallback if unfinished:** [How the MVP demo remains unaffected]
- **Estimated effort:** [TODO]
- **Priority:** P1 / P2 / P3
- **Owner:** M3
- **Team approval:** M1 [Yes/No], M2 [Yes/No], M3 [Yes/No]

## 4. Priority and time allocation

| Priority | Meaning | Rule |
|---|---|---|
| P1 | Best-value enhancement | M3 starts after interface/dependency agreement |
| P2 | Useful if time remains | Start only when P1 is on track |
| P3 | Experimental / stretch | Do not risk MVP or P1 delivery |

M1/M2's MVP work takes priority. M3 should make progress independently wherever possible and must not block M1/M2 waiting for unfinished enhancement code.

## 5. Parallel-work and integration plan

| Enhancement | What M3 can build independently | What is needed from M1/M2 | Integration owner | Integration test |
|---|---|---|---|---|
| [EF-XX] | [TODO] | [Contract/data/UI hook] | [TODO] | [TODO] |

Agree on interfaces early. M3 can use a mock or adapter while M2 builds the corresponding MVP service, provided the mock matches the agreed contract.

## 6. Final decision

- **MVP scope frozen by:** [Date/time]
- **Enhancement selection agreed by:** [Date/time]
- **Selected P1 features:** [IDs]
- **Optional P2/P3 features:** [IDs]
- **Explicitly not doing:** [IDs / ideas]
- **Approval:** M1 [Yes/No] · M2 [Yes/No] · M3 [Yes/No]

Do not begin implementation of selected enhancements until this plan and the relevant integration points are agreed.
