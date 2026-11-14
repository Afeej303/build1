import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Sparkles, ExternalLink, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease } from '../hq/ui';

export interface AwaitingBackendBadgeProps {
  endpoint?: string;
  featureName?: string;
  milestone?: string;
  variant?: 'pill' | 'banner' | 'chip';
  className?: string;
  details?: string;
}

/**
 * AwaitingBackendBadge
 * Clean pill/banner marking administrative workflows awaiting M2's backend endpoints
 * with an informative tooltip explaining that it is intentionally pending M2's API delivery.
 */
export function AwaitingBackendBadge({
  endpoint,
  featureName,
  milestone = 'M2',
  variant = 'pill',
  className,
  details,
}: AwaitingBackendBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const defaultDetails = details || (
    endpoint
      ? `This administrative interface is complete and validated. It will automatically connect to ${endpoint} upon deployment of the ${milestone} backend service.`
      : `This workflow is built to contract specifications and is staged to integrate with upcoming ${milestone} backend endpoints.`
  );

  if (variant === 'banner') {
    return (
      <div
        role="status"
        aria-label={`Awaiting ${milestone} backend endpoint`}
        className={cn(
          'surface relative flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 text-sm text-foreground shadow-sm dark:border-amber-400/20 dark:bg-amber-400/[0.03]',
          className
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Clock className="size-4 animate-pulse" />
        </span>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {featureName || 'Administration Feature'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Pending {milestone} API
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{defaultDetails}</p>
          {endpoint && (
            <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Target Endpoint: <code className="font-semibold text-foreground">{endpoint}</code>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={`Pending ${milestone} Backend: ${endpoint || 'Contract Staged'}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 transition-colors duration-200 hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-300 dark:border-amber-400/25',
          variant === 'chip' && 'text-[10px] px-2 py-0.5'
        )}
      >
        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-mono tracking-tight font-semibold">{milestone}</span>
        <span className="opacity-80">Pending API</span>
      </button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease }}
            className="surface glass absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border p-3 text-left shadow-xl"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Awaiting Backend Delivery</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {defaultDetails}
            </p>
            {endpoint && (
              <div className="mt-2 rounded bg-muted/80 px-2 py-1 font-mono text-[10px] text-foreground border border-border/70 truncate">
                {endpoint}
              </div>
            )}
            <div className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
