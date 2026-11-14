import React, { useState, useMemo } from 'react';
import {
  Network,
  Plus,
  ListOrdered,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  Stethoscope,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
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
import type { Hospital, Department, HospitalQueue } from '../../services/types';
import { cn } from '../../lib/utils';

export interface DepartmentManagerProps {
  hospital: Hospital;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  onNavigateToQueues: (departmentId?: string) => void;
  onDepartmentCreated?: () => void;
}

/**
 * DepartmentManager
 * Management interface for hospital clinical specialty units and wings.
 * Handles department creation, room counts, and queue breakdowns.
 */
export const DepartmentManager: React.FC<DepartmentManagerProps> = ({
  hospital,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  onNavigateToQueues,
  onDepartmentCreated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDescription, setNewDeptDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Drawer Inspection State
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const departments = hospital.departments || [];

  // Filtered departments
  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      const matchesSearch =
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (dept.status === 'ACTIVE' || !dept.status)) ||
        (statusFilter === 'inactive' && dept.status === 'INACTIVE');
      return matchesSearch && matchesStatus;
    });
  }, [departments, searchTerm, statusFilter]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      setFormError('Department name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await hospitalAdminService.createDepartment(hospital.id, newDeptName.trim());
      setFormSuccess(`Department "${newDeptName.trim()}" successfully created!`);
      setNewDeptName('');
      setNewDeptDescription('');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setFormSuccess(null);
        onDepartmentCreated?.();
        onRefresh?.();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create department. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<Department>[] = [
    {
      key: 'name',
      header: 'Specialty Department',
      render: (dept) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="size-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground text-sm block">
              {dept.name}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              ID: {dept.id.slice(0, 13)}...
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'queues',
      header: 'Clinical Queues / Rooms',
      render: (dept) => {
        const count = dept.queues?.length || 0;
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <ListOrdered className="size-3 mr-1" />
              {count} {count === 1 ? 'Room' : 'Rooms'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'reception',
      header: 'Intake Staff Assigned',
      render: (dept) => {
        const count = dept.receptionists?.length || 0;
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5 text-muted-foreground/70" />
            <span>
              {count > 0 ? (
                <span className="font-medium text-foreground">
                  {count} Assigned Staff
                </span>
              ) : (
                <span className="text-muted-foreground">Default Desk Allocation</span>
              )}
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Operational Status',
      render: (dept) => {
        const isInactive = dept.status === 'INACTIVE';
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              isInactive
                ? 'bg-muted text-muted-foreground'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isInactive ? 'bg-muted-foreground' : 'bg-emerald-500 animate-pulse'
              )}
            />
            {isInactive ? 'Inactive' : 'Active Unit'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (dept) => (
        <div className="flex items-center justify-end gap-2">
          <Btn
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDept(dept);
            }}
            className="text-xs h-8 px-2.5 rounded-lg"
          >
            Inspect
          </Btn>
          <Btn
            variant="soft"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToQueues(dept.id);
            }}
            className="text-xs h-8 px-3 rounded-lg"
          >
            Manage Rooms <ChevronRight className="size-3" />
          </Btn>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        eyebrow="CLINICAL UNITS & WINGS"
        title="Specialty Departments"
        subtitle={`Organize medical specialties, outpatient clinics, and consultation rooms for ${hospital.name}.`}
        badge={
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {departments.length} Units Configured
          </span>
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={
          <Btn
            variant="ink"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-xl font-medium shadow-xs"
          >
            <Plus className="size-3.5" />
            Add Specialty Department
          </Btn>
        }
      />

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search departments by name or ID..."
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Active Units', value: 'active' },
              { label: 'Inactive Units', value: 'inactive' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        onReset={() => {
          setSearchTerm('');
          setStatusFilter('all');
        }}
      />

      {/* Departments Data Table */}
      <DataTable
        columns={columns}
        data={filteredDepartments}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onRowClick={(dept) => setSelectedDept(dept)}
        emptyTitle="No Clinical Departments Configured"
        emptyDescription="Create your first specialty department to begin provisioning consultation rooms and queues."
        emptyAction={
          <Btn
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-xl"
          >
            <Plus className="size-3.5" />
            Add Specialty Department
          </Btn>
        }
      />

      {/* Staged Staff Provisioning Warning / Notice */}
      <div className="pt-2">
        <AwaitingBackendBadge
          endpoint="POST /admin/departments/:id/receptionists"
          featureName="Specialty Wing Reception Staff Provisioning"
          milestone="M2"
          variant="banner"
          details="Department-specific receptionist desk account binding and credential generation will automatically connect when M2 deploys the receptionist provisioning contract."
        />
      </div>

      {/* Add Department Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-dept-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="surface w-full max-w-md p-6 rounded-2xl border border-border/80 shadow-2xl bg-card space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Network className="size-4" />
                </span>
                <h3 id="add-dept-title" className="text-base font-semibold text-foreground">
                  Add Specialty Department
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Department Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology Wing, Pediatrics, Orthopedics"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  required
                  autoFocus
                  className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Will be assigned to verified hospital: {hospital.name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Clinical Specialty / Wing Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CARD-01, PED-EAST"
                  value={newDeptDescription}
                  onChange={(e) => setNewDeptDescription(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                />
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
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  variant="ink"
                  size="sm"
                  loading={isSubmitting}
                  disabled={!newDeptName.trim()}
                >
                  Create Department
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Detail Drawer */}
      <DetailDrawer
        open={Boolean(selectedDept)}
        onClose={() => setSelectedDept(null)}
        title={selectedDept?.name || 'Department Details'}
        subtitle={`Clinical Unit ID: ${selectedDept?.id || ''}`}
        badge={
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {selectedDept?.queues?.length || 0} Rooms
          </span>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Btn
              variant="soft"
              size="sm"
              onClick={() => setSelectedDept(null)}
            >
              Close
            </Btn>
            <Btn
              variant="ink"
              size="sm"
              onClick={() => {
                const deptId = selectedDept?.id;
                setSelectedDept(null);
                onNavigateToQueues(deptId);
              }}
            >
              Manage Department Queues <ChevronRight className="size-3" />
            </Btn>
          </div>
        }
      >
        {selectedDept && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Queues Breakdown
              </h4>
              {(selectedDept.queues || []).length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center">
                  <p className="text-xs text-muted-foreground">
                    No clinical queues currently provisioned in this department.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDept.queues?.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl border border-border/60 bg-card/60 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold text-foreground">{q.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Room: {q.roomLabel || 'Unspecified'} | Slug: {q.publicQueueId}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {q.acceptingWalkIns ? 'Walk-Ins Active' : 'Appointments Only'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Intake Desk Staff
              </h4>
              <p className="text-xs text-muted-foreground">
                Reception counters in this wing operate with default hospital staff allocation.
              </p>
              <AwaitingBackendBadge
                endpoint="POST /admin/departments/:id/receptionists"
                featureName="Specialty Reception Accounts"
                milestone="M2"
                variant="pill"
              />
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
