import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CountUp, ease } from '../hq/ui';

export interface StatTrend {
  value: number | string;
  label?: string;
  direction?: 'up' | 'down' | 'neutral';
  positiveIsGood?: boolean;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: StatTrend;
  badge?: React.ReactNode;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

/**
 * StatCard
 * KPI metric presentation with animated values, icon squircle, trend indicator,
 * and loading skeleton states adhering to the HQMS design system.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  badge,
  loading = false,
  variant = 'default',
  onClick,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'surface relative flex flex-col justify-between overflow-hidden p-5 sm:p-6',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton h-8 w-20" />
          </div>
          <div className="skeleton size-10 rounded-2xl" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="skeleton h-4 w-16 rounded-full" />
          <div className="skeleton h-3 w-28" />
        </div>
      </div>
    );
  }

  const isNumeric = typeof value === 'number';

  // Determine trend badge styling
  let trendDirection = trend?.direction;
  if (!trendDirection && typeof trend?.value === 'number') {
    trendDirection = trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'neutral';
  }

  const positiveIsGood = trend?.positiveIsGood ?? true;
  const isPositive = trendDirection === 'up';
  const isNegative = trendDirection === 'down';

  const trendColorClass = isPositive
    ? positiveIsGood
      ? 'bg-success-soft text-success'
      : 'bg-destructive/10 text-destructive'
    : isNegative
    ? positiveIsGood
      ? 'bg-destructive/10 text-destructive'
      : 'bg-success-soft text-success'
    : 'bg-muted text-muted-foreground';

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  const iconVariantClasses = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    danger: 'bg-destructive/10 text-destructive',
  }[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'surface relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 transition-all duration-200',
        onClick && 'press cursor-pointer hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </p>

          <div className="flex items-center gap-2">
            {badge}
            {Icon && (
              <div
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-2xl shadow-xs',
                  iconVariantClasses
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-mono">
            {isNumeric ? <CountUp value={value} /> : value}
          </span>
        </div>
      </div>

      {(trend || description) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium font-mono',
                trendColorClass
              )}
            >
              <TrendIcon className="size-3" aria-hidden="true" />
              <span>{typeof trend.value === 'number' && trend.value > 0 ? `+${trend.value}` : trend.value}%</span>
            </span>
          )}
          {trend?.label && <span>{trend.label}</span>}
          {description && !trend?.label && <span className="truncate">{description}</span>}
        </div>
      )}
    </motion.div>
  );
}
