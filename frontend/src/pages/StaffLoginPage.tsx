import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Stethoscope,
  UserCheck,
  Tv,
  ArrowRight,
  Lock,
  User,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Logo, Btn, Field, ease } from '../components/hq/ui';
import { useAuth } from '../lib/auth';
import { M1_DOCTOR, M1_RECEPTIONIST, M1_HOSPITAL_ADMIN, M1_SUPER_ADMIN, M1_CONFIG } from '../config/m1-accounts';

type StaffRole = 'admin' | 'doctor' | 'receptionist' | 'display';

interface RoleOption {
  value: StaffRole;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'admin',
    title: 'Platform Admin & Hospital Admin',
    badge: '/admin',
    description: 'Topology, live queues, user directory & audit stream',
    icon: ShieldCheck,
  },
  {
    value: 'receptionist',
    title: 'Receptionist Intake Desk',
    badge: '/intake',
    description: 'Patient check-in, token slip generation & queue assignment',
    icon: UserCheck,
  },
  {
    value: 'doctor',
    title: 'Doctor Clinical Workstation',
    badge: '/consultation',
    description: 'Calling tokens, clinical notes & patient consultations',
    icon: Stethoscope,
  },
  {
    value: 'display',
    title: 'Public Display Waiting Board',
    badge: '/display',
    description: 'Full-screen zero-PII waiting room TV board (No password needed)',
    icon: Tv,
  },
];

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const { signIn, isDoctor, isReceptionist } = useAuth();
  const [role, setRole] = useState<StaffRole>('receptionist');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedOption = ROLE_OPTIONS.find((opt) => opt.value === role) || ROLE_OPTIONS[1];
  const SelectedRoleIcon = selectedOption.icon;

  const handleRoleChange = (newRole: StaffRole) => {
    setRole(newRole);
    setErrorMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (role === 'display') {
      navigate('/display');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both staff email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const { profile } = await signIn(email.trim(), password);

      // Verify role assignment strictly against verified backend profile
      if (role === 'admin') {
        const isSuper = Boolean(
          email.trim().toLowerCase() === 'muhammedparad0485@gmail.com' ||
          email.trim().toLowerCase() === 'muhammedparad@gmail.com' ||
          profile?.roles?.some(
            (r) => typeof r === 'string' && (r.toLowerCase() === 'super_admin' || r.toLowerCase() === 'superadmin')
          )
        );

        const isHospAdmin = Boolean(
          profile?.staffAssignments?.some(
            (a) => a.role?.toLowerCase() === 'hospital_admin' && Boolean(a.hospitalId)
          ) ||
          profile?.roles?.some((r) => typeof r === 'string' && r.toLowerCase() === 'hospital_admin')
        );

        if (!isSuper && !isHospAdmin && profile) {
          throw new Error('Account authenticated, but you do not hold administrative privileges.');
        }

        if (redirectTarget) {
          navigate(redirectTarget);
        } else if (isSuper) {
          navigate('/admin');
        } else {
          navigate('/hospital-admin');
        }
      } else if (role === 'doctor') {
        const hasDoctorAccess = Boolean(
          profile?.staffAssignments?.some(
            (a) => a.role?.toLowerCase() === 'doctor' && Array.isArray(a.queues) && a.queues.length > 0
          )
        );

        if (!hasDoctorAccess && profile) {
          throw new Error('Account authenticated, but you are not assigned as a doctor to any clinical queue.');
        }
        navigate(redirectTarget || '/consultation');
      } else if (role === 'receptionist') {
        const hasReceptionAccess = Boolean(
          profile?.staffAssignments?.some(
            (a) => a.role?.toLowerCase() === 'receptionist' && Boolean(a.department?.id || a.hospitalId)
          )
        );

        if (!hasReceptionAccess && profile) {
          throw new Error('Account authenticated, but you are not assigned as a receptionist to any department.');
        }
        navigate(redirectTarget || '/intake');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Staff authentication failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6">
        <button
          onClick={() => navigate('/')}
          className="press flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Hospital Landing</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <ShieldCheck size={14} className="text-primary" />
          <span>Clinical Access Gateway</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease }}
          className="surface p-8 shadow-lift border border-border"
        >
          <div className="flex items-center justify-between mb-8">
            <Logo className="text-lg" />
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              Staff Portal
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Workstation Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your authorized hospital credentials.
          </p>

          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {/* Custom Styled Role Dropdown */}
            <div className="relative">
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Select Your Role / Terminal
              </label>

              <button
                type="button"
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="w-full h-12 rounded-2xl border border-input bg-card px-3.5 flex items-center justify-between text-sm font-medium outline-none transition-[box-shadow,border-color] duration-200 hover:border-primary/50 focus:border-primary focus:ring-4 focus:ring-ring cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={roleDropdownOpen}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <SelectedRoleIcon size={16} />
                  </div>
                  <span className="truncate font-semibold text-foreground text-xs sm:text-sm">
                    {selectedOption.title}
                  </span>
                  <span className="hidden sm:inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {selectedOption.badge}
                  </span>
                </div>

                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                    roleDropdownOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {roleDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setRoleDropdownOpen(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      role="listbox"
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease }}
                      className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-border/80 bg-card/98 p-1.5 shadow-2xl backdrop-blur-xl space-y-1"
                    >
                      {ROLE_OPTIONS.map((opt) => {
                        const isSelected = role === opt.value;
                        const OptIcon = opt.icon;

                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              handleRoleChange(opt.value);
                              setRoleDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'hover:bg-muted/70 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                <OptIcon size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold truncate">{opt.title}</p>
                                  <span className="rounded bg-muted/80 px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground shrink-0">
                                    {opt.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {opt.description}
                                </p>
                              </div>
                            </div>

                            {isSelected && <Check size={15} className="text-primary shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Role Indicator Preview */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
              {role === 'admin' && (
                <>
                  <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Admin Operations Center</p>
                    <p className="text-[11px] text-muted-foreground">Topology, live queues, user directory & audit stream</p>
                  </div>
                </>
              )}
              {role === 'receptionist' && (
                <>
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Front Desk Reception</p>
                    <p className="text-[11px] text-muted-foreground">Intake, UHID lookup & thermal token slips</p>
                  </div>
                </>
              )}
              {role === 'doctor' && (
                <>
                  <div className="size-9 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                    <Stethoscope size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Doctor Clinical Workstation</p>
                    <p className="text-[11px] text-muted-foreground">Call next patient, stopwatch & complete visits</p>
                  </div>
                </>
              )}
              {role === 'display' && (
                <>
                  <div className="size-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Tv size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Waiting Hall TV Signage</p>
                    <p className="text-[11px] text-muted-foreground">Zero-PII public display (No sign-in required)</p>
                  </div>
                </>
              )}
            </div>

            {role !== 'display' ? (
              <>
                <Field
                  label="Staff Email"
                  type="email"
                  placeholder="e.g. doctor@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Field
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <Btn
                  type="submit"
                  variant="ink"
                  size="lg"
                  loading={isLoading}
                  className="w-full mt-6"
                >
                  Sign In to Workstation <ArrowRight size={16} />
                </Btn>
              </>
            ) : (
              <Btn
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-6"
              >
                Launch TV Signage <ArrowRight size={16} />
              </Btn>
            )}

            <p className="text-center text-[12px] text-muted-foreground mt-4 font-mono">
              Protected clinical network • Supabase Auth
            </p>
          </form>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground font-mono">
        City General Hospital • Single-Role Workstations
      </footer>
    </div>
  );
};
