import React, { useState, useMemo } from 'react';
import {
  Stethoscope,
  DoorOpen,
  Calendar,
  Clock,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserX,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  EmptyState,
  AwaitingBackendBadge,
  ColumnDef,
} from '../../components/admin';
import { Btn, ease } from '../../components/hq/ui';
import { hospitalAdminService } from '../../services/hospitalAdminService';
import type { Hospital, HospitalQueue, StaffUser } from '../../services/types';
import { cn } from '../../lib/utils';

export interface DoctorAssignmentProps {
  hospital: Hospital;
  initialSelectedQueue?: HospitalQueue | null;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  onAssignmentChanged?: () => void;
}

/**
 * DoctorAssignment
 * Clinical practitioner assignment management console.
 * Links consulting doctors to rooms and queues, and features upcoming M2 schedule management preview.
 */
export const DoctorAssignment: React.FC<DoctorAssignmentProps> = ({
  hospital,
  initialSelectedQueue = null,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  onAssignmentChanged,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Assignment Modal
  const [selectedQueue, setSelectedQueue] = useState<
    (HospitalQueue & { departmentName: string }) | null
  >(
    initialSelectedQueue
      ? {
          ...initialSelectedQueue,
          departmentName:
            hospital.departments?.find((d) => d.id === initialSelectedQueue.departmentId)?.name ||
            'Specialty Wing',
        }
      : null
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const departments = hospital.departments || [];
  const doctors = useMemo(() => hospitalAdminService.getHospitalDoctors(hospital), [hospital]);

  // Flatten all queues
  const allQueues = useMemo(() => {
    const list: (HospitalQueue & { departmentName: string })[] = [];
    for (const dept of departments) {
      for (const q of dept.queues || []) {
        list.push({
          ...q,
          departmentName: dept.name,
        });
      }
    }
    return list;
  }, [departments]);

  // Filter queues
  const filteredQueues = useMemo(() => {
    return allQueues.filter((q) => {
      const docName =
        q.doctor && typeof q.doctor === 'object' && 'name' in q.doctor
          ? q.doctor.name
          : q.doctorId || '';

      const matchesSearch =
        q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.roomLabel && q.roomLabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        docName.toLowerCase().includes(searchTerm.toLowerCase());

      const hasDoctor = Boolean(q.doctorId || (q.doctor && typeof q.doctor === 'object'));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'assigned' && hasDoctor) ||
        (statusFilter === 'vacant' && !hasDoctor);

      return matchesSearch && matchesStatus;
    });
  }, [allQueues, searchTerm, statusFilter]);

  const handleOpenAssignModal = (queue: HospitalQueue & { departmentName: string }) => {
    setSelectedQueue(queue);
    setSelectedDoctorId(queue.doctorId || (queue.doctor && typeof queue.doctor === 'object' && 'id' in queue.doctor ? queue.doctor.id : '') || '');
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueue) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      const doctorToAssign = selectedDoctorId === '__CLEAR__' || !selectedDoctorId ? null : selectedDoctorId;
      await hospitalAdminService.assignDoctor(selectedQueue.id, doctorToAssign);

      setFormSuccess(
        doctorToAssign
          ? 'Physician successfully assigned to queue!'
          : 'Physician unassigned from queue.'
      );

      setTimeout(() => {
        setSelectedQueue(null);
        setFormSuccess(null);
        onAssignmentChanged?.();
        onRefresh?.();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update doctor assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<HospitalQueue & { departmentName: string }>[] = [
    {
      key: 'name',
      header: 'Queue & Consultation Room',
      render: (q) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DoorOpen className="size-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground text-sm block">
              {q.name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {q.departmentName} {q.roomLabel ? `• ${q.roomLabel}` : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Assigned Consulting Doctor',
      render: (q) => {
        const docObj =
          q.doctor && typeof q.doctor === 'object' && 'name' in q.doctor
            ? (q.doctor as { id: string; name: string; email?: string })
            : null;

        const docName = docObj?.name || (q.doctorId ? `Doctor (${q.doctorId.slice(0, 8)})` : null);
        const docEmail = docObj?.email || (q.doctorId ? `${q.doctorId}@hospital.org` : null);

        if (!docName) {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
              <ShieldAlert className="size-3" /> Vacant (No Doctor Assigned)
            </span>
          );
        }

        return (
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Stethoscope className="size-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{docName}</p>
              {docEmail && <p className="text-[10px] text-muted-foreground">{docEmail}</p>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Assignment State',
      render: (q) => {
        const isAssigned = Boolean(q.doctorId || (q.doctor && typeof q.doctor === 'object'));
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              isAssigned
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isAssigned ? 'bg-emerald-500' : 'bg-muted-foreground'
              )}
            />
            {isAssigned ? 'Consulting Active' : 'Unstaffed Room'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (q) => (
        <Btn
          variant="soft"
          size="sm"
          onClick={() => handleOpenAssignModal(q)}
          className="text-xs h-8 px-3 rounded-lg"
        >
          <Stethoscope className="size-3 mr-1" />
          {q.doctorId || q.doctor ? 'Change Doctor' : 'Assign Doctor'}
        </Btn>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        eyebrow="PHYSICIAN ALLOCATION"
        title="Doctor Assignment & Roster"
        subtitle="Pair qualified medical practitioners with active consultation rooms and manage clinical presence."
        badge={
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {doctors.length} Physicians Available
          </span>
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search rooms, queue names, or doctor names..."
        filters={[
          {
            id: 'status',
            label: 'Assignment',
            value: statusFilter,
            options: [
              { label: 'All Queues', value: 'all' },
              { label: 'Assigned Doctors', value: 'assigned' },
              { label: 'Vacant Rooms', value: 'vacant' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        onReset={() => {
          setSearchTerm('');
          setStatusFilter('all');
        }}
      />

      {/* Table of Queues and Assigned Doctors */}
      <DataTable
        columns={columns}
        data={filteredQueues}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No Queues Found"
        emptyDescription="Provision clinical queues first to assign consulting doctors."
      />

      {/* Doctor Schedules & Leave Management Section (Awaiting M2) */}
      <div className="surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Doctor Schedules & Shift Rostering
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Weekly consultation slots, appointment limits, and automated shift handovers.
            </p>
          </div>
        </div>

        {/* Mock Roster Schedule Cards Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 opacity-85 pointer-events-none select-none">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-foreground">
                  Dr. Sarah Jenkins, MD
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground">
                Mon - Fri (09:00 - 17:00)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              General Medicine • Consultation Room 101 • 15 min slot duration
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
              <Clock className="size-3" /> Max 35 patients / day • 4 bookable appointment slots
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-foreground">
                  Dr. Robert Chen, MBBS
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground">
                Tue - Sat (08:30 - 16:30)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Pediatrics Wing • Clinic Room 204 • 20 min slot duration
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
              <Clock className="size-3" /> Max 25 patients / day • 6 bookable appointment slots
            </div>
          </div>
        </div>
      </div>

      {/* Assign Doctor Modal */}
      {selectedQueue && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-doc-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="surface w-full max-w-md p-6 rounded-2xl border border-border/80 shadow-2xl bg-card space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Stethoscope className="size-4" />
                </span>
                <div>
                  <h3 id="assign-doc-title" className="text-base font-semibold text-foreground">
                    Assign Consulting Doctor
                  </h3>
                  <p className="text-[11px] text-muted-foreground">{selectedQueue.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQueue(null)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Select Consulting Physician
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                >
                  <option value="">-- Choose a doctor --</option>
                  <option value="__CLEAR__">✕ Unassign (Set room to Vacant)</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Doctors assigned here will see this queue in their Doctor Consultation Station.
                </p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                <Btn
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedQueue(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  variant="ink"
                  size="sm"
                  loading={isSubmitting}
                >
                  Confirm Assignment
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
