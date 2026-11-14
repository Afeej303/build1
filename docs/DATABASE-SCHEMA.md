# Database and Data Model

## 1. Storage overview

- **Database / storage technology:** [TODO]
- **Schema or database name:** [TODO]
- **Migration approach:** [TODO]
- **Local development setup:** [TODO]
- **Data retention constraints:** [TODO]

## 2. Entities / collections

| Entity | Purpose | Owner | Relationships |
|---|---|---|---|
| [TODO] | [TODO] | M2 | [TODO] |

## 3. Entity detail template

### [Entity name]

| Field | Type | Required? | Constraints / default | Notes |
|---|---|---:|---|---|
| `id` | [TODO] | Yes | [TODO] | [TODO] |

- Primary key: [TODO]
- Foreign keys / references: [TODO]
- Indexes / uniqueness: [TODO]
- Sensitive fields: [TODO]
- Validation rules: [TODO]

## 4. Relationships

[Describe one-to-one, one-to-many and many-to-many relationships. Add an ER diagram if useful.]

## 5. Seed / demo data

[Describe safe synthetic data required for the demo. Do not use real personal data.]

## 6. Migrations and compatibility

[Record migration order, rollback expectations and any compatibility constraints.]

## 7. Unresolved questions

| Question | Owner | Status |
|---|---|---|
| [TODO] | M2 | Open |

## P-05 draft — First walk-in workflow

This is a proposed logical model for the interfaces in [API-CONTRACT.md](API-CONTRACT.md). Initial Prisma models and migration are drafted in the backend.

| Entity | Identity and relationships | First-workflow data |
|---|---|---|
| App user | Stable app ID mapped to a verified Supabase identity | Display name and account status |
| Patient | Internal patient ID, hospital-scoped UHID, optional linked app user for an existing walk-in | Display name |
| Hospital and department | A department belongs to a hospital | Names for staff and tracking views |
| Staff assignment | App user and role scoped to a hospital, through a department for reception or a direct queue assignment for doctors | Reception scope and doctor queue assignment |
| Queue | Belongs to a department; unique public identifier | Name, room label, doctor assignment, walk-in availability |
| Queue token | Belongs to a patient and a queue | Display number, status, issue time, call time, update time, staff-only priority |

Proposed persistence invariants:

- Issue a display number and insert the token atomically. The numbering scope and reset schedule are TBD.
- Enforce at most one WAITING or CALLED token per patient and queue, and at most one CALLED token per queue. Back these invariants with PostgreSQL constraints so competing requests cannot bypass them.
- Claim the next eligible token and complete an active token in transactional operations. Recheck the actor scope and relevant state before writing. Order by issue time and break ties by the unique database-generated sequence.
- Scope UHID lookup to the receptionist's hospital. Return a patient's private token only through their linked app account. The public board query projects queue labels, display number, aggregate counts and timestamps.
- Seed synthetic patients and assigned staff for review. An unlinked walk-in patient can receive a token. Guest and dependent account-linking rules are TBD.
