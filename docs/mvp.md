Here is the project detials: change the project context accordingly.


# **Hospital Queue Management System**

Project Context — Version 2.0

## **1. Project overview**

**Project name:** Hospital Queue Management System

**Project category:** Healthcare / Queue Management / Digital Hospital Administration

**Project objective:**

Develop a digital hospital queue management platform that simplifies appointment scheduling, patient registration, token generation, queue monitoring, doctor availability management, emergency prioritization, and hospital operations.

The system aims to reduce unnecessary waiting, improve patient flow, provide real-time queue visibility, and help hospital staff manage multiple departments efficiently.

### **Problem statement**

Traditional hospital queue systems often suffer from:

- Long and unpredictable waiting times.
- Physical queues and overcrowded waiting areas.
- Poor communication about appointment delays.
- Difficulty coordinating multiple doctors and departments.
- Lack of transparency in queue positions.
- Inefficient handling of emergency and priority patients.
- Manual appointment modifications and token management.

### **Proposed solution**

A centralized digital platform connecting patients, doctors, receptionists, and administrators.

Patients can book appointments, register as walk-ins, receive tokens, and track their queue status. Doctors can manage their queues and availability. Receptionists can manage registrations and appointments. Administrators can monitor hospital-wide operations and configure queue policies.

## **2. System users and roles**

| User           | Responsibilities                                                  |
| -------------- | ----------------------------------------------------------------- |
| Patient        | Register, book appointments, track queues                         |
| Doctor         | Manage availability, handle patients, process queues              |
| Receptionist   | Register patients, manage appointments and tokens                 |
| Admin          | Manage hospital operations, staff, departments and configurations |
| Public visitor | View queue status without authentication                          |

## **3. Complete MVP feature list**

### **A. Patient management**

- Patient registration and login.
- Guest registration.
- Patient profile management.
- Unique patient ID.
- QR-based patient identification.
- Multiple dependents/family members.

### **B. Appointment management**

- Appointment booking.
- Walk-in registration.
- Appointment scheduling.
- Automatic incremental rescheduling.
- Appointment cancellation.
- Doctor availability and slot management.
- Telegram appointment reminders.
- In-app appointment reminders.
- Booking confirmation.
- Token confirmation.

**Rescheduling behavior:** Automatically identify the next suitable available slot when rescheduling is triggered, update the appointment allocation incrementally, and prevent double-booking. Exact triggers and confirmation rules remain to be finalized.

### **C. Queue and token management**

- Automatic token generation.
- Department-wise queues.
- Doctor-wise queues.
- Live queue status.
- Current token display.
- Estimated waiting time.
- Next-token prediction.
- Patient queue-position tracking.
- Token cancellation.
- Missed-token handling.
- Queue transfer.
- Skip patient.
- Consultation duration tracking.
- Multi-department tracking.
- Queue progress visualization.

### **D. Doctor dashboard**

- Doctor authentication.
- Today's appointments.
- Current patient display.
- Call next patient.
- Mark consultation completed.
- Skip patient.
- Consultation duration tracking.
- Doctor availability status.
- Break management.

Patient notes are excluded.

### **E. Receptionist dashboard**

- Walk-in patient registration.
- Token generation.
- View all queues.
- Doctor assignment.
- Modify appointments.
- Cancel tokens.
- Reassign tokens.
- Patient search.
- Print token slips.

### **F. Admin dashboard**

- Admin authentication.
- Manage departments.
- Manage doctors.
- Manage staff.
- Configure queues.
- Monitor all departments.
- Manage hospital timings.
- Configure priority rules.
- Audit logs.

### **G. Live queue tracking**

- QR-based queue tracking.
- Public queue-status access.
- Current serving token.
- Number of patients ahead.
- Estimated waiting time.
- Live queue display.
- Digital waiting-room screen.
- Multi-department tracking.
- Queue progress visualization.

**Public access requirement:** Anyone entering the hospital should be able to scan a displayed QR code and view queue status without logging in.

Public information must not reveal patient names, phone numbers, medical records, or other private information.

### **H. Notifications and communication**

- Token confirmation.
- Telegram notifications.
- In-app notifications.
- Doctor delay notification.
- Turn approaching alert.
- Emergency announcements.

Excluded: SMS and WhatsApp notifications.

### **I. Emergency and priority management**

- Emergency registration.
- Emergency priority.
- Triage classification.
- Senior citizen priority.
- Pregnancy priority.
- Manual priority override.
- Priority audit trail.

Priority classification must be controlled by authorized hospital personnel. Manual overrides must record the responsible staff member, reason, and timestamp.

### **J. Analytics and reporting**

- Daily patient count.
- Department statistics.
- Average waiting time.
- Export reports (CSV/PDF).

### **K. Platform**

\- Progressive Web App (PWA) support.

## **4. Enhancement features (M3)**

These are additional features outside the MVP.

| No. | Feature                    | Description                                          |
| --- | -------------------------- | ---------------------------------------------------- |
| 1   | QR self check-in           | Scan QR to confirm physical hospital arrival         |
| 2   | AI waiting-time prediction | Predict waiting time using historical data           |
| 3   | Smart doctor assignment    | Recommend doctors based on availability and workload |
| 4   | Dynamic queue optimization | Optimize queue distribution                          |
| 5   | Voice announcements        | Automatically announce tokens                        |
| 6   | Malayalam voice assistance | Voice-guided patient interaction                     |
| 7   | Multilingual interface     | Malayalam, English and other languages               |
| 8   | Offline registration       | Registration during internet outages                 |
| 9   | Hospital navigation        | Guide patients to departments                        |
| 10  | Digital prescriptions      | Store and retrieve prescriptions                     |
| 11  | Pharmacy queue             | Manage medicine collection                           |
| 12  | Laboratory queue           | Manage sample collection                             |
| 13  | Billing queue              | Manage payment counters                              |
| 14  | Patient feedback           | Collect patient satisfaction ratings                 |
| 15  | Feedback analytics         | Identify service bottlenecks                         |

M3 should select only 2–3 enhancements before development begins.

## **5. System architecture overview**

The proposed architecture consists of these logical components:

**User interfaces**

Patient · Doctor · Receptionist · Admin · Public display

**Backend API and authentication**

Authorization · Validation · Business logic

**Queue engine**

Tokens · Priority · Scheduling

**Notification engine**

Telegram · In-app alerts

**Analytics engine**

Reports · Statistics

**Database**

Patients · Appointments · Queues

This is a logical architecture, not a finalized technology stack. The existing repository's technical decisions should be preserved.

## **6. Three-member development structure**

The team has three members, three laptops, and three Antigravity environments. Each member may use multiple agents.

| Member | Role                               | Ownership                                |
| ------ | ---------------------------------- | ---------------------------------------- |
| M1     | Frontend Developer                 | Complete MVP frontend                    |
| M2     | Backend Developer / Main Developer | Complete MVP, backend and business logic |
| M3     | Enhancement & Integration Engineer | Independently developed enhancements     |

### **M1 — Frontend**

- Patient interface.
- Doctor dashboard.
- Receptionist dashboard.
- Admin dashboard.
- Public queue display.
- API integration.
- Frontend testing.

### **M2 — Backend / Main Developer**

- Database design and implementation.
- Authentication and authorization.
- All MVP business logic.
- Appointment and scheduling engine.
- Queue and token engine.
- Priority management.
- Notifications and reporting APIs.
- Backend testing.
- End-to-end MVP integration.

M2 is the main MVP developer. M3 does not own missing MVP functionality.

### **M3 — Enhancements**

- Develop pre-agreed enhancements.
- Build independent feature modules.
- Test enhancement functionality.
- Integrate through agreed API contracts.
- Maintain enhancement documentation.
- Coordinate with M1 and M2 where integration is required.

## **7. Agentic collaboration rules**

These rules apply throughout the project.

1. Every agent must read the root `AGENTS.md` and relevant project documentation before working.
2. Multiple agents working under one member remain subordinate to that member's assignment.
3. Only M2 is the main MVP developer.
4. Each member owns their assigned directory.
5. M1 owns `frontend/`.
6. M2 owns `backend/`.
7. M3 owns `enhancements/`.
8. Shared API contracts and database changes require coordination.
9. Each member updates their own task-board items.
10. Coordinators consolidate the progress of their agents.
11. Enhancements must not block MVP completion.
12. Integration must happen through agreed contracts.

### **Repository structure**

```
project/
├── AGENTS.md
├── README.md
├── frontend/
├── backend/
├── enhancements/
├── shared/
├── docs/
│   ├── PROJECT.md
│   ├── ARCHITECTURE.md
│   ├── TASK-BOARD.md
│   ├── API-CONTRACT.md
│   ├── DATABASE-SCHEMA.md
│   ├── DECISIONS.md
│   ├── INTEGRATION-STATUS.md
│   ├── HANDOFFS.md
│   └── EXTRA-FEATURE-PLAN.md
└── .agents/
```

## **8. Important scope decisions and unresolved questions**

| Topic                  | Current decision                                                    |
| ---------------------- | ------------------------------------------------------------------- |
| Multiple counters      | Not confirmed as MVP; add only if shared parallel service is needed |
| Public QR tracking     | MVP                                                                 |
| QR self check-in       | Enhancement                                                         |
| Telegram notifications | MVP                                                                 |
| SMS / WhatsApp         | Excluded                                                            |
| Patient notes          | Excluded                                                            |
| PWA                    | MVP                                                                 |
| Offline registration   | Enhancement                                                         |
| Priority decisions     | Authorized clinical staff                                           |
| AI prediction          | Enhancement                                                         |
| M3 feature selection   | Before development                                                  |

Additional details to finalize:

- Automatic rescheduling triggers and patient confirmation.
- Priority ordering and tie-breaking.
- Senior citizen eligibility threshold.
- Authorized triage categories.
- Telegram bot configuration.
- Waiting-time calculation methodology.
- Exact report export formats.

## **9. Development strategy**

The implementation should follow this order:

1. Finalize and freeze MVP scope.
2. Finalize M3 enhancement selection.
3. Define API contracts and database responsibilities.
4. Divide tasks among the three members.
5. Start parallel development.
6. Integrate frontend and backend.
7. Integrate enhancements.
8. Run end-to-end testing.
9. Prepare the final demonstration.

**Success criteria:** A patient can register or walk in, obtain a token, monitor queue progress, receive relevant notifications, and complete a consultation. Hospital staff can manage appointments, doctors, queues, and priorities, while administrators can monitor hospital-wide operations.

This is the current project context. Unconfirmed technical and operational decisions should remain explicitly marked as TBD rather than being silently assumed.