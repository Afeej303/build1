# Hospital Queue Management System

## Project Overview

**Project name:** Hospital Queue Management System

**Project category:** Healthcare / Queue Management / Digital Hospital Administration

### Objective
Develop a digital hospital queue management platform that simplifies appointment scheduling, patient registration, token generation, queue monitoring, doctor availability management, emergency prioritization, and overall hospital operations. The system aims to reduce unnecessary waiting, improve patient flow, provide real-time queue visibility, and help hospital staff manage multiple departments efficiently.

### Problem Statement
Traditional hospital queue systems suffer from:
- Long and unpredictable waiting times.
- Physical queues and overcrowded waiting areas.
- Poor communication about appointment delays.
- Difficulty coordinating multiple doctors and departments.
- Lack of transparency in queue positions.
- Inefficient handling of emergency and priority patients.
- Manual appointment modifications and token management.

### Proposed Solution
A centralized digital platform connecting patients, doctors, receptionists, and administrators. Features include:
- Patients can book appointments, register as walk‑ins, receive tokens, and track their queue status.
- Doctors can manage their queues and availability.
- Receptionists can manage registrations and appointments.
- Administrators can monitor hospital‑wide operations and configure queue policies.

## System Users and Roles

| User | Responsibilities |
|------|-------------------|
| Patient | Register, book appointments, track queues |
| Doctor | Manage availability, handle patients, process queues |
| Receptionist | Register patients, manage appointments and tokens |
| Admin | Manage hospital operations, staff, departments, configurations |
| Public visitor | View queue status without authentication |

## MVP Feature List

### A. Patient Management
- Patient registration and login.
- Guest registration.
- Patient profile management.
- Unique patient ID.
- QR‑based patient identification.
- Multiple dependents/family members.

### B. Appointment Management
- Appointment booking.
- Walk‑in registration.
- Appointment scheduling.
- Automatic incremental rescheduling.
- Appointment cancellation.
- Doctor availability and slot management.
- Telegram appointment reminders.
- In‑app appointment reminders.
- Booking confirmation.
- Token confirmation.

### C. Queue and Token Management
- Automatic token generation.
- Department‑wise queues.
- Doctor‑wise queues.
- Live queue status.
- Current token display.
- Estimated waiting time.
- Next‑token prediction.
- Patient queue‑position tracking.
- Token cancellation.
- Missed‑token handling.
- Queue transfer.
- Skip patient.
- Consultation duration tracking.
- Multi‑department tracking.
- Queue progress visualization.

### D. Doctor Dashboard
- Doctor authentication.
- Today's appointments.
- Current patient display.
- Call next patient.
- Mark consultation completed.
- Skip patient.
- Consultation duration tracking.
- Doctor availability status.
- Break management.

### E. Receptionist Dashboard
- Walk‑in patient registration.
- Token generation.
- View all queues.
- Doctor assignment.
- Modify appointments.
- Cancel tokens.
- Reassign tokens.
- Patient search.
- Print token slips.

### F. Admin Dashboard
- Admin authentication.
- Manage departments.
- Manage doctors.
- Manage staff.
- Configure queues.
- Monitor all departments.
- Manage hospital timings.
- Configure priority rules.
- Audit logs.

### G. Live Queue Tracking
- QR‑based queue tracking.
- Public queue‑status access.
- Current serving token.
- Number of patients ahead.
- Estimated waiting time.
- Live queue display.
- Digital waiting‑room screen.
- Multi‑department tracking.
- Queue progress visualization.

### H. Notifications and Communication
- Token confirmation.
- Telegram notifications.
- In‑app notifications.
- Doctor delay notification.
- Turn approaching alert.
- Emergency announcements.

### I. Emergency and Priority Management
- Emergency registration.
- Emergency priority.
- Triage classification.
- Senior citizen priority.
- Pregnancy priority.
- Manual priority override (audit trail).

### J. Analytics and Reporting
- Daily patient count.
- Department statistics.
- Average waiting time.
- Export reports (CSV/PDF).

### K. Platform
- Progressive Web App (PWA) support.

## Enhancement Features (M3)

| No. | Feature | Description |
|-----|---------|-------------|
| 1 | QR self check‑in | Scan QR to confirm physical hospital arrival |
| 2 | AI waiting‑time prediction | Predict waiting time using historical data |
| 3 | Smart doctor assignment | Recommend doctors based on availability and workload |
| 4 | Dynamic queue optimization | Optimize queue distribution |
| 5 | Voice announcements | Automatically announce tokens |
| 6 | Malayalam voice assistance | Voice‑guided patient interaction |
| 7 | Multilingual interface | Malayalam, English and other languages |
| 8 | Offline registration | Registration during internet outages |
| 9 | Hospital navigation | Guide patients to departments |
|10 | Digital prescriptions | Store and retrieve prescriptions |
|11 | Pharmacy queue | Manage medicine collection |
|12 | Laboratory queue | Manage sample collection |
|13 | Billing queue | Manage payment counters |
|14 | Patient feedback | Collect patient satisfaction ratings |
|15 | Feedback analytics | Identify service bottlenecks |

*Select 2–3 enhancements before development begins.*

## Architecture Overview

**Components**
- User interfaces: Patient, Doctor, Receptionist, Admin, Public display.
- Backend API & Authentication: Authorization, Validation, Business logic.
- Queue Engine: Tokens, Priority, Scheduling.
- Notification Engine: Telegram, In‑app alerts.
- Analytics Engine: Reports, Statistics.
- Database: Patients, Appointments, Queues.

*Logical architecture; preserve existing technical decisions in the repository.*

## Development Structure

| Member | Role | Ownership |
|--------|------|-----------|
| M1 | Frontend Developer | `frontend/` |
| M2 | Backend / Main Developer | `backend/` |
| M3 | Enhancements | `enhancements/` |

## Open Questions (TBD)
- Automatic rescheduling triggers and patient confirmation workflow.
- Priority ordering rules and tie‑breaking logic.
- Senior citizen eligibility threshold.
- Authorized triage categories.
- Telegram bot configuration details.
- Waiting‑time calculation methodology.
- Exact report export formats (CSV vs PDF specifics).

*Mark these as open in `docs/EXTRA-FEATURE-PLAN.md` and resolve before implementation.*