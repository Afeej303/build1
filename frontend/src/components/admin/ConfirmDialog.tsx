import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, AlertCircle, Info, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease } from '../hq/ui';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * ConfirmDialog
 * Accessible modal dialog for dangerous or irreversible administrative actions
 * (e.g., deactivating a queue, revoking staff assignments, deleting records).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  icon: CustomIcon,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, onClose]);

  // Focus confirm button when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  const Icon = CustomIcon || (variant === 'danger' ? AlertTriangle : variant === 'warning' ? AlertCircle : Info);

  const variantStyles = {
    danger: {
      iconBg: 'bg-destructive/10 text-destructive',
      button: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
    },
    warning: {
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      button: 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500',
    },
    primary: {
      iconBg: 'bg-primary/10 text-primary',
      button: 'bg-primary text-primary-foreground hover:brightness-110 focus-visible:ring-primary',
    },
  }[variant];

  return (
    <AnimatePresence>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => !isLoading && onClose()}
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease }}
            className="surface glass relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border p-6 shadow-2xl"
          >
            {/* Close Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-2xl shadow-xs',
                  variantStyles.iconBg
                )}
              >
                <Icon className="size-5.5" aria-hidden="true" />
              </div>

              <div className="space-y-1.5 pt-0.5">
                <h3
                  id="confirm-dialog-title"
                  className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                >
                  {title}
                </h3>
                <div
                  id="confirm-dialog-description"
                  className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
                >
                  {description}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={onClose}
                className="press inline-flex h-9 sm:h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs sm:text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                disabled={isLoading}
                onClick={onConfirm}
                className={cn(
                  'press inline-flex h-9 sm:h-10 items-center justify-center gap-2 rounded-full px-5 text-xs sm:text-sm font-medium shadow-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
                  variantStyles.button
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
