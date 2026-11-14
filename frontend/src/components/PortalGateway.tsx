import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, User, ClipboardList, Stethoscope, MonitorPlay } from 'lucide-react';
import { Header, ease, SwapText } from './hq/ui';
import { useHQ, servingOf, waitingOf } from '../lib/hqms';

const entries = [
  {
    to: '/intake',
    icon: ClipboardList,
    title: 'Reception',
    sub: 'Look up patients, issue walk-in tokens and print slips.',
    badge: 'Desktop',
  },
  {
    to: '/consultation',
    icon: Stethoscope,
    title: 'Doctor',
    sub: 'Call next patient and complete consultations.',
    badge: 'Desktop',
  },
  {
    to: '/track',
    icon: User,
    title: 'Patient',
    sub: 'Register, book visits and track your token live.',
    badge: 'Mobile / Responsive',
  },
  {
    to: '/display/room2',
    icon: MonitorPlay,
    title: 'Public Display',
    sub: 'Full-screen high-contrast queue for waiting halls.',
    badge: '1080p Signage',
  },
] as const;

export const PortalGateway: React.FC = () => {
  const s = useHQ();
  const serving = servingOf(s, 'gm');
  const waiting = waitingOf(s, 'gm');

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-accent-foreground flex flex-col justify-between">
      {/* Pristine Clean Header matching other UIs */}
      <Header
        title="Hospital Queue System"
        subtitle="City General Hospital"
        right={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span className="pulse-dot size-1.5 rounded-full bg-success" />
            Clinical System Live
          </span>
        }
      />

      {/* Main Hero & Live Status Section */}
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <section className="grid items-end gap-10 pb-12 pt-6 sm:pt-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground"
            >
              <span className="pulse-dot size-1.5 rounded-full bg-success" />
              City General Hospital • OPD Queues Live
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl"
            >
              Queues,<br />
              <span className="text-muted-foreground font-normal">quietly handled.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease }}
              className="mt-6 max-w-md text-base sm:text-lg text-muted-foreground leading-relaxed"
            >
              One unified real-time queue engine for patients, reception desks, doctors, and waiting room displays.
            </motion.p>
          </div>

          {/* Live High-Contrast OPD Snapshot Card */}
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="rounded-[28px] bg-ink p-7 text-ink-foreground shadow-lift"
          >
            <div className="flex items-center justify-between text-xs opacity-70">
              <span className="font-medium">General Medicine</span>
              <span className="font-mono">Room 2</span>
            </div>

            <p className="mt-8 text-[12px] uppercase tracking-[0.1em] opacity-50 font-mono">
              Now Serving
            </p>
            <p className="mono mt-1 text-6xl font-semibold tracking-tight text-white">
              <SwapText value={serving?.code ?? '—'} />
            </p>

            <div className="mt-8 flex items-center justify-between border-t border-ink-foreground/10 pt-4 text-xs">
              <span className="opacity-60">Up Next in Hall</span>
              <span className="mono font-semibold text-white">
                {waiting.slice(0, 3).map((t) => t.code).join('   ·   ') || 'No patients waiting'}
              </span>
            </div>
          </motion.div>
        </section>

        {/* 4 Dedicated Entry Cards */}
        <section className="grid gap-4 pt-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map((e, i) => (
            <motion.div
              key={e.to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.06, ease }}
            >
              <Link
                to={e.to}
                className="surface press group flex h-full flex-col justify-between p-6 transition-all duration-200 hover:shadow-lift hover:border-primary/50"
              >
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="size-10 rounded-xl bg-muted flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <e.icon className="size-5" strokeWidth={1.75} />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold tracking-tight">{e.title}</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {e.badge}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {e.sub}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-primary group-hover:underline">
                  <span>{e.to}</span>
                  <span>Enter &rarr;</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </section>
      </main>

      {/* Clean Footer matching system */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground font-mono">
        City General Hospital • HQMS Workstation Portal • Isolated Endpoints
      </footer>
    </div>
  );
};
