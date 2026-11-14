import React from 'react';
import { motion } from 'motion/react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease } from '../hq/ui';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
  borderDashed?: boolean;
}

/**
 * EmptyState
 * Centered empty visual with icon, title, description, and optional primary action button.
 * Uses soft HQMS Apple-grade design language and entrance motion.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
  borderDashed = true,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className={cn(
        'flex flex-col items-center justify-center text-center transition-all',
        borderDashed
          ? 'rounded-2xl border border-dashed border-border/80 bg-card/40'
          : 'surface',
        compact ? 'px-4 py-8' : 'px-6 py-14 sm:py-20',
        className
      )}
    >
      <div className="relative mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground shadow-xs">
        <Icon className="size-6 stroke-[1.6]" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {title}
      </h3>

      {description && (
        <div className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </div>
      )}

      {action && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      )}
    </motion.div>
  );
}
