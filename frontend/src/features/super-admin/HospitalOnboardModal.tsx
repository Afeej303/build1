import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, X, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease, Btn } from '../../components/hq/ui';
import { superAdminService } from '../../services/superAdminService';
import type { Hospital } from '../../services/types';

export interface HospitalOnboardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (hospital: Hospital) => void;
}

/**
 * HospitalOnboardModal
 * Modal dialog for provisioning a new hospital tenant.
 * Uses superAdminService.createHospital(name).
 * Strictly enforces security: No administrator password generation or bundling!
 */
export function HospitalOnboardModal({
  open,
  onClose,
  onSuccess,
}: HospitalOnboardModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form and focus on open
  useEffect(() => {
    if (open) {
      setName('');
      setAddress('');
      setContactEmail('');
      setContactPhone('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Hospital name is required.');
      inputRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const newHospital = await superAdminService.createHospital(trimmed);
      onSuccess?.(newHospital);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to onboard hospital. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => {
              if (!submitting) onClose();
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease }}
            className="surface glass relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2
                    id="onboard-modal-title"
                    className="text-lg sm:text-xl font-semibold tracking-tight text-foreground"
                  >
                    Onboard New Hospital
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Register a new multi-tenant healthcare facility to the platform.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="press rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {/* Hospital Name */}
              <div>
                <label
                  htmlFor="hospital-name-input"
                  className="block text-xs font-medium text-foreground mb-1.5"
                >
                  Hospital Name <span className="text-destructive">*</span>
                </label>
                <input
                  ref={inputRef}
                  id="hospital-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., St. Jude Metropolitan Medical Center"
                  disabled={submitting}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              {/* Optional Contact & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="contact-email-input"
                    className="block text-xs font-medium text-foreground mb-1.5"
                  >
                    Administrative Contact Email
                  </label>
                  <input
                    id="contact-email-input"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="director@hospital.org"
                    disabled={submitting}
                    className="h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-phone-input"
                    className="block text-xs font-medium text-foreground mb-1.5"
                  >
                    Contact Phone
                  </label>
                  <input
                    id="contact-phone-input"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    disabled={submitting}
                    className="h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="address-input"
                  className="block text-xs font-medium text-foreground mb-1.5"
                >
                  Campus / Physical Address
                </label>
                <input
                  id="address-input"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 100 Medical Parkway, Suite 400"
                  disabled={submitting}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <Btn
                  type="button"
                  variant="soft"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  variant="primary"
                  loading={submitting}
                >
                  Register Hospital
                </Btn>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
