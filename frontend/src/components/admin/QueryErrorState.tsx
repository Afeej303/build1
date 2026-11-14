import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease } from '../hq/ui';

export interface QueryErrorStateProps {
  statusCode?: number | string;
  errorCode?: string;
  message?: string;
  error?: Error | unknown;
  title?: string;
  onRetry?: () => void | Promise<void>;
  isRetrying?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * QueryErrorState
 * Prominent error presentation displaying HTTP status code, error message,
 * structured error metadata, and a "Retry" action. Never silently swallow errors!
 */
export function QueryErrorState({
  statusCode,
  errorCode,
  message,
  error,
  title = 'Data Retrieval Failed',
  onRetry,
  isRetrying = false,
  compact = false,
  className,
}: QueryErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract message from error object if not explicitly provided
  const errorMessage =
    message ||
    (error instanceof Error ? error.message : null) ||
    'An unexpected system error occurred while retrieving clinical administration records.';

  // Determine status code if available
  const resolvedStatus: string | number | undefined =
    statusCode !== undefined
      ? statusCode
      : error && typeof error === 'object' && 'status' in error && (typeof (error as Record<string, unknown>).status === 'number' || typeof (error as Record<string, unknown>).status === 'string')
      ? ((error as Record<string, unknown>).status as string | number)
      : undefined;

  // Build diagnostic string
  const diagnosticDump = JSON.stringify(
    {
      statusCode: resolvedStatus,
      errorCode,
      message: errorMessage,
      rawError: error instanceof Error ? { name: error.name, stack: error.stack } : error,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  );

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticDump);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-2.5 text-xs text-foreground',
          className
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="font-semibold text-destructive">
            {resolvedStatus ? `Error ${resolvedStatus}:` : 'Error:'}
          </span>
          <span className="truncate text-muted-foreground">{errorMessage}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3', isRetrying && 'animate-spin')} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className={cn(
        'surface relative overflow-hidden rounded-2xl border border-destructive/25 bg-card p-5 sm:p-6 shadow-sm',
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive shadow-xs">
            <AlertCircle className="size-5" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {title}
              </h3>
              {resolvedStatus && (
                <span className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-destructive">
                  HTTP {resolvedStatus}
                </span>
              )}
              {errorCode && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                  {errorCode}
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {errorMessage}
            </p>
          </div>
        </div>

        {onRetry && (
          <div className="flex shrink-0 items-center gap-2 sm:self-center">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="press inline-flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-4 py-2 text-xs font-medium shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3.5', isRetrying && 'animate-spin')} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Request'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Diagnostics Toggle */}
      <div className="mt-4 border-t border-border/70 pt-3">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
        >
          <span>Diagnostic Details</span>
          {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="mt-2.5 rounded-xl border border-border/80 bg-muted/50 p-3"
          >
            <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-muted-foreground border-b border-border/50">
              <span>Stack / Payload Trace</span>
              <button
                type="button"
                onClick={handleCopyDiagnostics}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy error trace to clipboard"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                <span>{copied ? 'Copied' : 'Copy Trace'}</span>
              </button>
            </div>
            <pre className="mt-2 max-h-48 overflow-auto font-mono text-[11px] leading-relaxed text-foreground select-all">
              {diagnosticDump}
            </pre>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
