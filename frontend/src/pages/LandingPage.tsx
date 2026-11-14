import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  Radio,
  CheckCircle2,
  Clock,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Logo, Btn, ease, SwapText } from '../components/hq/ui';
import { apiClient } from '../lib/api-client';
import { M1_CONFIG } from '../config/m1-accounts';
import { useAuth } from '../lib/auth';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [tokenInput, setTokenInput] = useState('');

  // Poll live backend queue status (zero-PII, unauthenticated public view)
  const { data: publicQueue } = useQuery({
    queryKey: ['public-queue', M1_CONFIG.queueSlug],
    queryFn: () => apiClient.getPublicQueue(M1_CONFIG.queueSlug),
    refetchInterval: 5000,
  });

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      navigate(`/track?token=${encodeURIComponent(tokenInput.trim())}`);
    } else {
      navigate('/track');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="press flex items-center">
            <Logo className="text-[17px]" />
          </Link>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/track"
                  className="press inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors"
                >
                  <span>My Token & Appointments</span>
                  <ArrowRight size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="press inline-flex items-center gap-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 text-xs font-medium transition-colors cursor-pointer"
                >
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/track"
                className="press inline-flex items-center gap-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Patient sign in</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section Matching Uploaded Design */}
      <section className="relative w-full overflow-hidden bg-white min-h-[560px] sm:min-h-[620px] lg:min-h-[680px] flex items-center">
        {/* Background Image: Hospital Reception Lobby */}
        <div className="absolute inset-0 z-0">
          <img
            src="/hospital-hero.jpg"
            alt="Hospital reception lounge"
            className="w-full h-full object-cover object-center lg:object-[center_right]"
          />
          {/* Subtle gradient overlay on the left to ensure flawless typography contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 via-35% lg:via-42% to-transparent pointer-events-none" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 py-16 sm:py-24">
          <div className="max-w-xl">
            {/* Eyebrow */}
            <p className="text-xs sm:text-sm font-medium text-slate-500 tracking-normal mb-5 sm:mb-6">
              City General Hospital
            </p>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-[4.25rem] font-bold tracking-tight text-slate-950 leading-[1.06] mb-6">
              Your hospital visit.<br />
              A little calmer.
            </h1>

            {/* Sub-headline */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8 max-w-md">
              Book your appointment. Follow your queue.<br />
              We'll let you know when it's your turn.
            </p>

            {/* Primary Action Button & Guarantee */}
            <div className="flex flex-col items-start gap-4">
              <Link
                to="/track"
                className="press inline-flex items-center gap-2.5 rounded-full bg-[#0070F3] hover:bg-[#0060df] text-white px-7 py-3.5 text-sm sm:text-base font-medium shadow-sm transition-all cursor-pointer"
              >
                <span>Get started</span>
                <ArrowRight size={16} />
              </Link>

              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck size={14} className="text-slate-400" />
                <span>Your care. Your time.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Feature Highlights Directly Beneath Hero */}
      <section className="bg-white border-b border-slate-100 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
            {/* Feature 1: Plan your visit */}
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 text-[#0284c7] shrink-0">
                <Calendar className="size-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Plan your visit
                </h3>
                <p className="text-sm text-slate-500">
                  Find your doctor and choose a time.
                </p>
              </div>
            </div>

            {/* Feature 2: Wait with peace of mind */}
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 text-[#10b981] shrink-0">
                <Radio className="size-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Wait with peace of mind
                </h3>
                <p className="text-sm text-slate-500">
                  Your token and place in line, live.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Live OPD Queue & Fast Token Tracker Widget */}
      <section className="py-14 sm:py-18 bg-slate-50/70 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Quick Token Search */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-medium text-blue-700">
                <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>Live OPD Queue Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Have a token slip or appointment?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
                Enter your Token ID (e.g. <span className="font-mono font-semibold text-slate-800">M1-101</span>) or patient UHID to monitor your real-time position in line from your smartphone.
              </p>

              <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md pt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter Token ID or UHID..."
                    className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="press inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>Track Token</span>
                  <ArrowRight size={13} />
                </button>
              </form>
            </div>

            {/* Right: Live Hall Status Display */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-slate-950 p-6 sm:p-7 text-white shadow-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider font-mono">
                    Hall OPD Status
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                    {publicQueue?.roomLabel || 'Demo Room 1'}
                  </span>
                </div>

                <div className="my-6">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500 font-mono">
                    Now Serving
                  </p>
                  <p className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-white mt-1">
                    <SwapText value={publicQueue?.currentDisplayNumber || '—'} />
                  </p>
                  <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-2">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{publicQueue?.departmentName || 'General Medicine'}</span>
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>Waiting in Hall:</span>
                  <span className="font-mono font-semibold text-white">
                    {publicQueue?.waitingCount ?? 0} patients
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Patient Information & Care Support */}
      <section className="py-12 sm:py-16 bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-900">Arriving at the Clinic</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Check in at the lobby kiosks or with our hospital welcoming staff upon arrival to receive your live digital ticket.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-900">Live Status Tracking</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Keep your phone on to track your place in line live. You will receive an SMS reminder when you are 3 turns away.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-900">Assistance & Support</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Elderly care, wheelchair assistance, and multilingual support are available at the main hospital reception desk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Clean Footer */}
      <footer className="py-8 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">HQMS</span>
            <span>•</span>
            <span>City General Hospital Patient Portal</span>
          </div>

          <div className="flex items-center gap-6">
            <span>Hospital Support: 1-800-HQMS-CARE</span>
            <span>Emergency: Dial 108</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
