import React from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Eyebrow } from '../hq/ui';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader
 * Unified header for administrative pages featuring title, subtitle,
 * metadata eyebrow, quick refresh with spinner, and action button slot.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  onRefresh,
  isRefreshing = false,
  breadcrumbs,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3 pb-6 border-b border-border/70', className)}>
      {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          {eyebrow && <Eyebrow className="mb-1 text-[11px]">{eyebrow}</Eyebrow>}

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {badge}
          </div>

          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {onRefresh && (
            <button
              type="button"
              disabled={isRefreshing}
              onClick={onRefresh}
              aria-label="Refresh page data"
              className="press inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <RotateCcw className={cn('size-4', isRefreshing && 'animate-spin text-primary')} />
            </button>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}
