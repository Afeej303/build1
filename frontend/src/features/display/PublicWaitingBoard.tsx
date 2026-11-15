import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  Building2,
  ShieldCheck,
  Tv,
  ArrowLeft,
} from 'lucide-react';
import { Logo, SwapText, ease } from '../../components/hq/ui';
import { apiClient } from '../../lib/api-client';
import { PublicQueueStatus } from '../../types/contract';
import { cn } from '../../lib/utils';
import { M1_CONFIG } from '../../config/m1-accounts';

function LiveClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const interval = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="mono tabular-nums text-xl font-medium tracking-tight">
      {t
        ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '--:--:--'}
    </span>
  );
}

export const PublicWaitingBoard: React.FC = () => {
  const { roomId, publicQueueId: paramQueueId } = useParams<{
    roomId?: string;
    publicQueueId?: string;
  }>();
  const navigate = useNavigate();

  // Resolve target public queue ID (defaults to live backend demo queue)
  const defaultPublicQueueId = M1_CONFIG.queueSlug;
  const targetQueueId =
    paramQueueId || (roomId && roomId !== 'room2' ? roomId : defaultPublicQueueId);

  const [flash, setFlash] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevTokenRef = useRef<string | null>(null);

  // Poll live public queue status every 5 seconds (zero-PII, unauthenticated)
  const { data: queueStatus, isLoading } = useQuery<PublicQueueStatus>({
    queryKey: ['public-queue', targetQueueId],
    queryFn: () => apiClient.getPublicQueue(targetQueueId),
    refetchInterval: 5000,
  });

  const currentDisplayNumber = queueStatus?.currentDisplayNumber || null;

  // Trigger chime and pulse animation when active token changes
  useEffect(() => {
    if (!currentDisplayNumber) {
      prevTokenRef.current = null;
      return;
    }

    if (prevTokenRef.current && prevTokenRef.current !== currentDisplayNumber) {
      // New token called!
      setFlash(true);

      if (audioEnabled) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
          osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.18); // A5
          gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.7);
        } catch {
          // AudioContext policy handled
        }

        // EXT-01: Web Speech API Voice Announcement (zero-PII, room-targeted)
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const destination = queueStatus?.roomLabel || 'Consultation Room';
            const text = `Token ${currentDisplayNumber}, please proceed to ${destination}`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.92;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            setTimeout(() => {
              window.speechSynthesis.speak(utterance);
            }, 750);
          } catch {
            // SpeechSynthesis policy handled
          }
        }
      }

      const timer = setTimeout(() => setFlash(false), 3000);
      return () => clearTimeout(timer);
    }

    prevTokenRef.current = currentDisplayNumber;
  }, [currentDisplayNumber, audioEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink text-ink-foreground select-none overflow-hidden font-sans">
      {/* TV Screen Header */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-10 border-b border-ink-foreground/10 bg-ink-foreground/[0.02]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-mono opacity-60 hover:opacity-100 transition-opacity cursor-pointer mr-2"
            title="Back to Landing Page"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Landing</span>
          </button>
          <Logo className="text-lg" />
          <span className="hidden sm:inline-block h-4 w-px bg-ink-foreground/20" />
          <span className="hidden sm:inline-block text-sm opacity-70 tracking-wide font-medium">
            City General Hospital
          </span>
        </div>

        {/* Room / Clinic Indicator */}
        <div className="text-center">
          <span className="text-[11px] uppercase tracking-widest text-primary font-mono font-semibold">
            Waiting Hall Signage
          </span>
          <h2 className="text-base font-semibold">
            {queueStatus?.departmentName || 'General Medicine'} •{' '}
            {queueStatus?.roomLabel || 'Room 101'}
          </h2>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center gap-4">
          <LiveClock />
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-lg bg-ink-foreground/5 hover:bg-ink-foreground/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
            title={audioEnabled ? 'Mute announcement chime' : 'Enable announcement chime'}
          >
            {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-ink-foreground/5 hover:bg-ink-foreground/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main Fullscreen Display Stage */}
      <main className="grid flex-1 gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1.5fr_1fr] lg:py-12">
        {/* Active Token Callout Box */}
        <section
          className={cn(
            'relative flex flex-col justify-between overflow-hidden rounded-[36px] p-8 sm:p-14 transition-colors duration-700 shadow-2xl border',
            flash
              ? 'bg-primary border-primary text-white shadow-primary/30'
              : 'bg-ink-foreground/[0.05] border-ink-foreground/10'
          )}
        >
          <div className="flex items-center justify-between text-base opacity-80">
            <span className="uppercase tracking-widest font-mono text-xs font-semibold">
              Now Serving In Consultation
            </span>
            <span className="font-semibold text-sm px-3.5 py-1 rounded-full bg-ink-foreground/10 font-mono">
              {queueStatus?.roomLabel || 'Room 101'}
            </span>
          </div>

          <div className="py-10 text-center sm:text-left">
            <AnimatePresence mode="popLayout">
              <motion.p
                key={currentDisplayNumber || 'none'}
                initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -50, filter: 'blur(10px)' }}
                transition={{ duration: 0.5, ease }}
                className="mono whitespace-nowrap text-[clamp(5rem,14vw,13rem)] font-bold leading-none tracking-tight text-white"
              >
                {currentDisplayNumber || '—'}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence>
              {flash && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 flex items-center gap-3 text-2xl font-semibold text-white"
                >
                  <Volume2 className="size-8 animate-bounce" />
                  <span>
                    Token {currentDisplayNumber} — Please proceed to{' '}
                    {queueStatus?.roomLabel || 'Room 101'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-ink-foreground/10 text-sm opacity-80 font-mono">
            <div className="flex items-center gap-2.5">
              <span className="pulse-dot size-2.5 rounded-full bg-success" />
              <span className="font-medium">
                {queueStatus?.departmentName || 'General Medicine'}
              </span>
              <span>•</span>
              <span className="text-primary font-semibold">Active Session</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="text-success" />
              <span>Zero-PII Public Channel</span>
            </div>
          </div>
        </section>

        {/* Up Next & Hall Metrics */}
        <section className="flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="rounded-[28px] bg-ink-foreground/[0.04] border border-ink-foreground/10 p-8">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground font-semibold">
                Waiting Hall Status
              </p>
              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="mono text-6xl font-bold tracking-tight text-white">
                    {queueStatus?.waitingCount ?? 0}
                  </span>
                  <span className="ml-3 text-sm text-muted-foreground font-medium">
                    Patients Waiting
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-foreground/10 pt-5 text-xs font-mono">
                <div>
                  <p className="text-muted-foreground">Est. Waiting Time</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {queueStatus?.estimatedWaitMinutes
                      ? `~${queueStatus.estimatedWaitMinutes} min`
                      : '~6 min per patient'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Display Sync</p>
                  <p className="mt-1 text-base font-semibold text-success flex items-center gap-1.5">
                    <span className="pulse-dot size-1.5 rounded-full bg-success" />
                    Live 5s Polling
                  </p>
                </div>
              </div>
            </div>

            {/* Instruction Card */}
            <div className="rounded-[24px] bg-ink-foreground/[0.02] border border-ink-foreground/5 p-6 text-xs text-muted-foreground space-y-3 font-mono">
              <p className="font-semibold text-white flex items-center gap-2">
                <Tv size={15} className="text-primary" />
                <span>Patient Waiting Instructions</span>
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Please keep your 80mm thermal slip or mobile token ready.</li>
                <li>When your number appears, proceed immediately to the assigned room.</li>
                <li>If you missed your call, please check in at the reception counter.</li>
              </ul>
            </div>
          </div>

          {/* Privacy Notice */}
          <footer className="pt-4 text-center text-xs opacity-50 font-mono">
            Automated TV Signage • Token numbers announced aloud • Privacy Protected
          </footer>
        </section>
      </main>
    </div>
  );
};
