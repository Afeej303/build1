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
  const todayStr = new Date().toISOString().split('T')[0];
  const [slotDate, setSlotDate] = useState(todayStr);
  const [slotStartTime, setSlotStartTime] = useState('17:00');
  const [slotEndTime, setSlotEndTime] = useState('17:20');
  const [slotPublishError, setSlotPublishError] = useState<string | null>(null);
  const [slotPublishSuccess, setSlotPublishSuccess] = useState<string | null>(null);

  // Query today's slots
  const startOfDayISO = `${slotDate}T00:00:00+05:30`;
  const endOfDayISO = `${slotDate}T23:59:59+05:30`;

  const { data: slotsData, refetch: refetchSlots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['available-slots', selectedQueueId, slotDate],
    queryFn: () => apiClient.getAvailableSlots(selectedQueueId, startOfDayISO, endOfDayISO),
    enabled: !!selectedQueueId && isSlotModalOpen,
  });

  const publishSlotMutation = useMutation({
    mutationFn: async () => {
      setSlotPublishError(null);
      setSlotPublishSuccess(null);
      const startsAt = `${slotDate}T${slotStartTime}:00+05:30`;
      const endsAt = `${slotDate}T${slotEndTime}:00+05:30`;

      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        throw new Error('End time must be after start time.');
      }

      return apiClient.publishSlot(selectedQueueId, startsAt, endsAt);
    },
    onSuccess: () => {
      setSlotPublishSuccess('Availability slot published successfully!');
      refetchSlots();
      setTimeout(() => setSlotPublishSuccess(null), 4000);
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
              onClick={() => setIsSlotModalOpen(true)}
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
                    <div className="p-3 text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                      {slotPublishError}
                    </div>
                  )}

                  {slotPublishSuccess && (
                    <div className="p-3 text-xs rounded-lg bg-success-soft text-success border border-success/20 font-medium">
                      {slotPublishSuccess}
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
                    className="w-full gap-2"
                  >
                    <Plus size={16} /> Publish Availability Slot
                  </Btn>

                  {/* List of slots for the chosen day */}
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Slots for {slotDate}
                    </p>
                    {isLoadingSlots ? (
                      <p className="text-xs text-muted-foreground py-2">Loading slots...</p>
                    ) : !slotsData?.items?.length ? (
                      <p className="text-xs text-muted-foreground py-2 italic">
                        No slots published for this date yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {slotsData.items.map((slot: any) => (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs font-mono"
                          >
                            <span>
                              {new Date(slot.startsAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(slot.endsAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-semibold',
                                slot.status === 'AVAILABLE'
                                  ? 'bg-success-soft text-success'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {slot.status || 'AVAILABLE'}
                            </span>
                          </div>
                        ))}
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
