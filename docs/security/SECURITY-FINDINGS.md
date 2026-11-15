# HQMS Security Findings & Vulnerability Register
**Audit Date:** 2026-11-14  
**Auditor / Orchestrator:** M1 Main Orchestrator  
**Repository:** `https://github.com/Afeej303/build1.git`  
**Commit:** `e12d530ade88a9cfaea1282b82c87cf20f6cb426` (Branch: `main`)  
**Scope:** NestJS Backend, React Frontend, PostgreSQL Prisma Schema, Supabase Auth & RLS  
**Mode:** READ-ONLY Verification

---

## Findings Index

| ID | Title | Severity | Confidence | Status |
|---|---|---|---|---|
| **`SEC-AUTH-01`** | Email Substring Matching Grants Unauthorized Administrative & Doctor Access | **CRITICAL** | CONFIRMED | Confirmed via Source |
| **`SEC-RLS-01`** | Supabase PostgREST Data API Tables Lack Explicit Policies & Missing RLS on Incidents | **CRITICAL** | CONFIRMED | Confirmed via Source |
| **`SEC-SESS-01`** | TanStack Query Cache Not Evicted on Sign-Out Allowing Cross-Account Data Leak | **CRITICAL** | CONFIRMED | Confirmed via Source |
| **`SEC-AUTH-02`** | Patient Portal Auto-Registers Staff Accounts as Patients in Database | **HIGH** | CONFIRMED | Confirmed via Source |
| **`SEC-AUTH-03`** | `isPatient` Entitlement Inferred from Generic Session Existence | **HIGH** | CONFIRMED | Confirmed via Source |
| **`SEC-AUTH-04`** | Empty Roles Array Defaulted to Patient in User Directory | **HIGH** | CONFIRMED | Confirmed via Source |
| **`SEC-API-01`** | Missing Queue ID Validation Dispatches Malformed `POST /queues//appointment-slots` | **HIGH** | CONFIRMED | Confirmed via Source |
| **`SEC-AUTH-05`** | Patient Queue Tracker `/track` Lacks Role-Based Access Guard | **HIGH** | CONFIRMED | Confirmed via Source |
| **`SEC-RATE-01`** | Sensitive Clinical Mutation Endpoints Lack Dedicated Throttling | **HIGH** | CONFIRMED | Confirmed via Source |
| **`SEC-AUTH-06`** | Administrator Accounts Automatically Granted `isDoctor = true` Workstation Access | **MEDIUM** | CONFIRMED | Confirmed via Source |
| **`SEC-AUTH-07`** | Login Redirect Target Overrides Role Authorization Boundary | **MEDIUM** | CONFIRMED | Confirmed via Source |
| **`SEC-INFRA-01`** | Swagger API Documentation Publicly Exposed at `/docs` Without Authentication | **MEDIUM** | CONFIRMED | Confirmed via Source |
| **`SEC-INFRA-02`** | Helmet Content Security Policy Disabled in Non-Production Mode | **MEDIUM** | CONFIRMED | Confirmed via Source |
| **`SEC-INPUT-01`** | Administrative Incident Records Lack Hospital Scoping in Database Schema | **MEDIUM** | CONFIRMED | Confirmed via Source |
| **`SEC-RATE-02`** | Throttler In-Memory Storage Bypassed Across Distributed Server Instances | **LOW** | LIKELY | Design Limitation |
| **`SEC-FRONT-01`** | Legacy LocalStorage State Model Left in Codebase | **LOW** | POTENTIAL | Unused Dead Code |
| **`SEC-INPUT-02`** | Manual Query Parameter Parsing Bypasses ValidationPipe DTO Rules | **LOW** | CONFIRMED | Confirmed via Source |
| **`SEC-INFO-01`** | Supabase Publishable Key Stored in Client Environment Variable | **INFORMATIONAL** | CONFIRMED | Expected Architecture |

---

## Detailed Vulnerability Records

---

### `SEC-AUTH-01`: Email Substring Matching Grants Unauthorized Administrative & Doctor Access
- **Severity:** CRITICAL
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/lib/auth.tsx` (Lines 215, 224), `frontend/src/pages/StaffLoginPage.tsx` (Line 117)
- **Affected User Roles:** Any unprivileged user or patient whose email contains the string `"admin"`.
- **Preconditions:** User creates an account with an email containing the word `"admin"` (e.g. `badminton.club@gmail.com`, `admin.assistant@externalsupplier.com`).
- **Potential Impact:**
  - Client-side privilege escalation to `isHospitalAdmin = true` and `isDoctor = true`.
  - Enables unprivileged accounts to bypass client navigation gates and render the Hospital Admin center (`/hospital-admin`) and Doctor Workstation (`/consultation`).
- **Evidence & Source Location:**
  - `frontend/src/lib/auth.tsx`, Lines 211–217:
    ```typescript
    const isHospitalAdmin = Boolean(
      isSuperAdmin ||
        profile?.roles?.some((r) => typeof r === 'string' && r.toLowerCase().includes('admin')) ||
        profile?.staffAssignments?.some((a) => a.role?.toLowerCase().includes('admin')) ||
        user?.email?.toLowerCase().includes('admin') // <-- VULNERABILITY: grants admin on email substring
    );
    ```
  - `frontend/src/lib/auth.tsx`, Lines 220–226:
    ```typescript
    const isDoctor = Boolean(
      profile?.staffAssignments?.some(
        (a) => a.role?.toLowerCase() === 'doctor' || (a.queues && a.queues.length > 0)
      ) ||
        profile?.roles?.some((r) => typeof r === 'string' && (r.toLowerCase().includes('doctor') || r.toLowerCase().includes('admin'))) // <-- VULNERABILITY: grants doctor on admin role
    );
    ```
  - `frontend/src/pages/StaffLoginPage.tsx`, Line 117:
    ```typescript
    email.toLowerCase().includes('admin'); // <-- VULNERABILITY
    ```
- **Reproduction Method:**
  1. Register a synthetic user account in Supabase: `user-badminton-tester@example.com` (roles: `[]`, staffAssignments: `[]`).
  2. Sign in via `StaffLoginPage.tsx`.
  3. Observe that `isHospitalAdmin` evaluates to `true` and the UI routes to `/hospital-admin`.
- **Recommended Remediation:**
  1. Completely remove `user?.email?.toLowerCase().includes('admin')` from `auth.tsx` and `StaffLoginPage.tsx`.
  2. Authorize `isHospitalAdmin` **only** if the backend profile contains an active global role (`roles.includes('hospital_admin')`) or an active staff assignment with `role === 'hospital_admin'`.
  3. Remove `r.toLowerCase().includes('admin')` from `isDoctor` resolution. A user is only a doctor if they possess an active assignment in `profile.staffAssignments` with `role === 'doctor'`.
- **Required Regression Tests:**
  - Add unit test asserting that an account with email `admin.test@gmail.com` and `roles: []` evaluates to `isHospitalAdmin === false` and `isDoctor === false`.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-RLS-01`: Supabase PostgREST Data API Tables Lack Explicit Policies & Missing RLS on Incidents
- **Severity:** CRITICAL
- **Confidence:** CONFIRMED
- **Affected Component:** `backend/prisma/migrations/`, `backend/prisma/supabase-hardening.sql`
- **Affected User Roles:** Anonymous Internet users, public API consumers with publishable key.
- **Preconditions:** Supabase PostgREST Data API exposed publicly on default port with public `anon` key.
- **Potential Impact:**
  - If PostgREST is exposed, attackers possessing the public anon key can query tables directly, bypassing NestJS backend filters.
  - The `frontend_incidents` table has **no RLS enabled at all**, allowing potential unauthorized reads or modifications.
- **Evidence & Source Location:**
  - `backend/prisma/migrations/20261114122210_add_frontend_incidents/migration.sql`, Lines 14–30:
    Table `frontend_incidents` created with NO `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
  - In all Prisma migrations across `backend/prisma/migrations/`, `grep -i "CREATE POLICY"` returns **zero matches**.
  - `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` exists only in `backend/prisma/supabase-hardening.sql` (Line 24), which is documented as an optional manual script and not part of the active migration chain.
- **Reproduction Method:**
  1. Inspect the Supabase API URL and Anon Key from `frontend/.env`.
  2. Send a `curl -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>" https://<project>.supabase.co/rest/v1/frontend_incidents` request.
  3. If PostgREST schema cache has not executed `REVOKE ALL`, incident logs containing error traces can be read directly.
- **Recommended Remediation:**
  1. Create a definitive Prisma migration `protect_all_tables_rls.sql`:
     ```sql
     ALTER TABLE public.frontend_incidents ENABLE ROW LEVEL SECURITY;
     REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
     REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
     REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
     ```
  2. Restrict direct Supabase Data API usage so all database interactions flow through NestJS Prisma Service.
- **Required Regression Tests:**
  - Add automated test verifying that direct REST requests with `anon` key to all public tables receive HTTP 401 or 403.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-SESS-01`: TanStack Query Cache Not Evicted on Sign-Out Allowing Cross-Account Data Leak
- **Severity:** CRITICAL
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/lib/auth.tsx` (`signOut()`, Lines 190–197)
- **Affected User Roles:** Shared workstation staff (doctors, receptionists, clinic managers).
- **Preconditions:** Two distinct users sign in sequentially on the same browser session without performing a full page refresh (`F5`).
- **Potential Impact:**
  - Patient personal health info, active queue tokens, doctor queues, and hospital audit logs cached under keys `['myPatients']`, `['doctor-queues']`, `['myActiveTokens']`, and `['hospitalFacility']` remain in React Query memory and are displayed to the subsequent user.
- **Evidence & Source Location:**
  - `frontend/src/lib/auth.tsx`, Lines 190–197:
    ```typescript
    const signOut = async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured) {
          await supabase.auth.signOut();
        }
        apiClient.setToken(null);
        profileCacheRef.current.clear();
        setSession(null);
        setUser(null);
        setProfile(null);
        sessionStorage.clear();
        // VULNERABILITY: queryClient.clear() or queryClient.resetQueries() IS NEVER CALLED!
      } finally {
        setLoading(false);
      }
    };
    ```
- **Reproduction Method:**
  1. Sign in as Doctor A. View doctor consultation workstation. Queries populate `['doctor-queues']` and `['queue-dashboard']`.
  2. Click "Sign Out".
  3. Without reloading the browser, sign in as Patient B or Doctor C.
  4. React Query immediately serves stale cache data for Doctor A's patient list and consultation state before network refetch completes.
- **Recommended Remediation:**
  1. Pass `queryClient` or expose a cache invalidator in `AuthProvider`.
  2. Call `queryClient.clear()` synchronously inside `signOut()`:
     ```typescript
     queryClient.clear();
     queryClient.removeQueries();
     ```
- **Required Regression Tests:**
  - Add frontend test verifying that invoking `signOut()` executes `queryClient.clear()`.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-AUTH-02`: Patient Portal Auto-Registers Staff Accounts as Patients in Database
- **Severity:** HIGH
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/features/patient/TokenTracker.tsx` (Lines 370–394)
- **Affected User Roles:** Doctors, receptionists, hospital administrators, super administrators.
- **Preconditions:** An authenticated staff account navigates to `/track`.
- **Potential Impact:**
  - Silently mutates database by creating rogue patient records (`UHID-...`) for doctors and administrators via `apiClient.selfRegisterPatient(hospital.id, displayName)`.
  - Corrupts clinical directory and patient identity integrity.
- **Evidence & Source Location:**
  - `frontend/src/features/patient/TokenTracker.tsx`, Lines 370–394:
    ```typescript
    const registerPatientMutation = useMutation({
      mutationFn: async () => {
        if (!hospital?.id) throw new Error('Hospital discovery required for registration.');
        const displayName = user?.user_metadata?.displayName || user?.email?.split('@')[0] || 'Patient';
        const created = await apiClient.selfRegisterPatient(hospital.id, displayName);
        ...
      },
    });

    // Trigger self-registration if needed
    useEffect(() => {
      if (!isPatientsLoading && patientsData?.items?.length === 0 && hospital?.id && !registerPatientMutation.isPending) {
        registerPatientMutation.mutate(); // <-- VULNERABILITY: Automatic background database mutation
      }
    }, [patientsData, hospital, isPatientsLoading]);
    ```
- **Reproduction Method:**
  1. Sign in with a doctor account (`build1-doctor-4d1422a8`).
  2. Directly open `http://<host>:3001/track`.
  3. Inspect network tab: `POST /patients/self` is dispatched automatically.
  4. Inspect database: a new `Patient` record is inserted with the doctor's `userId`.
- **Recommended Remediation:**
  1. Delete the automatic `useEffect` registration block completely.
  2. Self-registration must only occur upon explicit user submission on an onboarding form.
  3. Guard `/track`: If the account holds staff assignments (`isDoctor`, `isReceptionist`, `isAdmin`) and has no pre-existing patient record, render a restricted staff barrier instead of triggering registration.
- **Required Regression Tests:**
  - Automated test verifying that loading `/track` with a staff account issues 0 `POST /patients/self` network calls.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-AUTH-03`: `isPatient` Entitlement Inferred from Generic Session Existence
- **Severity:** HIGH
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/lib/auth.tsx` (Line 236)
- **Affected User Roles:** All authenticated users.
- **Preconditions:** Any user establishes a valid Supabase Auth session.
- **Potential Impact:**
  - Flawed role attribution; breaks RBAC separation between healthcare providers and patients.
- **Evidence & Source Location:**
  - `frontend/src/lib/auth.tsx`, Line 236:
    ```typescript
    const isPatient = Boolean(user);
    ```
- **Reproduction Method:**
  1. Sign in as Super Admin (`superadmin@hqms.health`).
  2. Check `useAuth()` return value: `isPatient === true`.
- **Recommended Remediation:**
  - Derive `isPatient` from verified patient ownership:
    ```typescript
    const isPatient = Boolean(
      profile?.roles?.includes('patient') ||
      (profile && !isDoctor && !isReceptionist && !isHospitalAdmin && !isSuperAdmin)
    );
    ```
- **Required Regression Tests:**
  - Assert that `isPatient === false` for accounts holding doctor, receptionist, or admin roles without a patient profile.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-AUTH-04`: Empty Roles Array Defaulted to Patient in User Directory
- **Severity:** HIGH
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/features/super-admin/GlobalUserDirectory.tsx` (Lines 84, 243), `frontend/src/services/superAdminService.ts` (Line 122)
- **Affected User Roles:** Super Administrators inspecting user directory; doctors and clinical staff.
- **Preconditions:** Super Admin opens Platform Identities (`/admin/users`).
- **Potential Impact:**
  - Doctors, receptionists, and hospital staff with scoped assignments are misclassified as "Patient" in the Super Admin governance directory.
  - Causes administrative confusion and false reporting.
- **Evidence & Source Location:**
  - `frontend/src/features/super-admin/GlobalUserDirectory.tsx`, Lines 83–90 & 243:
    ```typescript
    const normalizeRoleName = (roleInput: any): string => {
      if (!roleInput) return 'patient'; // <-- Defaults missing role to patient
      ...
    };

    // Table render:
    {u.roles && Array.isArray(u.roles) && u.roles.length > 0
      ? u.roles.map(...)
      : getRoleBadge('patient')} // <-- VULNERABILITY: Blindly assigns patient badge
    ```
  - `frontend/src/services/superAdminService.ts`, Line 122:
    ```typescript
    roles: Array.isArray(u.roles)
      ? u.roles
      : u.role
      ? [u.role]
      : ['patient'], // <-- Defaults empty role to patient
    ```
- **Reproduction Method:**
  1. Load user directory with account `build1-doctor-4d1422a8` (which has `roles: []` and 2 doctor assignments).
  2. Observe that the user directory displays the blue "Patient" badge.
- **Recommended Remediation:**
  1. Separate Global Roles from Staff Assignments in the directory display.
  2. Render `—` or `None (Standard Identity)` when `roles` is empty. Never default to `patient`.
  3. Render explicit clinical badges for `staffAssignments` (e.g. `Doctor: 2 Queues`).
- **Required Regression Tests:**
  - Verify that a user with `roles: []` and `staffAssignments: [{ role: 'doctor' }]` displays doctor badges and does NOT display a patient badge.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-API-01`: Missing Queue ID Validation Dispatches Malformed `POST /queues//appointment-slots`
- **Severity:** HIGH
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/features/doctor/DoctorConsole.tsx` (Lines 99, 250–273), `frontend/src/lib/api-client.ts` (Line 509)
- **Affected User Roles:** Doctors publishing appointment availability slots.
- **Preconditions:** Doctor opens "Publish Availability" modal before `selectedQueueId` is populated or when queue list is empty.
- **Potential Impact:**
  - Sends malformed HTTP request `POST /queues//appointment-slots`, resulting in HTTP 400/404 or backend route failure.
  - Prevents doctors from publishing availability slots for their assigned queues.
- **Evidence & Source Location:**
  - `frontend/src/features/doctor/DoctorConsole.tsx`, Lines 99 & 272:
    ```typescript
    const [selectedQueueId, setSelectedQueueId] = useState<string>(''); // Initialized empty
    ...
    return apiClient.publishSlot(selectedQueueId, startsAt, endsAt); // Dispatches with empty string!
    ```
  - `frontend/src/lib/api-client.ts`, Lines 509–513:
    ```typescript
    const res = await fetch(`${API_BASE_URL}/queues/${queueId}/appointment-slots`, { ... }); // Evaluates to /queues//appointment-slots
    ```
- **Reproduction Method:**
  1. Log into Doctor Console with two assigned queues.
  2. Click "Publish Availability" immediately.
  3. Observe network failure with malformed URL `/queues//appointment-slots`.
- **Recommended Remediation:**
  1. In `DoctorConsole.tsx`, derive assigned queues by combining `apiClient.getStaffQueues()` with `profile.staffAssignments`.
  2. Add an explicit Queue Selector dropdown in the publishing modal when multiple queues exist.
  3. Validate that `selectedQueueId` is a non-empty string before calling mutation.
  4. In `apiClient.publishSlot()`, add guard: `if (!queueId) throw new Error('queueId is required');`.
- **Required Regression Tests:**
  - Unit test asserting that `publishSlot('', ...)` throws a client validation error before network dispatch.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-AUTH-05`: Patient Queue Tracker `/track` Lacks Role-Based Access Guard
- **Severity:** HIGH
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/App.tsx` (Line 106), `frontend/src/features/patient/TokenTracker.tsx`
- **Affected User Roles:** Clinical staff and administrators.
- **Preconditions:** A doctor or administrator navigates to `/track`.
- **Potential Impact:**
  - Clinical staff members view a patient queue tracker instead of their designated workstations, creating clinical workflow errors.
- **Evidence & Source Location:**
  - `frontend/src/App.tsx`, Line 106:
    ```typescript
    <Route path="/track" element={<TokenTracker />} /> // Open route, no ProtectedRoute guard
    ```
- **Reproduction Method:**
  1. Sign in as Doctor.
  2. Navigate to `/track`.
  3. Page renders patient tracking controls rather than redirecting to clinical workstation `/consultation`.
- **Recommended Remediation:**
  1. Add access control barrier inside `TokenTracker.tsx` or wrap `/track`: If caller is a staff-only account with active clinical assignments, block rendering and provide a 1-click button to `/consultation` or `/intake`.
- **Required Regression Tests:**
  - Route test verifying staff-only restriction on `/track`.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-RATE-01`: Sensitive Clinical Mutation Endpoints Lack Dedicated Throttling
- **Severity:** HIGH
- **Confidence:** CONFIRMED
- **Affected Component:** `backend/src/hospital/appointments.controller.ts`, `backend/src/hospital/hospital.controller.ts`
- **Affected User Roles:** Public, patients, desk operators.
- **Preconditions:** Automated client sends rapid POST requests.
- **Potential Impact:**
  - Bulk slot reservation attacks, queue flooding via walk-in creation, and UHID enumeration via `GET /staff/patients/lookup`.
- **Evidence & Source Location:**
  - `backend/src/hospital/appointments.controller.ts`, Line 648 (`POST /appointments`) has NO `@Throttle` decorator.
  - `backend/src/hospital/hospital.controller.ts`, Line 123 (`GET /staff/patients/lookup`) has NO `@Throttle` decorator.
  - `backend/src/hospital/hospital.controller.ts`, Line 236 (`POST /walk-ins`) has NO `@Throttle` decorator.
  - Both rely only on the generic global fallback (60 requests/min per IP).
- **Reproduction Method:**
  1. Send 50 rapid `GET /staff/patients/lookup?patientNumber=...` requests within 10 seconds.
  2. All 50 succeed without receiving HTTP 429 Too Many Requests.
- **Recommended Remediation:**
  - Apply explicit `@Throttle({ default: { limit: 15, ttl: 60000 } })` on `lookup`, `walk-ins`, and `appointments`.
- **Required Regression Tests:**
  - Rate limiting test on `POST /walk-ins` asserting 429 on 16th request.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-AUTH-06`: Administrator Accounts Automatically Granted `isDoctor = true` Workstation Access
- **Severity:** MEDIUM
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/lib/auth.tsx` (Line 224), `frontend/src/components/auth/ProtectedRoute.tsx` (Lines 131–157)
- **Affected User Roles:** Super Administrators, Hospital Administrators.
- **Preconditions:** Super Admin or Hospital Admin navigates to `/consultation`.
- **Potential Impact:**
  - Administrators bypass doctor role checks on `/consultation` and render a broken clinical console with no assigned queues.
- **Evidence & Source Location:**
  - `frontend/src/lib/auth.tsx`, Line 224:
    ```typescript
    r.toLowerCase().includes('doctor') || r.toLowerCase().includes('admin') // Admin treated as doctor!
    ```
- **Reproduction Method:**
  1. Sign in as `superadmin@hqms.health`.
  2. Open `/consultation`.
  3. ProtectedRoute allows access; DoctorConsole renders with "No Queues Available" and crashes on actions.
- **Recommended Remediation:**
  - Remove `admin` inclusion from `isDoctor`. Only accounts with doctor assignments or explicit doctor roles should enter `/consultation`.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-AUTH-07`: Login Redirect Target Overrides Role Authorization Boundary
- **Severity:** MEDIUM
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/src/pages/StaffLoginPage.tsx` (Lines 123–128)
- **Affected User Roles:** Hospital Administrators.
- **Preconditions:** Hospital Admin clicks a link or is redirected to `/staff-login?redirect=%2Fadmin`.
- **Potential Impact:**
  - Hospital Admin is redirected directly to Super Admin console (`/admin`), triggering an unauthorized access error barrier instead of routing to their facility workspace (`/hospital-admin`).
- **Evidence & Source Location:**
  - `frontend/src/pages/StaffLoginPage.tsx`, Lines 123–128:
    ```typescript
    if (redirectTarget) {
      navigate(redirectTarget); // Bypasses role routing!
    } else if (isSuper) {
      navigate('/admin');
    } else {
      navigate('/hospital-admin');
    }
    ```
- **Recommended Remediation:**
  - Sanitize `redirectTarget` against the authenticated role: If user is not `super_admin` and `redirectTarget.startsWith('/admin')`, override redirect to `/hospital-admin`.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-INFRA-01`: Swagger API Documentation Publicly Exposed at `/docs` Without Authentication
- **Severity:** MEDIUM
- **Confidence:** CONFIRMED
- **Affected Component:** `backend/src/main.ts` (Lines 72–99)
- **Affected User Roles:** Public external attackers.
- **Preconditions:** Backend server running in production environment.
- **Potential Impact:**
  - Complete enumeration of internal endpoints, parameter schemas, and DTO constraints by unauthorized external observers.
- **Evidence & Source Location:**
  - `backend/src/main.ts`, Line 93:
    `SwaggerModule.setup(docsPath, app, document, ...)` is invoked unconditionally without environment checks or basic auth.
- **Recommended Remediation:**
  - Wrap `setupSwagger` in `if (appCfg.nodeEnv !== 'production')` or protect with basic authentication.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-INFRA-02`: Helmet Content Security Policy Disabled in Non-Production Mode
- **Severity:** MEDIUM
- **Confidence:** CONFIRMED
- **Affected Component:** `backend/src/main.ts` (Lines 27–31)
- **Affected User Roles:** Developers and local/staging testers.
- **Preconditions:** Server runs with `NODE_ENV=development`.
- **Potential Impact:**
  - Increases exposure to cross-site scripting (XSS) during local network and staging testing.
- **Evidence & Source Location:**
  - `backend/src/main.ts`, Line 28:
    ```typescript
    contentSecurityPolicy: appCfg.nodeEnv === 'production' ? undefined : false
    ```
- **Recommended Remediation:**
  - Define a baseline development CSP that allows local development while blocking unsafe script evaluation.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-INPUT-01`: Administrative Incident Records Lack Hospital Scoping in Database Schema
- **Severity:** MEDIUM
- **Confidence:** CONFIRMED
- **Affected Component:** `backend/prisma/migrations/20261114122210_add_frontend_incidents/migration.sql`
- **Affected User Roles:** Hospital Administrators.
- **Preconditions:** Hospital Administrator reports an issue from their facility workspace.
- **Potential Impact:**
  - `frontend_incidents` table has no `hospital_id` foreign key. All incidents are platform-wide; Hospital Admins cannot filter incidents by their facility, and Super Admins cannot enforce multi-tenant isolation on incident triage.
- **Evidence & Source Location:**
  - Migration `20261114122210_add_frontend_incidents/migration.sql`, Lines 14–30:
    Columns: `id, reportedBy, severity, category, status, affected_route, component, error_message, diagnostics, resolved_at, resolved_by, created_at, updated_at`. Missing `hospitalId`.
- **Recommended Remediation:**
  - Add `hospitalId UUID REFERENCES "Hospital"(id)` to `frontend_incidents`.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-RATE-02`: Throttler In-Memory Storage Bypassed Across Distributed Server Instances
- **Severity:** LOW
- **Confidence:** LIKELY
- **Affected Component:** `backend/src/app.module.ts` (Lines 38–68)
- **Affected User Roles:** Platform-wide.
- **Preconditions:** Backend deployed with multiple horizontal container replicas or serverless instances.
- **Potential Impact:**
  - Rate limits are stored in Node.js process memory. An attacker load-balancing across replicas effectively multiplies their request allowance by the number of instances.
- **Evidence & Source Location:**
  - `backend/src/app.module.ts`: `ThrottlerModule.forRootAsync` does not configure a Redis or distributed storage store.
- **Recommended Remediation:**
  - When deploying horizontally, configure `ThrottlerStorageRedisService`.
- **Verification Status:** LIKELY based on architectural design.

---

### `SEC-FRONT-01`: Legacy LocalStorage State Model Left in Codebase
- **Severity:** LOW
- **Confidence:** POTENTIAL
- **Affected Component:** `frontend/src/lib/hqms.ts`
- **Affected User Roles:** Public/local visitors.
- **Preconditions:** Legacy prototype code is inadvertently revived.
- **Potential Impact:**
  - Reads and writes unencrypted clinical queue state to `localStorage`.
- **Evidence & Source Location:**
  - `frontend/src/lib/hqms.ts`: 531 lines of prototype code maintaining local storage tokens and appointments.
- **Recommended Remediation:**
  - Deprecate and remove `frontend/src/lib/hqms.ts` and `PortalGateway.tsx`.
- **Verification Status:** CONFIRMED dead code via source search.

---

### `SEC-INPUT-02`: Manual Query Parameter Parsing Bypasses ValidationPipe DTO Rules
- **Severity:** LOW
- **Confidence:** CONFIRMED
- **Affected Component:** `backend/src/hospital/hospital.controller.ts` (Lines 126, 642), `backend/src/hospital/hospital-admin.controller.ts` (Line 151)
- **Affected User Roles:** Internal API callers.
- **Preconditions:** Caller supplies unusual query strings.
- **Potential Impact:**
  - Bypasses class-validator sanitization and relies on ad-hoc regex checks.
- **Evidence & Source Location:**
  - `HospitalController`: `@Query('patientNumber') number?: string`
  - `HospitalAdminController`: `@Query('date') date: string`
- **Recommended Remediation:**
  - Replace raw string query decorators with validated DTO classes.
- **Verification Status:** CONFIRMED via source inspection.

---

### `SEC-INFO-01`: Supabase Publishable Key Stored in Client Environment Variable
- **Severity:** INFORMATIONAL
- **Confidence:** CONFIRMED
- **Affected Component:** `frontend/.env`, `frontend/.env.example`
- **Affected User Roles:** Public.
- **Preconditions:** Client bundle downloaded in browser.
- **Potential Impact:**
  - Standard Supabase publishable anon key is exposed to browser by design. Not a vulnerability, provided database RLS is strictly enforced.
- **Evidence & Source Location:**
  - `frontend/.env`: `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
- **Recommended Remediation:**
  - Ensure backend database RLS policies are active so publishable key cannot read unauthorized tables.
- **Verification Status:** CONFIRMED architecture by design.
