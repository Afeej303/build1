import React, { useState, useMemo } from 'react';
import {
  ListOrdered,
  Plus,
  Stethoscope,
  Tv,
  ExternalLink,
  Copy,
  Check,
  DoorOpen,
  Users,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  EmptyState,
  DetailDrawer,
  AwaitingBackendBadge,
  ColumnDef,
} from '../../components/admin';
import { Btn, Field, ease } from '../../components/hq/ui';
import { hospitalAdminService } from '../../services/hospitalAdminService';
import type { Hospital, HospitalQueue, Department } from '../../services/types';
import { cn } from '../../lib/utils';

export interface QueueRoomManagerProps {
  hospital: Hospital;
  selectedDepartmentId?: string;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  onQueueCreated?: () => void;
  onOpenAssignDoctor?: (queue: HospitalQueue) => void;
}

/**
 * QueueRoomManager
 * Administrative console for provisioning clinical queues, consultation rooms,
 * TV signage display slugs, and walk-in routing.
 */
export const QueueRoomManager: React.FC<QueueRoomManagerProps> = ({
  hospital,
  selectedDepartmentId,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  onQueueCreated,
  onOpenAssignDoctor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>(selectedDepartmentId || 'all');
  const [walkInFilter, setWalkInFilter] = useState<string>('all');

  // Provision Modal State
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState<string>(
    selectedDepartmentId || hospital.departments?.[0]?.id || ''
  );
  const [newQueueName, setNewQueueName] = useState('');
  const [newRoomLabel, setNewRoomLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Copy indicator for display slugs
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Selected queue for detail drawer
  const [selectedQueue, setSelectedQueue] = useState<HospitalQueue | null>(null);

  const departments = hospital.departments || [];

  // Flatten all queues with their department context
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
      const matchesSearch =
        q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.roomLabel && q.roomLabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        q.publicQueueId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.departmentName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = deptFilter === 'all' || q.departmentId === deptFilter;
      const matchesWalkIn =
        walkInFilter === 'all' ||
        (walkInFilter === 'accepting' && q.acceptingWalkIns) ||
        (walkInFilter === 'appointment_only' && !q.acceptingWalkIns);

      return matchesSearch && matchesDept && matchesWalkIn;
    });
  }, [allQueues, searchTerm, deptFilter, walkInFilter]);

  const handleCopySlug = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(slug);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleProvisionQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId) {
      setFormError('Please select a department to provision this queue under.');
      return;
    }
    if (!newQueueName.trim()) {
      setFormError('Queue name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await hospitalAdminService.createQueue(
        targetDeptId,
        newQueueName.trim(),
        newRoomLabel.trim() || undefined
      );
      setFormSuccess(`Queue "${newQueueName.trim()}" provisioned successfully!`);
      setNewQueueName('');
      setNewRoomLabel('');
      setTimeout(() => {
        setIsProvisionModalOpen(false);
        setFormSuccess(null);
        onQueueCreated?.();
        onRefresh?.();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to provision queue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<HospitalQueue & { departmentName: string }>[] = [
    {
      key: 'name',
      header: 'Clinical Queue / Consultation Room',
      render: (q) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ListOrdered className="size-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground text-sm block">
              {q.name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Wing: {q.departmentName}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'roomLabel',
      header: 'Room Label',
      render: (q) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground">
            <DoorOpen className="size-3 text-muted-foreground" />
            {q.roomLabel || 'Room TBD'}
          </span>
        </div>
      ),
    },
    {
      key: 'publicQueueId',
      header: 'Public TV Signage Slug',
      render: (q) => {
        const slug = q.publicQueueId || q.id;
        const isCopied = copiedSlug === slug;
        return (
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-muted/80 px-2 py-0.5 rounded text-foreground">
              {slug}
            </code>
            <button
              type="button"
              onClick={(e) => handleCopySlug(slug, e)}
              title="Copy TV Signage Slug"
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            >
              {isCopied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
            <a
              href={`/display?queue=${encodeURIComponent(slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Test TV Display Board in New Tab"
              className="p-1 text-primary hover:text-primary/80 rounded transition-colors"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        );
      },
    },
    {
      key: 'doctor',
      header: 'Consulting Doctor',
      render: (q) => {
        const doctorName =
          q.doctor && typeof q.doctor === 'object' && 'name' in q.doctor
            ? q.doctor.name
            : q.doctorId
            ? `Doctor (${q.doctorId.slice(0, 8)})`
            : null;

        return doctorName ? (
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Stethoscope className="size-3" />
            </div>
            <span className="text-xs font-medium text-foreground">{doctorName}</span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <ShieldAlert className="size-3" /> Unassigned
          </span>
        );
      },
    },
    {
      key: 'walkIn',
      header: 'Intake Policy',
      render: (q) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
            q.acceptingWalkIns
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              q.acceptingWalkIns ? 'bg-emerald-500' : 'bg-muted-foreground'
            )}
          />
          {q.acceptingWalkIns ? 'Walk-Ins Allowed' : 'Appointments Only'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (q) => (
        <div className="flex items-center justify-end gap-2">
          {onOpenAssignDoctor && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAssignDoctor(q);
              }}
              className="text-xs h-8 px-2.5 rounded-lg text-primary"
            >
              Assign Doctor
            </Btn>
          )}
          <a
            href={`/display?queue=${encodeURIComponent(q.publicQueueId || q.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs h-8 px-2.5 rounded-lg bg-muted text-foreground hover:bg-border/70 transition-colors font-medium"
          >
            <Tv className="size-3" />
            Test Signage
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        eyebrow="CLINICAL QUEUES & ROOMS"
        title="Consultation Rooms & Queues"
        subtitle={`Configure physical rooms, signage display slugs, walk-in reception policies, and doctor allocation.`}
        badge={
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {allQueues.length} Total Rooms
          </span>
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={
          <Btn
            variant="ink"
            size="sm"
            onClick={() => {
              if (departments.length === 0) {
                alert('Please add a department first before provisioning a queue.');
                return;
              }
              setIsProvisionModalOpen(true);
            }}
            className="rounded-xl font-medium shadow-xs"
          >
            <Plus className="size-3.5" />
            Provision New Queue
          </Btn>
        }
      />

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search rooms, queue names, doctors, or slugs..."
        filters={[
          {
            id: 'department',
            label: 'Department',
            value: deptFilter,
            options: [
              { label: 'All Departments', value: 'all' },
              ...departments.map((d) => ({ label: d.name, value: d.id })),
            ],
            onChange: setDeptFilter,
          },
          {
            id: 'walkIn',
            label: 'Walk-In Mode',
            value: walkInFilter,
            options: [
              { label: 'All Modes', value: 'all' },
              { label: 'Accepting Walk-Ins', value: 'accepting' },
              { label: 'Appointments Only', value: 'appointment_only' },
            ],
            onChange: setWalkInFilter,
          },
        ]}
        onReset={() => {
          setSearchTerm('');
          setDeptFilter('all');
          setWalkInFilter('all');
        }}
      />

      {/* Queues DataTable */}
      <DataTable
        columns={columns}
        data={filteredQueues}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onRowClick={(q) => setSelectedQueue(q)}
        emptyTitle="No Clinical Queues Provisioned"
        emptyDescription="Consultation rooms must be provisioned under a specialty department to receive patients."
        emptyAction={
          <Btn
            size="sm"
            onClick={() => setIsProvisionModalOpen(true)}
            className="rounded-xl"
          >
            <Plus className="size-3.5" />
            Provision New Queue
          </Btn>
        }
      />

      {/* Provision New Queue Modal */}
      {isProvisionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="provision-queue-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="surface w-full max-w-md p-6 rounded-2xl border border-border/80 shadow-2xl bg-card space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ListOrdered className="size-4" />
                </span>
                <h3 id="provision-queue-title" className="text-base font-semibold text-foreground">
                  Provision New Queue & Room
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvisionQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Specialty Department <span className="text-destructive">*</span>
                </label>
                <select
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value)}
                  required
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>
                    Select a department
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Queue Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. General Consultation Room 1"
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  required
                  autoFocus
                  className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Physical Room Label / Door Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 102, Wing B - Clinic 4"
                  value={newRoomLabel}
                  onChange={(e) => setNewRoomLabel(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Appears on patient tickets, mobile tracker, and public TV signage.
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
                  onClick={() => setIsProvisionModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  variant="ink"
                  size="sm"
                  loading={isSubmitting}
                  disabled={!newQueueName.trim() || !targetDeptId}
                >
                  Provision Queue
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Queue Detail Drawer */}
      <DetailDrawer
        open={Boolean(selectedQueue)}
        onClose={() => setSelectedQueue(null)}
        title={selectedQueue?.name || 'Queue Details'}
        subtitle={`Room: ${selectedQueue?.roomLabel || 'Unspecified'} | ID: ${selectedQueue?.id || ''}`}
        badge={
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {selectedQueue?.acceptingWalkIns ? 'Walk-Ins Active' : 'Appointments Only'}
          </span>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Btn
              variant="soft"
              size="sm"
              onClick={() => setSelectedQueue(null)}
            >
              Close
            </Btn>
            {selectedQueue && onOpenAssignDoctor && (
              <Btn
                variant="ink"
                size="sm"
                onClick={() => {
                  const q = selectedQueue;
                  setSelectedQueue(null);
                  onOpenAssignDoctor(q);
                }}
              >
                Change Consulting Doctor
              </Btn>
            )}
          </div>
        }
      >
        {selectedQueue && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Public Display Information
              </h4>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">TV Signage Slug:</span>
                  <code className="text-xs font-mono font-semibold text-foreground">
                    {selectedQueue.publicQueueId}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Signage Test URL:</span>
                  <a
                    href={`/display?queue=${encodeURIComponent(selectedQueue.publicQueueId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    Open Live Signage <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Physician Allocation
              </h4>
              <p className="text-xs text-muted-foreground">
                {selectedQueue.doctor && typeof selectedQueue.doctor === 'object' && 'name' in selectedQueue.doctor
                  ? `Assigned to ${selectedQueue.doctor.name}`
                  : selectedQueue.doctorId
                  ? `Assigned Doctor ID: ${selectedQueue.doctorId}`
                  : 'Currently vacant — unassigned consultation room.'}
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
