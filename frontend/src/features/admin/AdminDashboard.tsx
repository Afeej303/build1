import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  Activity,
  Users,
  Tv,
  ArrowRight,
  LogOut,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  UserCheck,
  Clock,
  Layers,
  ChevronRight,
  Plus,
  KeyRound,
  AlertTriangle,
  Bug,
  Send,
  X,
  Copy,
  Check,
  Filter,
  CheckSquare,
  HelpCircle,
  Hash,
  Laptop
} from 'lucide-react';
import { Header, Page, Btn, Eyebrow, ease } from '../../components/hq/ui';
import { useAuth } from '../../lib/auth';
import { apiClient } from '../../lib/api-client';
import { M1_CONFIG } from '../../config/m1-accounts';
import { cn } from '../../lib/utils';

interface WebIncident {
  id: string;
  hospitalName: string;
  reporterEmail: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'UI_GLITCH' | 'API_ERROR' | 'QUEUE_DESYNC' | 'HARDWARE_PRINTER' | 'PERFORMANCE';
  description: string;
  component: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  createdAt: string;
  browserMeta: string;
}

const DEFAULT_INCIDENTS: WebIncident[] = [
  {
    id: 'inc-9412',
    hospitalName: 'Synthetic M1 Hospital',
    reporterEmail: 'build1-hospital-admin-cda2b677ff@example.com',
    title: 'Thermal receipt 80mm feed calibration issue on counter 2',
    severity: 'MEDIUM',
    category: 'HARDWARE_PRINTER',
    description: 'When checking in senior walk-in patients, paper margin clips the barcode on older ESC/POS USB printers.',
    component: 'WalkInDesk.tsx -> ThermalSlip',
    status: 'INVESTIGATING',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    browserMeta: 'Chrome 131.0 / Windows 11 / 1920x1080',
  },
  {
    id: 'inc-9411',
    hospitalName: 'Apollo Specialty Hospital',
    reporterEmail: 'build1-admin-4d170225d6@example.com',
    title: 'Public TV Signage audio chime muted on Chrome auto-play policy',
    severity: 'LOW',
    category: 'UI_GLITCH',
    description: 'First audio chime requires user gesture on the display browser before D5/A5 Web Audio context starts.',
    component: 'PublicWaitingBoard.tsx -> playCallingChime',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    browserMeta: 'Edge 130.0 / Tizen TV Display / 3840x2160',
  },
];

export const AdminDashboard: React.FC = () => {
  const { user, profile, signOut, isSuperAdmin, isHospitalAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'topology' | 'audit' | 'users' | 'incidents'>('topology');

  // Modals
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState<string | null>(null); // hospitalId
  const [showQueueModal, setShowQueueModal] = useState<string | null>(null); // departmentId
  const [showAssignDoctorModal, setShowAssignDoctorModal] = useState<{ queueId: string; currentDoctorId?: string } | null>(null);
  const [showReportErrorModal, setShowReportErrorModal] = useState(false);

  // Form states
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [counterAllowance, setCounterAllowance] = useState('5');
  const [createdCredentialsSlip, setCreatedCredentialsSlip] = useState<{ hospital: string; email: string; pass: string } | null>(null);

  const [newDeptName, setNewDeptName] = useState('');
  const [newQueueName, setNewQueueName] = useState('');
  const [newQueueRoom, setNewQueueRoom] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Web Incident Form
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [incidentCategory, setIncidentCategory] = useState<'UI_GLITCH' | 'API_ERROR' | 'QUEUE_DESYNC' | 'HARDWARE_PRINTER' | 'PERFORMANCE'>('API_ERROR');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentComponent, setIncidentComponent] = useState('');

  // Incident state persistence
  const [incidents, setIncidents] = useState<WebIncident[]>(() => {
    try {
      const saved = localStorage.getItem('hqms_web_incidents');
      return saved ? JSON.parse(saved) : DEFAULT_INCIDENTS;
    } catch {
      return DEFAULT_INCIDENTS;
    }
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('hqms_web_incidents', JSON.stringify(incidents));
    } catch {}
  }, [incidents]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += 'Aa!9';
    setNewAdminPassword(pass);
  };

  // 1. Facility Topology (Hospitals, Departments, Queues, Staff)
  const {
    data: hospitals,
    isLoading: isLoadingHospitals,
    refetch: refetchHospitals,
    isRefetching: isRefetchingHospitals,
  } = useQuery({
    queryKey: ['admin-hospitals'],
    queryFn: () => apiClient.getAdminHospitals(),
  });

  // 2. System Audit Activity Stream
  const {
    data: auditLogsData,
    isLoading: isLoadingAudit,
    refetch: refetchAudit,
    isRefetching: isRefetchingAudit,
  } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      if (isSuperAdmin) {
        return apiClient.getSystemAuditLogs(1, 50);
      }
      const res = await apiClient.getStaffAuditLog();
      return { items: res.items || [], meta: { total: res.items?.length || 0 } };
    },
    refetchInterval: 10000,
  });

  // 3. User & Role Directory
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
    isRefetching: isRefetchingUsers,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getPlatformUsers(1, 50),
    enabled: isSuperAdmin,
  });

  const auditItems = auditLogsData?.items || [];
  const usersList = usersData?.items || [];

  // Mutations
  const createHospitalMutation = useMutation({
    mutationFn: (name: string) => apiClient.createHospital(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-hospitals'] });
      setCreatedCredentialsSlip({
        hospital: newHospitalName,
        email: newAdminEmail || `${newHospitalName.toLowerCase().replace(/[^a-z0-9]/g, '')}-admin@hqms.org`,
        pass: newAdminPassword || 'AutoSecurePass#2026',
      });
      setActionSuccess(`Hospital "${newHospitalName}" onboarded successfully into PostgreSQL!`);
      setNewHospitalName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to onboard hospital');
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: ({ hospitalId, name }: { hospitalId: string; name: string }) =>
      apiClient.createDepartment(hospitalId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hospitals'] });
      setShowDeptModal(null);
      setNewDeptName('');
      setActionSuccess('Department created successfully!');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to create department');
    },
  });

  const createQueueMutation = useMutation({
    mutationFn: ({ departmentId, name, roomLabel }: { departmentId: string; name: string; roomLabel?: string }) =>
      apiClient.createQueue(departmentId, name, roomLabel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hospitals'] });
      setShowQueueModal(null);
      setNewQueueName('');
      setNewQueueRoom('');
      setActionSuccess('Clinical Queue provisioned with live public slug!');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to provision queue');
    },
  });

  const assignDoctorMutation = useMutation({
    mutationFn: ({ queueId, doctorId }: { queueId: string; doctorId: string | null }) =>
      apiClient.assignDoctorToQueue(queueId, doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hospitals'] });
      setShowAssignDoctorModal(null);
      setSelectedDoctorId('');
      setActionSuccess('Doctor queue assignment synchronized on backend!');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to assign doctor');
    },
  });

  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim() || !incidentDesc.trim()) return;

    const newInc: WebIncident = {
      id: `inc-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalName: M1_CONFIG.hospitalName,
      reporterEmail: user?.email || 'hospital-admin@example.com',
      title: incidentTitle.trim(),
      severity: incidentSeverity,
      category: incidentCategory,
      description: incidentDesc.trim(),
      component: incidentComponent.trim() || 'General UI / Network',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      browserMeta: `${navigator.userAgent.slice(0, 40)} / ${window.innerWidth}x${window.innerHeight}`,
    };

    setIncidents([newInc, ...incidents]);
    setShowReportErrorModal(false);
    setIncidentTitle('');
    setIncidentDesc('');
    setIncidentComponent('');
    setActionSuccess('Incident dispatched to Super Admin Control Tower!');
  };

  const handleUpdateIncidentStatus = (id: string, status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED') => {
    setIncidents(incidents.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header
        title="Admin Operations Center"
        subtitle={`${M1_CONFIG.hospitalName} • ${isSuperAdmin ? 'Platform Super Admin' : 'Hospital Facility Admin'}`}
        right={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReportErrorModal(true)}
              className="press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer"
            >
              <Bug size={13} />
              <span>Report Web Error</span>
            </button>
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-mono font-semibold',
                isSuperAdmin
                  ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              )}
            >
              {isSuperAdmin ? 'PLATFORM SUPER ADMIN' : 'HOSPITAL ADMIN'}
            </span>
            <button
              onClick={() => signOut()}
              className="press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        }
      />

      <Page>
        {/* Feedback banners */}
        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="cursor-pointer opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="cursor-pointer opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Top Control Bar & Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('topology')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'topology'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Building2 size={15} className="text-primary" />
              <span>Facility Topology & Queues</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'audit'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Activity size={15} className="text-emerald-500" />
              <span>Activity Stream ({auditItems.length})</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                  activeTab === 'users'
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Users size={15} className="text-indigo-500" />
                <span>User Directory ({usersList.length})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('incidents')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'incidents'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Bug size={15} className="text-rose-500" />
              <span>
                Web Incidents (
                {incidents.filter((i) => i.status !== 'RESOLVED').length} open)
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setShowOnboardModal(true);
                  generatePassword();
                }}
                className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-sm hover:opacity-95 cursor-pointer"
              >
                <Plus size={14} />
                <span>Onboard New Hospital</span>
              </button>
            )}
            <button
              onClick={() => {
                if (activeTab === 'topology') refetchHospitals();
                if (activeTab === 'audit') refetchAudit();
                if (activeTab === 'users') refetchUsers();
              }}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Refresh Current View"
            >
              <RefreshCw
                size={14}
                className={cn(
                  (isRefetchingHospitals || isRefetchingAudit || isRefetchingUsers) &&
                    'animate-spin text-primary'
                )}
              />
            </button>
          </div>
        </div>

        {/* TAB 1: Facility Topology & Live Queues */}
        {activeTab === 'topology' && (
          <div className="mt-8 space-y-8">
            {isLoadingHospitals ? (
              <div className="py-20 text-center text-xs text-muted-foreground">
                <RefreshCw size={20} className="animate-spin mx-auto mb-3 opacity-50" />
                Loading facility topology...
              </div>
            ) : !hospitals?.length ? (
              <div className="surface p-12 text-center text-muted-foreground">
                <Building2 size={32} className="mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm">No hospital facilities returned</p>
              </div>
            ) : (
              hospitals.map((hospital: any) => (
                <div key={hospital.id} className="space-y-6">
                  {/* Hospital Overview Card */}
                  <div className="surface p-7 border border-border bg-gradient-to-r from-card to-muted/30">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="text-primary size-5" />
                          <h2 className="text-xl font-bold tracking-tight">{hospital.name}</h2>
                        </div>
                        <p className="mono text-xs text-muted-foreground mt-1">
                          Facility ID: {hospital.id}
                        </p>
                      </div>

                      <div className="flex items-center gap-6 text-xs font-mono">
                        <div>
                          <p className="text-muted-foreground">Facility Admins</p>
                          <p className="text-base font-semibold text-foreground">
                            {hospital.admins?.length ?? 1}
                          </p>
                        </div>
                        <div className="h-7 w-px bg-border" />
                        <div>
                          <p className="text-muted-foreground">Clinical Depts</p>
                          <p className="text-base font-semibold text-foreground">
                            {hospital.departments?.length ?? 0}
                          </p>
                        </div>
                        <div className="h-7 w-px bg-border" />
                        <div>
                          <button
                            onClick={() => setShowDeptModal(hospital.id)}
                            className="press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer"
                          >
                            <Plus size={13} className="text-primary" />
                            <span>Add Department</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Departments and Queues Grid */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {hospital.departments?.map((dept: any) => (
                      <div
                        key={dept.id}
                        className="surface p-6 border border-border flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-border">
                            <div>
                              <Eyebrow>Clinical Specialty</Eyebrow>
                              <h3 className="text-base font-semibold mt-0.5">{dept.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                                {dept.queues?.length || 0} Queues
                              </span>
                              <button
                                onClick={() => setShowQueueModal(dept.id)}
                                className="press p-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Add queue to department"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Reception Staff Counter Allowance */}
                          <div className="mt-3 py-2 px-3 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-between text-xs text-muted-foreground font-mono">
                            <div className="flex items-center gap-2">
                              <UserCheck size={14} className="text-primary" />
                              <span>Reception Station Counters</span>
                            </div>
                            <span className="font-semibold text-foreground">
                              {dept.receptionists?.length || 1} Counters Active
                            </span>
                          </div>

                          {/* Queues List */}
                          <div className="mt-4 space-y-3">
                            {dept.queues?.map((queue: any) => (
                              <div
                                key={queue.id}
                                className="p-3.5 rounded-xl bg-card border border-border/70 hover:border-border transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-primary" />
                                    <h4 className="text-sm font-semibold">{queue.name}</h4>
                                  </div>
                                  <span className="mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                    {queue.roomLabel || 'Room TBD'}
                                  </span>
                                </div>

                                <div className="mt-2.5 flex items-center justify-between text-xs font-mono text-muted-foreground">
                                  <span>Public Slug: {queue.publicQueueId}</span>
                                  <Link
                                    to={`/display?queue=${queue.publicQueueId}`}
                                    className="hover:text-primary transition-colors flex items-center gap-1"
                                    target="_blank"
                                  >
                                    <Tv size={12} />
                                    <span>Signage</span>
                                  </Link>
                                </div>

                                {/* Assigned Doctor Section */}
                                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                                    <Stethoscope size={13} className="text-cyan-500" />
                                    <span>Doctor:</span>
                                    <span className="text-foreground font-medium">
                                      {queue.doctor ? queue.doctor.name || queue.doctor.email : 'Unassigned'}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() =>
                                      setShowAssignDoctorModal({
                                        queueId: queue.id,
                                        currentDoctorId: queue.doctorId,
                                      })
                                    }
                                    className="press text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                  >
                                    {queue.doctor ? 'Change' : 'Assign'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Quick links */}
                        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
                          <Link
                            to="/intake"
                            className="press flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
                          >
                            <span>Open Reception Intake</span>
                            <ChevronRight size={13} />
                          </Link>
                          <Link
                            to="/consultation"
                            className="press flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
                          >
                            <span>Doctor Stage</span>
                            <ChevronRight size={13} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: System Activity Stream */}
        {activeTab === 'audit' && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold">Live Operational Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Immutable record of token transitions, walk-ins, check-ins, and doctor completions.
                </p>
              </div>
              <span className="mono text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                {auditItems.length} Records Streamed
              </span>
            </div>

            {isLoadingAudit ? (
              <div className="py-20 text-center text-xs text-muted-foreground">
                <RefreshCw size={20} className="animate-spin mx-auto mb-3 opacity-50" />
                Streaming audit logs...
              </div>
            ) : !auditItems.length ? (
              <div className="surface p-12 text-center text-muted-foreground">
                <Activity size={32} className="mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm">No activity recorded yet</p>
              </div>
            ) : (
              <div className="surface border border-border overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Timestamp</th>
                      <th className="py-3 px-4 font-semibold">Action / Event</th>
                      <th className="py-3 px-4 font-semibold">Actor</th>
                      <th className="py-3 px-4 font-semibold">Entity / Scope</th>
                      <th className="py-3 px-4 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditItems.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt || log.created_at || Date.now()).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[11px] font-semibold',
                              log.action?.includes('CALL') || log.action?.includes('COMPLETE')
                                ? 'bg-cyan-500/10 text-cyan-400'
                                : log.action?.includes('WALK_IN') || log.action?.includes('BOOK')
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-muted text-foreground'
                            )}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground truncate max-w-[150px]">
                          {log.actorId || log.userId || log.actor?.name || 'Staff User'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {log.departmentId ? `Dept: ${log.departmentId.slice(0, 8)}...` : log.tokenId ? `Token: ${log.tokenId.slice(0, 8)}...` : 'System'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">
                          {log.source || log.reason || JSON.stringify(log.metadata || {})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Platform User Directory */}
        {activeTab === 'users' && isSuperAdmin && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold">Master Platform User & Role Directory</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authorized accounts across Super Admins, Hospital Admins, Receptionists, Doctors, and Patients.
                </p>
              </div>
              <span className="mono text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                {usersList.length} Active Identities
              </span>
            </div>

            {isLoadingUsers ? (
              <div className="py-20 text-center text-xs text-muted-foreground">
                <RefreshCw size={20} className="animate-spin mx-auto mb-3 opacity-50" />
                Loading users...
              </div>
            ) : !usersList.length ? (
              <div className="surface p-12 text-center text-muted-foreground">
                <Users size={32} className="mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm">No platform users found</p>
              </div>
            ) : (
              <div className="surface border border-border overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Name / Identity</th>
                      <th className="py-3 px-4 font-semibold">Email</th>
                      <th className="py-3 px-4 font-semibold">Role Badges</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usersList.map((u: any) => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <span>{u.name || 'Unnamed Staff'}</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.roles?.map((r: any, rIdx: number) => {
                              const roleStr = typeof r === 'string' ? r : r.name || r.slug;
                              return (
                                <span
                                  key={rIdx}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-semibold',
                                    roleStr?.toLowerCase().includes('admin')
                                      ? 'bg-rose-500/10 text-rose-400'
                                      : roleStr?.toLowerCase().includes('doctor')
                                      ? 'bg-cyan-500/10 text-cyan-400'
                                      : roleStr?.toLowerCase().includes('reception')
                                      ? 'bg-amber-500/10 text-amber-400'
                                      : 'bg-muted text-muted-foreground'
                                  )}
                                >
                                  {roleStr}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-400" />
                            {u.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {new Date(u.created_at || u.createdAt || Date.now()).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Web Error & Incident Hub */}
        {activeTab === 'incidents' && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold">Web Error & Incident Management Hub</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Operational bugs and client errors reported by hospital admins directly to the Super Admin Control Tower.
                </p>
              </div>
              <button
                onClick={() => setShowReportErrorModal(true)}
                className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500 text-white shadow-sm hover:opacity-95 cursor-pointer"
              >
                <Bug size={14} />
                <span>Submit Error Report</span>
              </button>
            </div>

            <div className="grid gap-4">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="surface p-5 border border-border hover:border-border/80 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                            inc.severity === 'CRITICAL'
                              ? 'bg-rose-500 text-white'
                              : inc.severity === 'HIGH'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : inc.severity === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {inc.severity}
                        </span>
                        <span className="mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {inc.category}
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{inc.title}</h4>
                      </div>
                      <p className="mono text-xs text-muted-foreground mt-1">
                        Reported by: <span className="text-foreground">{inc.reporterEmail}</span> ({inc.hospitalName}) • {new Date(inc.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={inc.status}
                        onChange={(e) => handleUpdateIncidentStatus(inc.id, e.target.value as any)}
                        className="bg-muted text-foreground border border-border rounded-lg text-xs px-2.5 py-1 font-mono font-semibold cursor-pointer"
                      >
                        <option value="OPEN">Status: OPEN</option>
                        <option value="INVESTIGATING">Status: INVESTIGATING</option>
                        <option value="RESOLVED">Status: RESOLVED</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50">
                    {inc.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-primary" />
                      Component: {inc.component}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Laptop size={13} className="text-muted-foreground" />
                      Env: {inc.browserMeta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL 1: Onboard New Hospital */}
        <AnimatePresence>
          {showOnboardModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="surface border border-border w-full max-w-lg p-6 space-y-5 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-primary size-5" />
                    <h3 className="text-lg font-bold">Onboard New Hospital</h3>
                  </div>
                  <button onClick={() => setShowOnboardModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>

                {createdCredentialsSlip ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                      <p className="font-bold text-sm mb-1">Hospital Successfully Provisioned!</p>
                      <p>Share these credentials with the Hospital Administrator to log in to their dedicated workstation.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/60 border border-border space-y-2 font-mono text-xs">
                      <div>
                        <span className="text-muted-foreground">Hospital Name:</span>{' '}
                        <span className="text-foreground font-bold">{createdCredentialsSlip.hospital}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Admin Login Email:</span>{' '}
                        <span className="text-foreground font-bold">{createdCredentialsSlip.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-muted-foreground">Master Password:</span>{' '}
                          <span className="text-primary font-bold">{createdCredentialsSlip.pass}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(createdCredentialsSlip.pass, 'slip-pass')}
                          className="press p-1.5 rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                        >
                          {copiedKey === 'slip-pass' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <Btn
                      variant="primary"
                      className="w-full"
                      onClick={() => {
                        setCreatedCredentialsSlip(null);
                        setShowOnboardModal(false);
                      }}
                    >
                      Done & Close
                    </Btn>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newHospitalName.trim()) return;
                      createHospitalMutation.mutate(newHospitalName.trim());
                    }}
                    className="space-y-4 text-xs font-mono"
                  >
                    <div>
                      <label className="block text-muted-foreground mb-1.5 font-sans font-semibold">
                        Hospital Facility Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newHospitalName}
                        onChange={(e) => setNewHospitalName(e.target.value)}
                        placeholder="e.g. Apollo Specialty Care"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-sans focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-muted-foreground mb-1.5 font-sans font-semibold">
                        Hospital Administrator Email
                      </label>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="e.g. apollo-admin@hqms.org"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-sans focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-muted-foreground font-sans font-semibold">
                          Administrator Master Password
                        </label>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-[11px] text-primary hover:underline font-sans cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw size={11} /> Generate Secure
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="Enter or generate secure password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-muted-foreground mb-1.5 font-sans font-semibold">
                        Receptionist Counter Allowance
                      </label>
                      <select
                        value={counterAllowance}
                        onChange={(e) => setCounterAllowance(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-sans focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="3">3 Reception Counters</option>
                        <option value="5">5 Reception Counters (Standard)</option>
                        <option value="10">10 Reception Counters (Enterprise)</option>
                        <option value="25">25 Reception Counters (Multi-wing)</option>
                      </select>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3 font-sans">
                      <Btn variant="ghost" type="button" onClick={() => setShowOnboardModal(false)}>
                        Cancel
                      </Btn>
                      <Btn variant="primary" type="submit" disabled={createHospitalMutation.isPending}>
                        {createHospitalMutation.isPending ? 'Provisioning...' : 'Provision Hospital'}
                      </Btn>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: Create Department */}
        <AnimatePresence>
          {showDeptModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="surface border border-border w-full max-w-md p-6 space-y-5 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold">Add Clinical Department</h3>
                  <button onClick={() => setShowDeptModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newDeptName.trim()) return;
                    createDeptMutation.mutate({ hospitalId: showDeptModal, name: newDeptName.trim() });
                  }}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-semibold">
                      Department / Specialty Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="e.g. Cardiology, Pediatrics, ENT"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 font-sans">
                    <Btn variant="ghost" type="button" onClick={() => setShowDeptModal(null)}>
                      Cancel
                    </Btn>
                    <Btn variant="primary" type="submit" disabled={createDeptMutation.isPending}>
                      {createDeptMutation.isPending ? 'Creating...' : 'Create Department'}
                    </Btn>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 3: Create Queue */}
        <AnimatePresence>
          {showQueueModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="surface border border-border w-full max-w-md p-6 space-y-5 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold">Provision Clinical Queue</h3>
                  <button onClick={() => setShowQueueModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newQueueName.trim()) return;
                    createQueueMutation.mutate({
                      departmentId: showQueueModal,
                      name: newQueueName.trim(),
                      roomLabel: newQueueRoom.trim() || undefined,
                    });
                  }}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-semibold">Queue Display Name</label>
                    <input
                      type="text"
                      required
                      value={newQueueName}
                      onChange={(e) => setNewQueueName(e.target.value)}
                      placeholder="e.g. General OPD Queue 1"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-semibold">Consultation Room Label</label>
                    <input
                      type="text"
                      value={newQueueRoom}
                      onChange={(e) => setNewQueueRoom(e.target.value)}
                      placeholder="e.g. Room 104, Cabin B"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 font-sans">
                    <Btn variant="ghost" type="button" onClick={() => setShowQueueModal(null)}>
                      Cancel
                    </Btn>
                    <Btn variant="primary" type="submit" disabled={createQueueMutation.isPending}>
                      {createQueueMutation.isPending ? 'Provisioning...' : 'Provision Queue'}
                    </Btn>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 4: Assign Doctor to Queue */}
        <AnimatePresence>
          {showAssignDoctorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="surface border border-border w-full max-w-md p-6 space-y-5 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold">Assign Consulting Doctor</h3>
                  <button onClick={() => setShowAssignDoctorModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    assignDoctorMutation.mutate({
                      queueId: showAssignDoctorModal.queueId,
                      doctorId: selectedDoctorId || null,
                    });
                  }}
                  className="space-y-4 text-xs font-mono"
                >
                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-sans font-semibold">
                      Select Medical Practitioner
                    </label>
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- No Doctor (Unassigned) --</option>
                      {usersList
                        ?.filter(
                          (u: any) =>
                            u.roles?.some((r: any) =>
                              (typeof r === 'string' ? r : r.name || r.slug)
                                ?.toLowerCase()
                                .includes('doctor')
                            ) || u.email?.includes('doctor')
                        )
                        .map((doc: any) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name || doc.email} ({doc.email})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 font-sans">
                    <Btn variant="ghost" type="button" onClick={() => setShowAssignDoctorModal(null)}>
                      Cancel
                    </Btn>
                    <Btn variant="primary" type="submit" disabled={assignDoctorMutation.isPending}>
                      {assignDoctorMutation.isPending ? 'Saving...' : 'Confirm Assignment'}
                    </Btn>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 5: Report Web Error to Super Admin */}
        <AnimatePresence>
          {showReportErrorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="surface border border-border w-full max-w-lg p-6 space-y-5 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Bug className="text-rose-500 size-5" />
                    <h3 className="text-base font-bold">Report Web Error / Incident</h3>
                  </div>
                  <button onClick={() => setShowReportErrorModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleReportIncident} className="space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-semibold">Incident Title / Summary</label>
                    <input
                      type="text"
                      required
                      value={incidentTitle}
                      onChange={(e) => setIncidentTitle(e.target.value)}
                      placeholder="e.g. Queue call chime silent on TV display"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted-foreground mb-1.5 font-semibold">Severity</label>
                      <select
                        value={incidentSeverity}
                        onChange={(e) => setIncidentSeverity(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="CRITICAL">CRITICAL (System Down)</option>
                        <option value="HIGH">HIGH (Feature Blocked)</option>
                        <option value="MEDIUM">MEDIUM (Glitch / Degraded)</option>
                        <option value="LOW">LOW (Cosmetic / Minor)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted-foreground mb-1.5 font-semibold">Category</label>
                      <select
                        value={incidentCategory}
                        onChange={(e) => setIncidentCategory(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="API_ERROR">API / Backend Failure</option>
                        <option value="QUEUE_DESYNC">Queue Desync</option>
                        <option value="UI_GLITCH">Frontend UI Glitch</option>
                        <option value="HARDWARE_PRINTER">Thermal Printer</option>
                        <option value="PERFORMANCE">Performance / Lag</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-semibold">Affected Component / Route</label>
                    <input
                      type="text"
                      value={incidentComponent}
                      onChange={(e) => setIncidentComponent(e.target.value)}
                      placeholder="e.g. /intake, DoctorConsole.tsx, /display"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1.5 font-semibold">
                      Reproduction Steps & Description
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={incidentDesc}
                      onChange={(e) => setIncidentDesc(e.target.value)}
                      placeholder="Describe what occurred, error messages observed, and steps to reproduce..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 font-sans">
                    <Btn variant="ghost" type="button" onClick={() => setShowReportErrorModal(false)}>
                      Cancel
                    </Btn>
                    <Btn variant="primary" type="submit">
                      Dispatch Incident
                    </Btn>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Page>
    </div>
  );
};
