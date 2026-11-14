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
  title,
  onRetry,
  isRetrying = false,
  compact = false,
  className,
}: QueryErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1. Detect Network / CORS connection failures
  const isNetworkFailure = Boolean(
    (error as any)?.isNetworkError ||
      (error as any)?.category === 'NETWORK' ||
      (error as any)?.code === 'BACKEND_CONNECTION_ERROR' ||
      (error instanceof TypeError &&
        (error.message.includes('fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch')))
  );

  // 2. Resolve HTTP status code (Strict Requirement: Never invent HTTP status codes for network failures!)
  const resolvedStatus: string | number | undefined = isNetworkFailure
    ? undefined
    : statusCode !== undefined
    ? statusCode
    : error &&
      typeof error === 'object' &&
      'status' in error &&
      (typeof (error as Record<string, unknown>).status === 'number' ||
        typeof (error as Record<string, unknown>).status === 'string')
    ? ((error as Record<string, unknown>).status as string | number)
    : undefined;

  // 3. Resolve error code
  const resolvedCode: string | undefined =
    errorCode ||
    (isNetworkFailure
      ? 'BACKEND_CONNECTION_ERROR'
      : resolvedStatus === 401
      ? 'UNAUTHORIZED'
      : resolvedStatus === 403
      ? 'FORBIDDEN'
      : resolvedStatus === 404
      ? 'NOT_FOUND'
      : typeof resolvedStatus === 'number' && resolvedStatus >= 500
      ? 'INTERNAL_SERVER_ERROR'
      : (error as any)?.code);

  // 4. Resolve Title
  const resolvedTitle =
    title ||
    (isNetworkFailure
      ? 'Backend Connectivity Error'
      : resolvedStatus === 401
      ? 'Authentication Required'
      : resolvedStatus === 403
      ? 'Permission Denied'
      : resolvedStatus === 404
      ? 'Resource Not Found'
      : typeof resolvedStatus === 'number' && resolvedStatus >= 500
      ? 'Backend Server Error'
      : 'Data Retrieval Failed');

  // 5. Resolve Human-Readable Message
  const errorMessage =
    message ||
    (isNetworkFailure
      ? 'Unable to communicate with the healthcare service. Please check your network connection and verify that the healthcare server is online.'
      : resolvedStatus === 401
      ? 'Your session has expired or authentication credentials are invalid. Please re-authenticate.'
      : resolvedStatus === 403
      ? 'You do not have the required clinical or administrative permissions for this operation.'
      : resolvedStatus === 404
      ? 'The requested clinical resource, queue, or hospital facility was not found.'
      : (error instanceof Error ? error.message : null) ||
        'An unexpected system error occurred while retrieving clinical administration records.');

  // 6. Strict Security Sanitization: Never expose access tokens, JWTs, or secrets in diagnostic traces!
  const sanitizeDiagnostics = (data: any): any => {
    if (typeof data === 'string') {
      return data
        .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/(api[_-]?key|secret|password|token|jwt|credential)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, '$1: "[REDACTED]"');
    }
    if (Array.isArray(data)) {
      return data.map(sanitizeDiagnostics);
    }
    if (data && typeof data === 'object') {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (/token|secret|password|key|auth|jwt|credential/i.test(k) && typeof v === 'string') {
          clean[k] = '[REDACTED]';
        } else {
          clean[k] = sanitizeDiagnostics(v);
        }
      }
      return clean;
    }
    return data;
  };

  const rawTrace = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
  const diagnosticDump = JSON.stringify(
    sanitizeDiagnostics({
      classification: isNetworkFailure ? 'NETWORK_CORS_FAILURE' : 'HTTP_API_ERROR',
      statusCode: resolvedStatus,
      errorCode: resolvedCode,
      message: errorMessage,
      rawError: rawTrace,
      timestamp: new Date().toISOString(),
    }),
    null,
    2
  );

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticDump);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-2.5 text-xs text-foreground',
          isNetworkFailure && 'border-amber-500/30 bg-amber-500/[0.06]',
          className
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <AlertCircle
            className={cn('size-4 shrink-0 text-destructive', isNetworkFailure && 'text-amber-600 dark:text-amber-400')}
          />
          <span
            className={cn('font-semibold text-destructive', isNetworkFailure && 'text-amber-600 dark:text-amber-400')}
          >
            {isNetworkFailure ? 'Connection Offline:' : resolvedStatus ? `Error ${resolvedStatus}:` : 'Error:'}
          </span>
          <span className="truncate text-muted-foreground">{errorMessage}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
        isNetworkFailure && 'border-amber-500/30',
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive shadow-xs',
              isNetworkFailure && 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            )}
          >
            <AlertCircle className="size-5" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {resolvedTitle}
              </h3>
              {isNetworkFailure && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  CONNECTION OFFLINE
                </span>
              )}
              {resolvedStatus && (
                <span className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-destructive">
                  HTTP {resolvedStatus}
                </span>
              )}
              {resolvedCode && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                  {resolvedCode}
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
              className={cn(
                'press inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                isNetworkFailure
                  ? 'bg-amber-600 text-white dark:bg-amber-500'
                  : 'bg-destructive text-destructive-foreground'
              )}
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
              <span>Diagnostic Trace</span>
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
