import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  X, 
  Printer, 
  Check, 
  ChevronDown, 
  AlertTriangle, 
  ShieldCheck, 
  QrCode, 
  Send, 
  Calendar, 
  History, 
  UserPlus, 
  Clock, 
  Copy, 
  CheckCircle2,
  AlertCircle,
  LogOut,
  UserCheck
} from 'lucide-react';
import { Header, Page, Btn, Card, Eyebrow, CountUp, SwapText, Field, ease } from '../../components/hq/ui';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import type { QueueDashboard, StaffQueuesResponse } from '../../types/contract';

export const WalkInDesk: React.FC = () => {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        title="Receptionist Terminal"
        subtitle="Counter 1 • OPD Intake, Check-in & Assisted Care"
        right={
          <button
            onClick={() => signOut()}
            className="press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign out ({user?.email?.split('@')[0]})</span>
          </button>
        }
      />
      <Desk />
    </div>
  );
};

function Desk() {
  const queryClient = useQueryClient();
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'audit'>('queue');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [assistedOpen, setAssistedOpen] = useState(false);
  const [deptMenuOpen, setDeptMenuOpen] = useState(false);
  const [lastIssuedSlip, setLastIssuedSlip] = useState<any | null>(null);

  // 1. Discover staff-accessible queues
  const {
    data: queuesData,
    isLoading: isQueuesLoading,
  } = useQuery({
    queryKey: ['staffQueues'],
    queryFn: () => apiClient.getStaffQueues(),
  });

  const queues = queuesData?.items || [];
  const activeQueue = queues.find((q) => q.id === selectedQueueId) || queues[0] || null;

  useEffect(() => {
    if (!selectedQueueId && queues.length > 0) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  // 2. Poll live queue dashboard every 5 seconds for the active queue
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
  } = useQuery({
    queryKey: ['queueDashboard', activeQueue?.id],
    queryFn: () => apiClient.getQueueDashboard(activeQueue!.id),
    enabled: Boolean(activeQueue?.id),
    refetchInterval: 5000,
  });

  // 3. Query staff appointments for today (for physical check-in on arrival)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(Date.now() + 2 * 86400000);

  const {
    data: appointmentsData,
    isLoading: isAptsLoading,
    refetch: refetchApts,
  } = useQuery({
    queryKey: ['staffAppointments'],
    queryFn: () => apiClient.getStaffAppointments(todayStart.toISOString(), todayEnd.toISOString()),
    refetchInterval: 10000,
  });

  // 4. Query live audit log stream
  const { data: auditData } = useQuery({
    queryKey: ['staffAuditLog'],
    queryFn: () => apiClient.getStaffAuditLog(),
    refetchInterval: 10000,
  });

  // Mutation: Check in an appointment
  const checkInMutation = useMutation({
    mutationFn: (appointmentId: string) => apiClient.checkInAppointment(appointmentId),
    onSuccess: (token, appointmentId) => {
      queryClient.invalidateQueries({ queryKey: ['queueDashboard', activeQueue?.id] });
      queryClient.invalidateQueries({ queryKey: ['staffAppointments'] });
      queryClient.invalidateQueries({ queryKey: ['staffAuditLog'] });

      // Find appointment details to show slip
      const apt = appointmentsData?.items?.find((a: any) => a.id === appointmentId);
      setLastIssuedSlip({
        tokenCode: token.displayNumber || token.sequence?.toString() || 'TK',
        patientName: apt?.patient?.displayName || 'Booked Patient',
        uhid: apt?.patient?.patientNumber || 'UHID',
        deptName: activeQueue?.department?.name || 'Department',
        room: activeQueue?.roomLabel || 'Room TBA',
        doctor: activeQueue?.doctor?.name ? `Dr. ${activeQueue.doctor.name}` : 'Doctor',
        issuedAt: new Date(token.issuedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    },
    onError: (err: any) => {
      alert(`Check-in failed: ${err.message}`);
    },
  });

  const servingToken = dashboardData?.activeToken;
  const waitingTokens = dashboardData?.waitingTokens || [];
  const auditLogs = auditData?.items || [];
  const appointments = appointmentsData?.items || [];

  return (
    <Page>
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="relative">
          <Eyebrow>Assigned Department & Queue</Eyebrow>
          <button
            onClick={() => setDeptMenuOpen(!deptMenuOpen)}
            className="press mt-1 flex items-center gap-2 text-3xl font-semibold sm:text-4xl cursor-pointer"
          >
            {activeQueue?.name || (isQueuesLoading ? 'Loading Queues...' : 'No Queues Assigned')}{' '}
            <ChevronDown
              className={cn('size-6 text-muted-foreground transition-transform duration-200', deptMenuOpen && 'rotate-180')}
            />
          </button>
          <AnimatePresence>
            {deptMenuOpen && queues.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18, ease }}
                className="surface absolute left-0 top-full z-30 mt-2 w-72 origin-top-left p-1.5 shadow-lift"
              >
                {queues.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setSelectedQueueId(q.id);
                      setDeptMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold">{q.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {q.department?.name} • {q.roomLabel || 'Room TBA'}
                      </p>
                    </div>
                    {q.id === activeQueue?.id && <Check className="size-4 text-primary" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeQueue?.doctor?.name ? `Dr. ${activeQueue.doctor.name}` : 'Physician on Duty'} • {activeQueue?.roomLabel || 'Room TBA'}
          </p>
        </div>

        {/* Action Buttons: Walk-in & Assisted Booking */}
        <div className="flex items-center gap-2.5">
          <Btn variant="soft" size="lg" onClick={() => setAssistedOpen(true)} className="gap-2">
            <UserPlus className="size-4 text-primary" /> Book for Patient (Elder / Offline)
          </Btn>
          <Btn
            variant="ink"
            size="lg"
            onClick={() => setWalkInOpen(true)}
            disabled={!activeQueue}
            className="gap-2"
          >
            <Plus className="size-4" /> Issue Walk-In Token
          </Btn>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <Eyebrow>Now In Consultation</Eyebrow>
          <p className="mono mt-3 text-3xl font-semibold text-primary">
            <SwapText value={servingToken?.displayNumber ?? '—'} />
          </p>
        </Card>
        <Card>
          <Eyebrow>Waiting in Hall</Eyebrow>
          <p className="mt-3 text-3xl font-semibold">
            <CountUp value={waitingTokens.length} />
          </p>
        </Card>
        <Card>
          <Eyebrow>Estimated Wait</Eyebrow>
          <p className="mt-3 text-3xl font-semibold">
            ~<CountUp value={waitingTokens.length * 6} />
            <span className="ml-1 text-base text-muted-foreground">min</span>
          </p>
        </Card>
        <Card>
          <Eyebrow>Department Bookings</Eyebrow>
          <p className="mt-3 text-3xl font-semibold">
            <CountUp value={appointments.length} />
          </p>
        </Card>
      </div>

      {/* Main Two-Pane View */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Pane: Queue Table, Check-In, or Audit Log */}
        <div className="surface overflow-hidden p-0">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('queue')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  activeTab === 'queue' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Live Queue ({waitingTokens.length})
              </button>
              <button
                onClick={() => setActiveTab('appointments')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5',
                  activeTab === 'appointments' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Calendar size={13} /> Bookings & Check-in ({appointments.length})
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5',
                  activeTab === 'audit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <History size={13} /> Activity Audit ({auditLogs.length})
              </button>
            </div>

            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span className="pulse-dot size-1.5 rounded-full bg-success" />
              Live Server Polling (5s)
            </span>
          </div>

          {activeTab === 'queue' ? (
            /* Queue Table */
            <div className="p-4">
              {waitingTokens.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-semibold text-sm">No Waiting Patients in Queue</p>
                  <p className="text-xs mt-1">Issue a walk-in token or check in a booked patient to populate the queue.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {waitingTokens.map((t, idx) => (
                    <div key={t.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-semibold">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="mono font-bold text-base">{t.displayNumber}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Token ID: {t.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-mono">
                        WAITING
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'appointments' ? (
            /* Bookings & Day-Of Check-in List */
            <div className="divide-y divide-border max-h-[550px] overflow-y-auto">
              {appointments.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-semibold text-sm">No Scheduled Appointments for Today</p>
                </div>
              ) : (
                appointments.map((apt: any) => {
                  const isCheckedIn = apt.status === 'CHECKED_IN';
                  const isCancelled = apt.status === 'CANCELLED';
                  const start = new Date(apt.slot?.startsAt);

                  return (
                    <div key={apt.id} className="p-4 hover:bg-muted/20 transition-colors flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-foreground">
                            {apt.patient?.displayName}
                          </span>
                          <span className="mono text-xs text-muted-foreground font-mono">
                            ({apt.patient?.patientNumber})
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono',
                              isCheckedIn
                                ? 'bg-success-soft text-success'
                                : isCancelled
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary'
                            )}
                          >
                            {apt.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                          <Clock size={12} />
                          <span>
                            Slot: {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>•</span>
                          <span>{apt.slot?.doctorName ? `Dr. ${apt.slot.doctorName}` : 'Doctor'}</span>
                        </p>
                      </div>

                      <div>
                        {isCheckedIn ? (
                          <span className="text-xs font-mono font-semibold text-success flex items-center gap-1">
                            <CheckCircle2 size={14} /> Checked In
                          </span>
                        ) : isCancelled ? (
                          <span className="text-xs font-mono text-destructive">Cancelled</span>
                        ) : (
                          <Btn
                            size="sm"
                            variant="ink"
                            loading={checkInMutation.isPending}
                            onClick={() => checkInMutation.mutate(apt.id)}
                            className="gap-1.5"
                          >
                            <Check size={14} /> Check In & Issue Slip
                          </Btn>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Live Activity Audit Stream */
            <div className="divide-y divide-border max-h-[550px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-semibold text-sm">No Audit Events Logged</p>
                </div>
              ) : (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="p-4 hover:bg-muted/20 transition-colors text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            log.action === 'APPOINTMENT_BOOKED'
                              ? 'bg-primary'
                              : log.action === 'APPOINTMENT_CHECKED_IN'
                              ? 'bg-emerald-500'
                              : log.action === 'CALL_NEXT'
                              ? 'bg-amber-500'
                              : log.action === 'CONSULTATION_COMPLETED'
                              ? 'bg-success'
                              : log.action === 'APPOINTMENT_CANCELLED'
                              ? 'bg-destructive'
                              : 'bg-slate-400'
                          )}
                        />
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                      <span>Source: <b className="text-foreground">{log.source || 'SYSTEM'}</b></span>
                      {log.tokenId && <span>Token ID: <b className="text-primary">{log.tokenId.slice(0, 8)}</b></span>}
                      {log.appointmentId && <span>Apt: {log.appointmentId.slice(0, 8)}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Slip / Quick Guidance */}
        <div className="space-y-4">
          {lastIssuedSlip ? (
            <div className="surface p-5 border border-primary/40 bg-accent/20">
              <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
                <span className="font-bold text-xs uppercase tracking-wider text-primary">Last Issued Slip</span>
                <button onClick={() => setLastIssuedSlip(null)} className="press text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="text-center py-2">
                <p className="text-xs uppercase font-mono text-muted-foreground">Token Code</p>
                <p className="mono text-4xl font-bold tracking-tight text-foreground">{lastIssuedSlip.tokenCode}</p>
                <p className="text-xs font-semibold text-foreground mt-1">{lastIssuedSlip.patientName}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{lastIssuedSlip.uhid}</p>
              </div>
              <div className="pt-3 border-t border-border flex justify-center">
                <Btn variant="ink" size="sm" onClick={() => window.print()} className="gap-1.5 w-full">
                  <Printer size={14} /> Print 80mm Slip
                </Btn>
              </div>
            </div>
          ) : (
            <div className="surface p-4 bg-muted/20 text-xs space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary" /> Receptionist Standard Workflow
              </p>
              <p className="text-muted-foreground leading-relaxed">
                1. <b>Walk-ins:</b> Click "Issue Walk-In Token", search patient UHID or register them, and print their 80mm slip.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                2. <b>Check-ins:</b> Select "Bookings & Check-in", verify the arriving patient, and click "Check In" to mint their queue token.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Walk-In Token Issuance */}
      {activeQueue && (
        <WalkInDialog
          open={walkInOpen}
          onClose={() => setWalkInOpen(false)}
          queue={activeQueue}
          onIssued={(slip) => {
            setLastIssuedSlip(slip);
            queryClient.invalidateQueries({ queryKey: ['queueDashboard', activeQueue.id] });
            queryClient.invalidateQueries({ queryKey: ['staffAuditLog'] });
          }}
        />
      )}

      {/* Modal 2: Assisted Booking for Elder / Offline Patients */}
      {activeQueue && (
        <AssistedBookingDialog
          open={assistedOpen}
          onClose={() => setAssistedOpen(false)}
          queue={activeQueue}
          onBooked={(slip) => {
            setLastIssuedSlip(slip);
            queryClient.invalidateQueries({ queryKey: ['staffAppointments'] });
            queryClient.invalidateQueries({ queryKey: ['staffAuditLog'] });
          }}
        />
      )}
    </Page>
  );
}

/* =========================================================================
   Modal 1: Walk-in Token Dialog (Connected to POST /walk-ins)
   ========================================================================= */
function WalkInDialog({
  open,
  onClose,
  queue,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  queue: any;
  onIssued: (slip: any) => void;
}) {
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState<{ id: string; patientNumber: string; displayName: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newName, setNewName] = useState('');

  if (!open) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = query.trim();
    if (!clean) return;

    setIsSearching(true);
    try {
      const res = await apiClient.lookupPatient(clean);
      if (res?.items?.length) {
        setPatient(res.items[0]);
        setIsNewPatient(false);
      } else {
        setIsNewPatient(true);
        setNewName(query);
      }
    } catch (err: any) {
      // Patient not found on server
      setIsNewPatient(true);
      setNewName(query);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIssue = async () => {
    setErrorMsg(null);
    setIsIssuing(true);
    try {
      let patientId = patient?.id;
      let patientNumber = patient?.patientNumber;
      let displayName = patient?.displayName;

      // If new walk-in patient, register them on backend first
      if (isNewPatient || !patientId) {
        const created = await apiClient.registerStaffPatient(queue.id, newName.trim() || 'Walk-In Patient');
        patientId = created.id;
        patientNumber = created.patientNumber;
        displayName = created.displayName;
      }

      // Issue walk-in token
      const token = await apiClient.issueWalkIn({
        patientId: patientId!,
        queueId: queue.id,
      });

      onIssued({
        tokenCode: token.displayNumber || 'TK',
        patientName: displayName,
        uhid: patientNumber,
        deptName: queue.department?.name,
        room: queue.roomLabel,
        doctor: queue.doctor?.name ? `Dr. ${queue.doctor.name}` : 'Physician',
        issuedAt: new Date(token.issuedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Token issuance failed.');
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-[28px] bg-card p-6 shadow-lift border border-border"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <Eyebrow>Counter Intake</Eyebrow>
            <h2 className="text-xl font-semibold mt-0.5">Issue Walk-In Queue Token</h2>
            <p className="text-xs text-muted-foreground font-mono">{queue.name} • {queue.roomLabel}</p>
          </div>
          <button onClick={onClose} className="press p-1.5 rounded-full hover:bg-muted text-muted-foreground cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="py-4 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Field
                label="Search Patient by Exact UHID"
                placeholder="e.g. M1-4d1422a8-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Btn type="submit" variant="soft" loading={isSearching} className="mt-6 h-11 px-4">
              <Search size={16} /> Lookup
            </Btn>
          </form>

          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <span>Seeded UHIDs:</span>
            <button
              type="button"
              onClick={() => {
                setQuery('M1-4d1422a8-1');
              }}
              className="px-2 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              M1-4d1422a8-1 (Patient 1)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('M1-4d1422a8-2');
              }}
              className="px-2 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              M1-4d1422a8-2 (Patient 2)
            </button>
          </div>

          {patient && !isNewPatient && (
            <div className="surface p-3.5 bg-muted/30 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{patient.displayName}</p>
                <p className="mono text-xs text-muted-foreground">{patient.patientNumber}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-success-soft text-success font-semibold">
                Verified UHID
              </span>
            </div>
          )}

          {isNewPatient && (
            <div className="surface p-4 border-primary/40 bg-accent/30 space-y-3">
              <p className="text-xs font-semibold text-primary">New Walk-In Patient Registration</p>
              <Field
                label="Patient Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground font-mono">
                A server UHID will be created under {queue.department?.name}.
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Btn variant="soft" onClick={onClose}>Cancel</Btn>
            <Btn variant="ink" loading={isIssuing} onClick={handleIssue}>Confirm & Print Slip</Btn>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* =========================================================================
   Modal 2: Assisted Booking for Elder / Offline Patients
   ========================================================================= */
function AssistedBookingDialog({
  open,
  onClose,
  queue,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  queue: any;
  onBooked: (slip: any) => void;
}) {
  const [patientName, setPatientName] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Query published slots for this queue
  const todayIso = new Date().toISOString();
  const nextWeekIso = new Date(Date.now() + 7 * 86400000).toISOString();

  const { data: slotsData, isLoading: isSlotsLoading } = useQuery({
    queryKey: ['availableSlots', queue.id],
    queryFn: () => apiClient.getAvailableSlots(queue.id, todayIso, nextWeekIso),
    enabled: open,
  });

  const slots = slotsData?.items || [];

  if (!open) return null;

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      setErrorMsg('Please select an available consultation slot.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Register walk-in patient under receptionist
      const reg = await apiClient.registerStaffPatient(queue.id, patientName.trim() || 'Elder Patient');

      // 2. Book appointment for this patient
      const apt = await apiClient.bookAppointment(selectedSlotId, reg.id);

      // 3. Immediately check-in if today so patient receives token slip
      try {
        const token = await apiClient.checkInAppointment(apt.id);
        onBooked({
          tokenCode: token.displayNumber || token.sequence?.toString() || 'TK',
          patientName: reg.displayName,
          uhid: reg.patientNumber,
          deptName: queue.department?.name,
          room: queue.roomLabel,
          doctor: queue.doctor?.name ? `Dr. ${queue.doctor.name}` : 'Physician',
          issuedAt: new Date(token.issuedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } catch (checkInErr) {
        // If not today, show booking confirmation
        onBooked({
          tokenCode: 'BOOKED',
          patientName: reg.displayName,
          uhid: reg.patientNumber,
          deptName: queue.department?.name,
          room: queue.roomLabel,
          doctor: queue.doctor?.name ? `Dr. ${queue.doctor.name}` : 'Physician',
          issuedAt: 'Future Booking',
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Assisted booking failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-[28px] bg-card p-6 shadow-lift border border-border"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <Eyebrow>Assisted Service</Eyebrow>
            <h2 className="text-xl font-semibold mt-0.5">Book Appointment for Patient (Offline / Elder)</h2>
            <p className="text-xs text-muted-foreground font-mono">{queue.name} • {queue.roomLabel}</p>
          </div>
          <button onClick={onClose} className="press p-1.5 rounded-full hover:bg-muted text-muted-foreground cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleBooking} className="py-4 space-y-4">
          <Field
            label="Patient Full Name"
            placeholder="e.g. Ramachandran Nair"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            required
          />

          <div>
            <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
              Select Available Consultation Slot
            </label>
            {isSlotsLoading ? (
              <p className="text-xs text-muted-foreground font-mono p-4 bg-muted/20 rounded-xl">Loading slots...</p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono p-4 bg-muted/20 rounded-xl border border-border">
                No future slots published for {queue.name}. Doctor must publish slots first.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {slots.map((s) => {
                  const start = new Date(s.startsAt);
                  const end = new Date(s.endsAt);
                  const time = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                  const dateStr = start.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSlotId(s.id)}
                      className={cn(
                        'press p-2.5 rounded-xl border text-left cursor-pointer transition-colors text-xs',
                        selectedSlotId === s.id
                          ? 'border-primary bg-primary text-primary-foreground font-semibold'
                          : 'border-border bg-card hover:border-foreground/30'
                      )}
                    >
                      <p className="font-semibold">{dateStr}</p>
                      <p className="mono opacity-80">{time}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Btn variant="soft" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" variant="ink" loading={isSubmitting} disabled={!selectedSlotId}>
              Book & Issue Token Slip
            </Btn>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
