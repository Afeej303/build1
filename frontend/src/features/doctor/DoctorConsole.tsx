import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Check,
  Coffee,
  Clock,
  ArrowRight,
  Plus,
  Calendar,
  AlertCircle,
  X,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Stethoscope,
} from 'lucide-react';
import { Header, Page, Btn, Eyebrow, ease } from '../../components/hq/ui';
import { useAuth } from '../../lib/auth';
import { apiClient } from '../../lib/api-client';
import { QueueDashboard, StaffQueueItem } from '../../types/contract';
import { cn } from '../../lib/utils';

const getIsoTimezoneOffset = (): string => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  if (isNaN(offsetMinutes)) return '+05:30';
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
};

const getDefaultSlotSchedule = (): { date: string; startTime: string; endTime: string } => {
  const now = new Date();
  const currentHour = now.getHours();
  const pad = (n: number) => String(n).padStart(2, '0');

  // If >= 20:00 (8 PM) or < 08:00 (8 AM), default to tomorrow (or today if early morning) at 09:00 - 09:30
  if (currentHour >= 20 || currentHour < 8) {
    const target = new Date(now);
    if (currentHour >= 20) {
      target.setDate(target.getDate() + 1);
    }
    const year = target.getFullYear();
    const month = pad(target.getMonth() + 1);
    const day = pad(target.getDate());
    return {
      date: `${year}-${month}-${day}`,
      startTime: '09:00',
      endTime: '09:30',
    };
  }

  // Otherwise, round to next 30-minute block from now
  const start = new Date(now);
  const minutes = start.getMinutes();
  if (minutes < 30) {
    start.setMinutes(30, 0, 0);
  } else {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }

  if (start.getHours() >= 20) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      date: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`,
      startTime: '09:00',
      endTime: '09:30',
    };
  }

  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return {
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
};

export const DoctorConsole: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  // 1. Discover Doctor Queues
  const {
    data: queuesData,
    isLoading: isLoadingQueues,
    error: queuesError,
    refetch: refetchQueues,
  } = useQuery({
    queryKey: ['doctor-queues'],
    queryFn: () => apiClient.getStaffQueues(),
  });

  const queues = queuesData?.items || [];
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');

  // Default to first assigned queue when loaded
  useEffect(() => {
    if (queues.length > 0 && !selectedQueueId) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  const currentQueue = useMemo(
    () => queues.find((q) => q.id === selectedQueueId) || queues[0],
    [queues, selectedQueueId]
  );

  // 2. Poll Live Queue Dashboard (5s interval)
  const {
    data: dashboard,
    isLoading: isLoadingDashboard,
    isRefetching: isRefetchingDashboard,
    error: dashboardError,
  } = useQuery<QueueDashboard>({
    queryKey: ['queue-dashboard', selectedQueueId],
    queryFn: () => apiClient.getQueueDashboard(selectedQueueId),
    enabled: !!selectedQueueId,
    refetchInterval: 5000,
  });

  const active = dashboard?.activeToken;
  const waiting = dashboard?.waitingTokens || [];

  // Active consultation stopwatch
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!active?.calledAt) {
      setElapsedSeconds(0);
      return;
    }
    const calledTime = new Date(active.calledAt).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - calledTime) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [active?.id, active?.calledAt]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Feedback notifications
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 3. Call Next Patient Mutation
  const callNextMutation = useMutation({
    mutationFn: () => apiClient.callNext(selectedQueueId),
    onSuccess: (data) => {
      setActionError(null);
      setActionSuccess(`Called token ${data.displayNumber}`);
      queryClient.invalidateQueries({ queryKey: ['queue-dashboard', selectedQueueId] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queues'] });
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionSuccess(null);
      setActionError(err.message || 'Failed to call next patient');
      setTimeout(() => setActionError(null), 6000);
    },
  });

  // 4. Complete Consultation Mutation
  const completeMutation = useMutation({
    mutationFn: (tokenId: string) => apiClient.completeToken(tokenId),
    onSuccess: (data) => {
      setActionError(null);
      setActionSuccess(`Consultation for ${data.displayNumber} completed`);
      queryClient.invalidateQueries({ queryKey: ['queue-dashboard', selectedQueueId] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queues'] });
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionSuccess(null);
      setActionError(err.message || 'Failed to complete consultation');
      setTimeout(() => setActionError(null), 6000);
    },
  });

  // 5. Slot Publishing State & Queries
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const initialSchedule = useMemo(() => getDefaultSlotSchedule(), []);
  const [slotDate, setSlotDate] = useState(initialSchedule.date);
  const [slotStartTime, setSlotStartTime] = useState(initialSchedule.startTime);
  const [slotEndTime, setSlotEndTime] = useState(initialSchedule.endTime);
  const [slotPublishError, setSlotPublishError] = useState<string | null>(null);
  const [slotPublishSuccess, setSlotPublishSuccess] = useState<string | null>(null);
  const [slotFilter, setSlotFilter] = useState<'selected' | 'all'>('selected');

  // Query upcoming slots across a multi-day window (today to +14 days)
  const slotQueryWindow = useMemo(() => {
    const from = new Date(Date.now() - 3600 * 1000).toISOString();
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString();
    return { from, to };
  }, [isSlotModalOpen]);

  const {
    data: slotsData,
    refetch: refetchSlots,
    isLoading: isLoadingSlots,
  } = useQuery({
    queryKey: ['available-slots', selectedQueueId],
    queryFn: () => apiClient.getAvailableSlots(selectedQueueId, slotQueryWindow.from, slotQueryWindow.to),
    enabled: !!selectedQueueId && isSlotModalOpen,
  });

  const allUpcomingSlots = useMemo(() => {
    const items = slotsData?.items || [];
    return items.slice().sort(
      (a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }, [slotsData?.items]);

  const slotsForSelectedDate = useMemo(() => {
    return allUpcomingSlots.filter((slot: any) => {
      const d = new Date(slot.startsAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}` === slotDate;
    });
  }, [allUpcomingSlots, slotDate]);

  const displayedSlots = slotFilter === 'selected' ? slotsForSelectedDate : allUpcomingSlots;

  const handleOpenSlotModal = () => {
    const tzOffset = getIsoTimezoneOffset();
    const existingStart = new Date(`${slotDate}T${slotStartTime}:00${tzOffset}`);
    if (isNaN(existingStart.getTime()) || existingStart.getTime() <= Date.now()) {
      const defaults = getDefaultSlotSchedule();
      setSlotDate(defaults.date);
      setSlotStartTime(defaults.startTime);
      setSlotEndTime(defaults.endTime);
    }
    setSlotPublishError(null);
    setSlotPublishSuccess(null);
    setIsSlotModalOpen(true);
  };

  const publishSlotMutation = useMutation({
    mutationFn: async () => {
      setSlotPublishError(null);
      setSlotPublishSuccess(null);

      const tzOffset = getIsoTimezoneOffset();
      const startsAt = `${slotDate}T${slotStartTime}:00${tzOffset}`;
      const endsAt = `${slotDate}T${slotEndTime}:00${tzOffset}`;

      const startDate = new Date(startsAt);
      const endDate = new Date(endsAt);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Please enter valid date and time values.');
      }
      if (startDate.getTime() <= Date.now()) {
        throw new Error('Slot start time must be in the future. Please choose an upcoming time.');
      }
      if (endDate.getTime() <= startDate.getTime()) {
        throw new Error('Slot end time must be after the start time.');
      }

      return apiClient.publishSlot(selectedQueueId, startsAt, endsAt);
    },
    onSuccess: () => {
      setSlotPublishSuccess('Availability slot published successfully!');
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots', selectedQueueId] });
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      refetchSlots();
      setTimeout(() => setSlotPublishSuccess(null), 5000);
    },
    onError: (err: any) => {
      setSlotPublishError(err.message || 'Failed to publish slot.');
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Doctor Clinical Workstation"
        subtitle={`${profile?.name || user?.email || 'Dr. Rao'} • ${currentQueue?.department?.name || 'General Medicine'} (${currentQueue?.roomLabel || 'Room 2'})`}
        right={
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenSlotModal}
              className="press flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <Calendar size={14} />
              <span>Publish Slots</span>
            </button>
            <button
              onClick={() => signOut()}
              className="press flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        }
      />

      <Page>
        {/* Error / Success Banners */}
        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-xs font-medium text-destructive"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button onClick={() => setActionError(null)}>
                <X size={14} />
              </button>
            </motion.div>
          )}

          {actionSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-3 rounded-xl bg-success-soft border border-success/20 p-4 text-xs font-medium text-success"
            >
              <CheckCircle2 size={16} className="shrink-0" />
              <span className="flex-1">{actionSuccess}</span>
              <button onClick={() => setActionSuccess(null)}>
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Queue Info & Selector */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>
              {currentQueue?.department?.name || 'Department'} • {currentQueue?.roomLabel || 'Room'}
            </Eyebrow>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                {currentQueue?.name || 'Clinical Queue'}
              </h1>
              {queues.length > 1 && (
                <select
                  value={selectedQueueId}
                  onChange={(e) => setSelectedQueueId(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer"
                >
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} ({q.roomLabel})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-[13px] font-medium text-success">
              <span className="pulse-dot size-1.5 rounded-full bg-success" />
              Live Consultation
            </span>
            {isRefetchingDashboard && (
              <RefreshCw size={13} className="animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Main Clinical Grid: Active Patient Stage (Left) & Waiting Queue (Right) */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {active ? (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -10 }}
                  transition={{ duration: 0.3, ease }}
                  className="rounded-[28px] bg-ink p-7 text-ink-foreground shadow-lift border border-ink-foreground/10"
                >
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="opacity-70 flex items-center gap-2 font-mono">
                      <Clock size={15} />
                      Consultation Time:{' '}
                      <span className="font-bold text-white text-base">
                        {formatTimer(elapsedSeconds)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-primary font-medium">
                      <span className="pulse-dot size-1.5 rounded-full bg-primary" />
                      Now In Room
                    </span>
                  </div>

                  <div className="my-8">
                    <span className="text-xs uppercase tracking-wider opacity-60 font-mono">
                      Active Queue Token
                    </span>
                    <p className="mono text-7xl font-semibold tracking-tight text-white">
                      {active.displayNumber}
                    </p>
                    {active.priority && active.priority !== 'NORMAL' && (
                      <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-destructive text-white text-xs font-semibold">
                        {active.priority} PRIORITY
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t border-ink-foreground/10 pt-5 text-sm">
                    <div>
                      <p className="text-[12px] opacity-50">Patient Name</p>
                      <p className="mt-0.5 font-medium truncate text-white">
                        {active.patient?.displayName || 'Registered Patient'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] opacity-50">Patient UHID</p>
                      <p className="mono mt-0.5 font-medium text-white">
                        {active.patient?.patientNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] opacity-50">Status</p>
                      <p className="mt-0.5 font-medium text-emerald-400 capitalize">
                        {active.status.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid place-items-center rounded-[28px] border border-dashed border-border px-6 py-16 text-center bg-card/40"
                >
                  {waiting.length > 0 ? (
                    <>
                      <Megaphone className="size-8 text-primary" strokeWidth={1.5} />
                      <p className="mt-3 text-lg font-semibold">Ready for Next Patient</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Token{' '}
                        <span className="mono font-semibold text-foreground">
                          {waiting[0]?.displayNumber}
                        </span>{' '}
                        is waiting at the top of the queue.
                      </p>
                      <Btn
                        size="lg"
                        variant="primary"
                        loading={callNextMutation.isPending}
                        onClick={() => callNextMutation.mutate()}
                        className="mt-6"
                      >
                        Call {waiting[0]?.displayNumber} Now <ArrowRight size={16} />
                      </Btn>
                    </>
                  ) : (
                    <>
                      <Coffee className="size-8 text-muted-foreground" strokeWidth={1.5} />
                      <p className="mt-3 text-lg font-semibold">All Consultations Completed</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        No patients are currently waiting for{' '}
                        {currentQueue?.name || 'this queue'}.
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Btn
                size="lg"
                variant="soft"
                disabled={!active || completeMutation.isPending}
                loading={completeMutation.isPending}
                onClick={() => active && completeMutation.mutate(active.id)}
                className="gap-2"
              >
                <Check className="size-4" /> Complete Consultation
              </Btn>
              <Btn
                size="lg"
                variant="primary"
                disabled={waiting.length === 0 || !!active || callNextMutation.isPending}
                loading={callNextMutation.isPending}
                onClick={() => callNextMutation.mutate()}
                className="gap-2"
              >
                <Megaphone className="size-4" /> Call Next Patient
              </Btn>
            </div>
          </div>

          {/* Right Side: Waiting Queue Table */}
          <div className="surface overflow-hidden p-0 border border-border rounded-[24px]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/40">
              <div>
                <p className="text-sm font-semibold">
                  Waiting Patients ({waiting.length})
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentQueue?.roomLabel || 'Room 2'}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium font-mono">
                <span className="pulse-dot size-1.5 rounded-full bg-success" />
                Live Feed
              </span>
            </div>

            {isLoadingDashboard ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading live queue...
              </div>
            ) : waiting.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <Coffee className="mx-auto size-6 mb-2 opacity-50" />
                Queue is empty
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-[460px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {waiting.map((t, index) => (
                    <motion.li
                      key={t.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease }}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="mono text-xs text-muted-foreground w-5">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="mono font-semibold text-sm text-foreground">
                            {t.displayNumber}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            ID: {t.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {t.priority && t.priority !== 'NORMAL' ? (
                          <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold">
                            {t.priority}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium font-mono">
                            Waiting
                          </span>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* Slot Publishing Modal */}
        <AnimatePresence>
          {isSlotModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease }}
                className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-lift text-card-foreground"
              >
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-primary size-5" />
                    <h2 className="text-lg font-semibold tracking-tight">
                      Publish Appointment Availability
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsSlotModalOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Publishing future slots allows patients to discover and book appointments online. Timezone is Asia/Kolkata (+05:30).
                  </p>

                  {slotPublishError && (
                    <div className="flex items-start gap-2.5 p-3 text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span className="flex-1">{slotPublishError}</span>
                      <button
                        type="button"
                        onClick={() => setSlotPublishError(null)}
                        className="text-destructive/70 hover:text-destructive cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {slotPublishSuccess && (
                    <div className="flex items-start gap-2.5 p-3 text-xs rounded-lg bg-success-soft text-success border border-success/20 font-medium">
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                      <span className="flex-1">{slotPublishSuccess}</span>
                      <button
                        type="button"
                        onClick={() => setSlotPublishSuccess(null)}
                        className="text-success/70 hover:text-success cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Date</label>
                      <input
                        type="date"
                        value={slotDate}
                        onChange={(e) => setSlotDate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Start Time</label>
                      <input
                        type="time"
                        value={slotStartTime}
                        onChange={(e) => setSlotStartTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">End Time</label>
                      <input
                        type="time"
                        value={slotEndTime}
                        onChange={(e) => setSlotEndTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <Btn
                    variant="ink"
                    size="md"
                    loading={publishSlotMutation.isPending}
                    onClick={() => publishSlotMutation.mutate()}
                    className="w-full gap-2 cursor-pointer"
                  >
                    <Plus size={16} /> Publish Availability Slot
                  </Btn>

                  {/* List of slots with multi-day toggle */}
                  <div className="mt-6 border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {slotFilter === 'selected' ? `Slots for ${slotDate}` : 'Upcoming Slots (Next 14 Days)'}
                        <span className="ml-1.5 font-normal text-muted-foreground">({displayedSlots.length})</span>
                      </p>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSlotFilter('selected')}
                          className={cn(
                            'px-2 py-0.5 rounded transition-colors cursor-pointer',
                            slotFilter === 'selected'
                              ? 'bg-primary/20 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Date ({slotsForSelectedDate.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlotFilter('all')}
                          className={cn(
                            'px-2 py-0.5 rounded transition-colors cursor-pointer',
                            slotFilter === 'all'
                              ? 'bg-primary/20 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          All 14 Days ({allUpcomingSlots.length})
                        </button>
                      </div>
                    </div>

                    {isLoadingSlots ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">Loading availability slots...</p>
                    ) : displayedSlots.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-muted-foreground italic">
                          {slotFilter === 'selected'
                            ? `No slots published for ${slotDate}.`
                            : 'No upcoming slots published for this queue.'}
                        </p>
                        {slotFilter === 'selected' && allUpcomingSlots.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSlotFilter('all')}
                            className="mt-1.5 text-xs text-primary hover:underline cursor-pointer"
                          >
                            View all {allUpcomingSlots.length} upcoming slots across next 14 days
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {displayedSlots.map((slot: any) => {
                          const sDate = new Date(slot.startsAt);
                          const eDate = new Date(slot.endsAt);
                          const dateLabel = sDate.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          });
                          const timeLabel = `${sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                          return (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-sans text-[11px] text-muted-foreground font-medium">
                                  {dateLabel}
                                </span>
                                <span className="text-foreground font-semibold">{timeLabel}</span>
                              </div>
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                                  slot.status === 'AVAILABLE' || !slot.status
                                    ? 'bg-success-soft text-success'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {slot.status || 'AVAILABLE'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Page>
    </div>
  );
};
