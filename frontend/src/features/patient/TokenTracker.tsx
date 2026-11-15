import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowRight, 
  Check, 
  CalendarDays, 
  MapPin, 
  LogOut, 
  Bell, 
  Clock, 
  User, 
  Plus, 
  Calendar, 
  X, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Stethoscope,
  Phone,
  Building,
  Activity
} from 'lucide-react';
import { Header, Page, Btn, Field, StatusPill, SwapText, CountUp, Card, Eyebrow, ease } from '../../components/hq/ui';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import type { PatientTokenStatus } from '../../types/contract';
import { M1_CONFIG, M1_PATIENT_A, M1_PATIENT_B } from '../../config/m1-accounts';

export const TokenTracker: React.FC = () => {
  const { session, user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        title="Patient Portal & Queue Tracker"
        subtitle="City General Hospital OPD"
        right={
          session && (
            <button
              onClick={() => signOut()}
              className="press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out ({user?.email?.split('@')[0]})</span>
            </button>
          )
        }
      />
      <AnimatePresence mode="wait">
        {session ? <Dashboard key="dashboard" /> : <AuthScreen key="auth" />}
      </AnimatePresence>
    </div>
  );
};

/* =========================================================================
   1. Patient Auth Screen (Email Login, Google Auth, Comprehensive Sign Up)
   ========================================================================= */
function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Sign in fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign up fields: Name, Phone, Gender, DOB/Age, Email, Password
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dob, setDob] = useState('1995-05-15');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn(signInEmail, signInPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !dob || !signUpEmail.trim() || !signUpPassword) {
      setErrorMsg('Please fill in all required registration fields.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await signUp(signUpEmail, signUpPassword, {
        displayName: name.trim(),
        phone: phone.trim(),
        gender,
        dateOfBirth: dob,
      });
      // Try immediate login
      await signIn(signUpEmail, signUpPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google OAuth failed.');
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[85vh] place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        className="w-full max-w-md surface p-8 shadow-lift border border-border"
      >
        <div className="text-center mb-6">
          <Eyebrow>Patient Portal</Eyebrow>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Create Patient Profile'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'signin'
              ? 'Access your appointments and live token status.'
              : 'Register once for live outpatient tracking & appointments.'}
          </p>
        </div>

        {/* Continue with Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="press w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card hover:bg-muted font-medium text-sm transition-colors cursor-pointer mb-5 shadow-sm"
        >
          <svg className="size-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex py-2 items-center mb-5">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-3 text-xs uppercase font-mono text-muted-foreground">Or with email</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'signin' ? (
          /* Sign In Form */
          <form onSubmit={handleSignIn} className="space-y-3">
            <Field
              label="Email Address"
              type="email"
              placeholder="e.g. rahul@example.com"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              required
            />
            <Field
              label="Password"
              type="password"
              placeholder="••••••••"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              required
            />
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[10px] font-mono text-muted-foreground">Demo Accounts:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSignInEmail(M1_PATIENT_A.email);
                    setSignInPassword(M1_PATIENT_A.password);
                  }}
                  className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                >
                  ⚡ Patient A
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setSignInEmail(M1_PATIENT_B.email);
                    setSignInPassword(M1_PATIENT_B.password);
                  }}
                  className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                >
                  ⚡ Patient B
                </button>
              </div>
            </div>
            <Btn type="submit" variant="ink" size="lg" loading={loading} className="w-full mt-3">
              Sign In to Patient Portal <ArrowRight size={16} />
            </Btn>
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                New patient? Create account with Name, Phone & Age
              </button>
            </div>
          </form>
        ) : (
          /* Sign Up Form (Name, Phone, Gender, DOB, Email, Password) */
          <form onSubmit={handleSignUp} className="space-y-3">
            <Field
              label="Full Name"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Mobile Phone"
                placeholder="e.g. +91 9845012345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Field
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
              />
            </div>

            {/* Gender Selector */}
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">Gender</span>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={cn(
                      'press h-10 rounded-xl border text-xs font-medium capitalize transition-colors cursor-pointer',
                      gender === g
                        ? 'border-primary bg-accent/60 text-primary font-semibold'
                        : 'border-border bg-card hover:bg-muted'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label="Email Address"
              type="email"
              placeholder="e.g. priya@example.com"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              required
            />

            <Field
              label="Password"
              type="password"
              placeholder="Min 8 chars"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              required
            />

            <Btn type="submit" variant="ink" size="lg" loading={loading} className="w-full mt-4">
              Complete Registration & Sign In <ArrowRight size={16} />
            </Btn>

            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Already registered? Sign In
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

/* =========================================================================
   2. Patient Dashboard (Connected to Backend via TanStack React Query)
   ========================================================================= */
const tabs = ['Live Queue Tracker', 'Book Appointment', 'My Appointments'] as const;
type Tab = (typeof tabs)[number];

function Dashboard() {
  const { user, profile, isDoctor, isReceptionist, isHospitalAdmin, isSuperAdmin, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('Live Queue Tracker');

  // Query A: Patient Profiles linked to user
  const {
    data: patientsData,
    isLoading: isPatientsLoading,
    isError: isPatientsError,
    error: patientsError,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ['myPatients'],
    queryFn: () => apiClient.getMyPatients(),
  });

  // Query B: Appointment Queues discovery (to get hospitalId if patient not registered)
  const { data: queuesData } = useQuery({
    queryKey: ['appointmentQueues'],
    queryFn: () => apiClient.getAppointmentQueues(),
  });

  const activePatient = patientsData?.items?.[0] || null;
  const hospital = queuesData?.items?.[0]?.hospital || null;

  // Query C: Active Queue Tokens (10-second polling)
  const { data: tokensData } = useQuery({
    queryKey: ['myActiveTokens'],
    queryFn: () => apiClient.getActivePatientTokens(),
    refetchInterval: 10000,
  });

  const activeToken = tokensData?.items?.[0] || null;

  const isStaff = isDoctor || isReceptionist || isHospitalAdmin || isSuperAdmin;
  const hasVerifiedPatientProfile = Boolean(patientsData?.items && patientsData.items.length > 0);
  const isConfirmedEmpty = Boolean(patientsData?.items && patientsData.items.length === 0);

  // 1. Loading State: Never triggers premature barriers while request is in flight
  if (isPatientsLoading) {
    return (
      <Page className="max-w-2xl py-12 text-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-muted-foreground font-mono">Verifying patient credentials...</p>
      </Page>
    );
  }

  // 2. Error State: Network or server failure shows a retryable error screen (never assumed empty)
  if (isPatientsError) {
    return (
      <Page className="max-w-2xl py-12 text-center">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Unable to Verify Patient Profile</h2>
        <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          {(patientsError as Error)?.message || 'An error occurred while communicating with the hospital patient registry.'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto">
          Please check your connection or retry verifying your credentials.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => refetchPatients()}
            className="press w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Retry Verification</span>
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="press w-full sm:w-auto px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </Page>
    );
  }

  // 3. BARRIER A: Staff account confirmed to have NO personal patient profile (after successful empty response)
  if (isStaff && isConfirmedEmpty) {
    return (
      <Page className="max-w-2xl">
        <div className="surface p-6 sm:p-8 rounded-2xl border border-blue-500/30 bg-blue-500/[0.04] text-center shadow-lift">
          <div className="size-12 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
            <Stethoscope size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Clinical Staff Account</h2>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            You are signed in with a staff account ({profile?.name || user?.email}). This account does not hold a personal patient profile.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto">
            To book appointments or track queue tokens for yourself, a verified patient record must be linked at hospital intake. Otherwise, please return to your operational workstation.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              to={isDoctor ? '/consultation' : isReceptionist ? '/intake' : isSuperAdmin ? '/admin' : '/hospital-admin'}
              className="press w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
            >
              <span>Go to Workstation</span>
              <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="press w-full sm:w-auto px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Page>
    );
  }

  // 4. BARRIER B: Unassigned account confirmed to have NO personal patient profile (after successful empty response)
  if (isConfirmedEmpty) {
    return (
      <Page className="max-w-2xl">
        <PatientIntakeRegistrationCard
          user={user}
          hospital={hospital}
          onRegistered={() => {
            queryClient.invalidateQueries({ queryKey: ['myPatients'] });
          }}
          onSignOut={() => signOut()}
        />
      </Page>
    );
  }

  return (
    <Page className="max-w-2xl">
      {/* Dual-Role Notice: Rendered only when a staff member also holds an active personal patient profile */}
      {isStaff && hasVerifiedPatientProfile && (
        <div className="surface mb-6 p-4 rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Stethoscope className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Personal Patient Portal — Staff Account: {profile?.name || user?.email}
              </p>
              <p className="text-[11px] text-muted-foreground">
                You are viewing personal patient tokens & appointments. UHID: {activePatient?.patientNumber}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Link
              to={isDoctor ? '/consultation' : isReceptionist ? '/intake' : isSuperAdmin ? '/admin' : '/hospital-admin'}
              className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
            >
              <span>Workstation</span>
              <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="press px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Patient Welcome Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {activePatient?.patientNumber || 'REGISTERING UHID...'}
            </span>
            {activePatient?.gender && (
              <span className="text-xs text-muted-foreground capitalize">
                {activePatient.gender} • {activePatient.phone || ''}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
            Hi, {activePatient?.displayName || user?.email?.split('@')[0]}.
          </h1>
        </div>

        {/* Tab Pills */}
        <div className="flex rounded-full bg-muted p-1 text-xs">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative rounded-full px-3.5 py-1.5 font-medium text-muted-foreground transition-colors data-[on=true]:text-foreground cursor-pointer"
              data-on={tab === t}
            >
              {tab === t && (
                <motion.span
                  layoutId="patient-pill"
                  className="absolute inset-0 rounded-full bg-card shadow-soft"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease }}
          >
            {tab === 'Live Queue Tracker' && (
              <LiveTrackerTab
                token={activeToken}
                onGoToBook={() => setTab('Book Appointment')}
              />
            )}

            {tab === 'Book Appointment' && (
              <BookingFormTab
                patient={activePatient}
                queues={queuesData?.items || []}
                onDone={() => setTab('My Appointments')}
              />
            )}

            {tab === 'My Appointments' && (
              <AppointmentsHistoryTab
                onGoToBook={() => setTab('Book Appointment')}
                onGoToTracker={() => setTab('Live Queue Tracker')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Active Call Alert Overlay */}
      <CalledAlert token={activeToken} />
    </Page>
  );
}

/* -------------------------------------------------------------------------
   Tab A: Live Queue Tracker (Server Polled via React Query)
   ------------------------------------------------------------------------- */
function LiveTrackerTab({
  token,
  onGoToBook,
}: {
  token: PatientTokenStatus | null;
  onGoToBook: () => void;
}) {
  if (!token) {
    return (
      <Card className="py-16 text-center">
        <p className="font-semibold text-lg">No Active Queue Token</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          You are currently not queued for any consultation. Book an appointment below or request a walk-in token at reception.
        </p>
        <Btn className="mt-6" onClick={onGoToBook}>
          Book New Appointment
        </Btn>
      </Card>
    );
  }

  const ahead = token.patientsAhead ?? 0;
  const isCalled = token.status === 'CALLED';
  const isDone = token.status === 'COMPLETED';

  return (
    <div className="space-y-4">
      {/* 2-Card Status Header */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Eyebrow>Your Token</Eyebrow>
          <p className="mono mt-3 text-4xl font-semibold tracking-tight">{token.displayNumber}</p>
          <StatusPill status={token.status.toLowerCase() as any} className="mt-3" />
        </Card>
        <Card>
          <Eyebrow>Assigned Room</Eyebrow>
          <p className="mono mt-3 text-3xl font-semibold text-primary tracking-tight">
            {token.roomLabel || 'Room TBA'}
          </p>
          <p className="mt-3 text-[12px] text-muted-foreground">{token.doctorName || 'Assigned Consultant'}</p>
        </Card>
      </div>

      {/* Wait Metrics Card */}
      <Card className="p-6">
        {token.status === 'WAITING' ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-5xl font-bold tracking-tight">
                  <CountUp value={ahead} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">patients ahead of you in live queue</p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-bold tracking-tight">
                  ~<CountUp value={ahead * 6 + 2} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">estimated minutes wait</p>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${Math.max((1 - ahead / Math.max(ahead + 1, 1)) * 100, 10)}%` }}
                transition={{ duration: 0.6, ease }}
              />
            </div>
          </>
        ) : isCalled ? (
          <div className="text-center py-4">
            <span className="inline-block p-3 rounded-full bg-primary/10 text-primary mb-3">
              <Bell className="size-6 animate-bounce" />
            </span>
            <p className="text-2xl font-bold text-foreground">It's Your Turn!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please enter <span className="font-bold text-primary">{token.roomLabel}</span>. {token.doctorName} is waiting for you.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2">
            <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success">
              <Check className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-base">Consultation Completed</p>
              <p className="text-xs text-muted-foreground">This visit was concluded by the doctor.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Footer Info */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-mono">
        <span className="flex items-center gap-1.5">
          <MapPin size={14} />
          {token.departmentName} • {token.roomLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="pulse-dot size-1.5 rounded-full bg-success" />
          Live Polling Active (10s)
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Helper: Age & Date of Birth conversions
   ------------------------------------------------------------------------- */
function calculateAgeFromDob(dobString?: string | null): string {
  if (!dobString) return '';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return '';
  const now = new Date();
  let years = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) {
    years--;
  }
  return String(Math.max(0, years));
}

function ageToDobString(ageStr?: string | null): string | null {
  if (!ageStr || !ageStr.trim()) return null;
  const age = parseInt(ageStr.trim(), 10);
  if (isNaN(age) || age < 0 || age > 125) return null;
  const birthYear = new Date().getFullYear() - age;
  return `${birthYear}-01-01`;
}

/* -------------------------------------------------------------------------
   Barrier B: Complete Patient Registration Card for Unlinked Users
   ------------------------------------------------------------------------- */
function PatientIntakeRegistrationCard({
  user,
  hospital,
  onRegistered,
  onSignOut,
}: {
  user: any;
  hospital: any;
  onRegistered: () => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(
    user?.user_metadata?.displayName ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    ''
  );
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter your full patient name.');
      return;
    }
    const targetHospitalId = hospital?.id || M1_CONFIG.hospitalId;
    if (!targetHospitalId) {
      setError('Hospital record could not be resolved. Please try again.');
      return;
    }

    try {
      setLoading(true);
      const created = await apiClient.selfRegisterPatient(targetHospitalId, cleanName);

      const updates: any = {};
      if (phone.trim()) {
        updates.phone = phone.trim();
      }
      if (gender) {
        updates.gender = gender;
      }
      const dob = ageToDobString(age);
      if (dob) {
        updates.dateOfBirth = dob;
      }

      if (Object.keys(updates).length > 0 && created?.id) {
        try {
          await apiClient.updatePatientProfile(created.id, updates);
        } catch (updateErr) {
          console.warn('Profile details update warning:', updateErr);
        }
      }

      onRegistered();
    } catch (err: any) {
      setError(err.message || 'Failed to register patient profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface p-6 sm:p-8 rounded-2xl border border-border shadow-lift text-left">
      <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
        <User size={24} />
      </div>
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Complete Patient Registration</h2>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
          Your account ({user?.email}) is authenticated. Enter your details below to issue your Unique Hospital Identification Number (UHID) and unlock appointment booking & live queue tracking.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-[11px] font-mono text-muted-foreground">
          <MapPin size={12} />
          <span>{hospital?.name || M1_CONFIG.hospitalName || 'City General Hospital OPD'}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Patient Full Name *"
            placeholder="e.g. Muhammed Parad"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Field
            label="Phone Number"
            type="tel"
            placeholder="e.g. +91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Patient Age (Years)"
            type="number"
            min={0}
            max={125}
            placeholder="e.g. 28"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">Patient Gender</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] outline-none transition-[box-shadow,border-color] duration-200 focus:border-primary focus:ring-4 focus:ring-ring"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <div className="pt-2">
          <Btn
            type="submit"
            variant="ink"
            size="lg"
            loading={loading}
            className="w-full gap-2 font-semibold"
          >
            Issue Hospital UHID & Enter Portal <ArrowRight size={16} />
          </Btn>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/"
            className="press px-3 py-1.5 rounded-lg hover:text-foreground transition-colors"
          >
            Back to Home
          </Link>
          <span>•</span>
          <button
            type="button"
            onClick={onSignOut}
            className="press px-3 py-1.5 rounded-lg hover:text-foreground transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Tab B: Book Appointment (Real Slots via GET /queues/:id/appointment-slots)
   Captures: Patient name, Phone number, Age, Gender, Department, Doctor, Date & Time
   ------------------------------------------------------------------------- */
function BookingFormTab({
  patient,
  queues,
  onDone,
}: {
  patient: any;
  queues: any[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  // Initial demographics from active patient profile
  const initialAge = useMemo(() => calculateAgeFromDob(patient?.dateOfBirth), [patient?.dateOfBirth]);

  const [patientName, setPatientName] = useState<string>(patient?.displayName || '');
  const [phone, setPhone] = useState<string>(patient?.phone || '');
  const [age, setAge] = useState<string>(initialAge);
  const [gender, setGender] = useState<string>(patient?.gender || 'male');

  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedQueueId, setSelectedQueueId] = useState<string>(queues[0]?.id || '');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Departments list for quick filtering
  const departments = useMemo(() => {
    const set = new Set<string>();
    queues.forEach((q) => {
      if (q.departmentName) set.add(q.departmentName);
    });
    return ['ALL', ...Array.from(set)];
  }, [queues]);

  // Filter queues by selected department
  const filteredQueues = useMemo(() => {
    if (selectedDepartment === 'ALL') return queues;
    return queues.filter((q) => q.departmentName === selectedDepartment);
  }, [queues, selectedDepartment]);

  // Set default selected queue when queues load
  useEffect(() => {
    if (!selectedQueueId && queues.length > 0) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  // When department changes, if selected queue not in filtered, select first
  useEffect(() => {
    if (filteredQueues.length > 0 && !filteredQueues.some((q) => q.id === selectedQueueId)) {
      setSelectedQueueId(filteredQueues[0].id);
      setSelectedSlotId('');
    }
  }, [filteredQueues, selectedQueueId]);

  // Selected queue metadata (Doctor, Department, Room)
  const selectedQueue = useMemo(
    () => queues.find((q) => q.id === selectedQueueId) || null,
    [queues, selectedQueueId]
  );

  // Query available slots for the selected queue (today to +7 days in ISO format)
  // Stabilize date parameters to prevent millisecond churn on re-renders
  const { todayIso, nextWeekIso } = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    return {
      todayIso: startOfDay.toISOString(),
      nextWeekIso: new Date(startOfDay.getTime() + 7 * 86_400_000).toISOString(),
    };
  }, []);

  const {
    data: slotsData,
    isLoading: isSlotsLoading,
  } = useQuery({
    queryKey: ['availableSlots', selectedQueueId, todayIso],
    queryFn: ({ signal }) => apiClient.getAvailableSlots(selectedQueueId, todayIso, nextWeekIso, signal),
    enabled: Boolean(selectedQueueId),
    staleTime: 30_000,
  });

  const slots = slotsData?.items || [];

  // Selected slot details
  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId]
  );

  // Mutation: Book slot & update patient demographics
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlotId) {
        throw new Error('Please select an available consultation slot.');
      }
      if (!patientName.trim()) {
        throw new Error('Patient full name is required.');
      }

      // Update patient profile with current demographics
      const updates: any = {
        displayName: patientName.trim(),
        gender: gender || undefined,
      };
      if (phone.trim()) {
        updates.phone = phone.trim();
      }
      const dob = ageToDobString(age);
      if (dob) {
        updates.dateOfBirth = dob;
      }

      if (patient?.id) {
        try {
          await apiClient.updatePatientProfile(patient.id, updates);
        } catch (profileErr) {
          console.warn('Patient details update warning:', profileErr);
        }
      }

      return apiClient.bookAppointment(selectedSlotId, patient?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAppointments'] });
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      queryClient.invalidateQueries({ queryKey: ['myPatients'] });
      queryClient.invalidateQueries({ queryKey: ['myActiveTokens'] });
      onDone();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to book consultation slot.');
    },
  });

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    bookMutation.mutate();
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <Eyebrow>New Consultation</Eyebrow>
        <h2 className="text-2xl font-bold tracking-tight mt-1">Book OPD Appointment</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify patient details, select clinical specialty & doctor, and pick an available time slot.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleConfirm} className="space-y-6">
        {/* Step 1: Patient Information */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/50 space-y-3.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User size={13} className="text-primary" />
              1. Patient Demographics
            </span>
            <span className="mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
              UHID: {patient?.patientNumber || 'PENDING'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field
              label="Patient Name *"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Full Name"
              required
            />
            <Field
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field
              label="Patient Age (Years)"
              type="number"
              min={0}
              max={125}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 28"
            />
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">Patient Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] outline-none transition-[box-shadow,border-color] duration-200 focus:border-primary focus:ring-4 focus:ring-ring"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </div>

        {/* Step 2: Department & Doctor */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/50 space-y-3.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Stethoscope size={13} className="text-primary" />
              2. Select Department & Doctor
            </span>
            {selectedQueue && (
              <span className="text-xs font-medium text-primary">
                {selectedQueue.departmentName}
              </span>
            )}
          </div>

          {/* Department Filter Tabs */}
          {departments.length > 2 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {departments.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDepartment(dept)}
                  className={cn(
                    'press px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
                    selectedDepartment === dept
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {dept === 'ALL' ? 'All Specialties' : dept}
                </button>
              ))}
            </div>
          )}

          {filteredQueues.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 rounded-xl bg-muted/40 font-mono">
              No active doctor queues discovered in this department.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredQueues.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setSelectedQueueId(q.id);
                    setSelectedSlotId('');
                    setErrorMessage(null);
                  }}
                  className={cn(
                    'press p-3.5 rounded-2xl border text-left cursor-pointer transition-all',
                    selectedQueueId === q.id
                      ? 'border-primary bg-primary/[0.07] shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:border-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {q.doctorName ? `Dr. ${q.doctorName}` : q.name}
                    </span>
                    <span className="mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {q.roomLabel || 'Room TBA'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Department: <span className="font-medium text-foreground">{q.departmentName}</span>
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Available Slots (Date & Time) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/50 space-y-3.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar size={13} className="text-primary" />
              3. Select Consultation Date & Time
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {slots.length} available slots
            </span>
          </div>

          {isSlotsLoading ? (
            <div className="p-8 text-center bg-muted/20 rounded-2xl">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-mono">Loading published consultation slots...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="p-6 text-center border border-border rounded-2xl bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">
                No future appointment slots published for this doctor.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                The doctor must publish available slots from their clinical console.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {slots.map((s) => {
                const start = new Date(s.startsAt);
                const end = new Date(s.endsAt);
                const timeString = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                const dateString = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlotId(s.id);
                      setErrorMessage(null);
                    }}
                    className={cn(
                      'press p-3 rounded-xl border text-left transition-colors cursor-pointer',
                      selectedSlotId === s.id
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'border-border bg-card hover:border-foreground/30'
                    )}
                  >
                    <p className="text-xs font-semibold">{dateString}</p>
                    <p className="mono text-xs opacity-80 mt-0.5">{timeString}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 4: Booking Summary Review Card */}
        {selectedQueue && (
          <div className="p-4 rounded-2xl border border-primary/20 bg-primary/[0.04] space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Booking Summary Review
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Patient:</span>{' '}
                <strong className="text-foreground">{patientName || 'Patient'}</strong>
                {gender && <span className="text-muted-foreground capitalize"> • {gender}</span>}
                {age && <span className="text-muted-foreground"> • {age} yrs</span>}
                {phone && <span className="text-muted-foreground"> • {phone}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Department:</span>{' '}
                <strong className="text-foreground">{selectedQueue.departmentName}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Doctor:</span>{' '}
                <strong className="text-foreground">
                  {selectedQueue.doctorName ? `Dr. ${selectedQueue.doctorName}` : 'Duty Physician'}
                </strong>{' '}
                <span className="text-muted-foreground font-mono">({selectedQueue.roomLabel || 'Room TBA'})</span>
              </div>
              <div>
                <span className="text-muted-foreground">Scheduled Time:</span>{' '}
                {selectedSlot ? (
                  <strong className="text-primary font-mono">
                    {new Date(selectedSlot.startsAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                    at {new Date(selectedSlot.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                ) : (
                  <span className="text-muted-foreground italic">Select a slot above</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Booking */}
        <div className="pt-2">
          <Btn
            type="submit"
            variant="ink"
            size="lg"
            loading={bookMutation.isPending}
            disabled={!selectedSlotId || !patientName.trim()}
            className="w-full gap-2 font-semibold"
          >
            Confirm Appointment Booking <ArrowRight size={16} />
          </Btn>
        </div>
      </form>
    </Card>
  );
}

/* -------------------------------------------------------------------------
   Tab C: Appointment History (Connected to GET /users/me/appointments)
   ------------------------------------------------------------------------- */
function AppointmentsHistoryTab({
  onGoToBook,
  onGoToTracker,
}: {
  onGoToBook: () => void;
  onGoToTracker?: () => void;
}) {
  const queryClient = useQueryClient();

  // Query appointments for last 7 days to next 21 days (28 days total, <= 31-day backend limit)
  // Stabilize date parameters to prevent millisecond churn and query key thrashing
  const { fromIso, toIso } = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    return {
      fromIso: new Date(startOfDay.getTime() - 7 * 86_400_000).toISOString(),
      toIso: new Date(startOfDay.getTime() + 21 * 86_400_000).toISOString(),
    };
  }, []);

  const {
    data: appointmentsData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['myAppointments', { from: fromIso, to: toIso, scope: 'patient' }],
    queryFn: ({ signal }) => apiClient.getMyAppointments(fromIso, toIso, 'patient', signal),
    staleTime: 30_000,
    retry: (failureCount, err: any) => {
      // Do not auto-retry client errors (400, 401, 403, 404) or rate limits (429) rapidly
      if (err?.status && err.status >= 400 && err.status < 500) return false;
      return failureCount < 2;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.cancelAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAppointments'] });
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
    },
  });

  const appointments = appointmentsData?.items || [];

  if (isLoading) {
    return (
      <Card className="py-16 text-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-muted-foreground font-mono">Fetching appointment records...</p>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="py-12 text-center border-destructive/20 bg-destructive/5">
        <AlertCircle className="size-8 text-destructive mx-auto mb-2" />
        <p className="font-semibold text-sm text-destructive">Failed to Load Appointments</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          {error instanceof Error ? error.message : 'Unable to retrieve your appointment records.'}
        </p>
        <Btn
          variant="soft"
          onClick={() => refetch()}
          loading={isRefetching}
          className="mt-4 gap-2 mx-auto"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Btn>
      </Card>
    );
  }

  if (!appointments.length) {
    return (
      <Card className="py-14 text-center">
        <CalendarDays className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="font-semibold text-base">No Booked Appointments</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          You don't have any upcoming or past appointments on file.
        </p>
        <Btn className="mt-5" onClick={onGoToBook}>
          Book New Consultation
        </Btn>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1">
        <Eyebrow>All Appointments ({appointments.length})</Eyebrow>
        <button
          onClick={onGoToBook}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus size={14} /> Book Another
        </button>
      </div>

      <div className="space-y-3">
        {appointments.map((apt: any) => {
          const slot = apt.slot;
          const start = new Date(slot?.startsAt);
          const end = new Date(slot?.endsAt);
          const isBooked = apt.status === 'BOOKED';

          return (
            <div
              key={apt.id}
              className="surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize font-mono',
                      apt.status === 'BOOKED'
                        ? 'bg-primary/10 text-primary'
                        : apt.status === 'CHECKED_IN'
                        ? 'bg-success-soft text-success'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {apt.status}
                  </span>
                  {apt.queueTokenId && (
                    <span className="mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                      Checked In: Token #{apt.queueTokenId.slice(0, 8)}
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold">
                  {slot?.departmentName} •{' '}
                  <span className="font-normal text-muted-foreground">
                    {slot?.doctorName ? `Dr. ${slot.doctorName}` : 'Doctor'} ({slot?.roomLabel || 'Room TBA'})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 font-mono">
                  <Clock size={12} />
                  <span>
                    {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
                {apt.patient && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Patient: <strong className="text-foreground">{apt.patient.displayName}</strong>
                    {apt.patient.patientNumber && (
                      <span className="mono opacity-80"> • UHID: {apt.patient.patientNumber}</span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {apt.queueTokenId && onGoToTracker && (
                  <button
                    type="button"
                    onClick={onGoToTracker}
                    className="press px-3 py-1.5 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/20 flex items-center gap-1 cursor-pointer"
                  >
                    <Activity size={12} />
                    <span>Track Live Token</span>
                  </button>
                )}

                {isBooked && (
                  <button
                    onClick={() => cancelMutation.mutate(apt.id)}
                    disabled={cancelMutation.isPending}
                    className="press px-3 py-1.5 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 cursor-pointer"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   3. Instant Audio/Visual Alert when Patient Token is Called
   ------------------------------------------------------------------------- */
function CalledAlert({ token }: { token: PatientTokenStatus | null }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const isCalled = token?.status === 'CALLED' && dismissed !== token.id;

  return (
    <AnimatePresence>
      {isCalled && token && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
            className="w-full max-w-sm rounded-[32px] bg-card p-8 text-center shadow-lift border border-border"
          >
            <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
              <span className="pulse-dot absolute inset-0 rounded-full bg-primary" />
              <Bell className="relative size-6" />
            </span>
            <p className="mt-6 text-sm text-muted-foreground">
              Your token <span className="mono font-semibold text-foreground">{token.displayNumber}</span> is now called
            </p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
              Go to {token.roomLabel}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {token.doctorName} is ready to consult with you.
            </p>
            <Btn
              size="lg"
              variant="ink"
              className="mt-8 w-full"
              onClick={() => setDismissed(token.id)}
            >
              I'm On My Way
            </Btn>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
