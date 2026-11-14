import React from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  Network,
  ListOrdered,
  Stethoscope,
  UserCheck,
  Plus,
  Tv,
  Activity,
  ShieldCheck,
  ExternalLink,
  Radio,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { PageHeader, StatCard, AwaitingBackendBadge } from '../../components/admin';
import { Btn, ease, Card } from '../../components/hq/ui';
import { hospitalAdminService } from '../../services/hospitalAdminService';
import type { Hospital } from '../../services/types';
import { cn } from '../../lib/utils';

export interface FacilityOverviewProps {
  hospital: Hospital;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  onNavigateTab: (tab: string) => void;
  onOpenAddDepartment: () => void;
  onOpenProvisionQueue: () => void;
}

/**
 * FacilityOverview
 * High-level executive dashboard presenting facility KPIs, multi-tenant isolation status,
 * active clinical units summary, and one-click operational quick actions.
 */
export const FacilityOverview: React.FC<FacilityOverviewProps> = ({
  hospital,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  onNavigateTab,
  onOpenAddDepartment,
  onOpenProvisionQueue,
}) => {
  const stats = hospitalAdminService.computeFacilityStats(hospital);
  const departments = hospital.departments || [];

  // Find first active queue slug for testing Public TV Signage
  let firstQueueSlug = 'm1-demo-4d1422a8';
  for (const dept of departments) {
    if (dept.queues && dept.queues.length > 0) {
      firstQueueSlug = dept.queues[0].publicQueueId || dept.queues[0].id || firstQueueSlug;
      break;
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        eyebrow="FACILITY OPERATIONS COMMAND"
        title={hospital.name || 'Hospital Operations'}
        subtitle={`Verified multi-tenant facility tenant (ID: ${hospital.id}). Direct control for clinical departments, consultation rooms, and digital signage.`}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Facility
          </span>
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="soft"
              size="sm"
              onClick={onOpenAddDepartment}
              className="rounded-xl font-medium"
            >
              <Plus className="size-3.5" />
              Add Department
            </Btn>
            <Btn
              variant="ink"
              size="sm"
              onClick={onOpenProvisionQueue}
              className="rounded-xl font-medium shadow-xs"
            >
              <ListOrdered className="size-3.5" />
              Provision Queue
            </Btn>
          </div>
        }
      />

      {/* Active Clinical Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Security & Accreditation Status */}
        <div className="surface flex items-center gap-3.5 p-4 rounded-2xl border border-border/70 bg-card/60">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Facility Security
              </span>
              <span className="size-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground truncate">
              Enterprise Protected
            </p>
            <p className="text-[11px] text-muted-foreground">
              HIPAA Compliant & Encrypted
            </p>
          </div>
        </div>

        {/* Realtime Clinic Status */}
        <div className="surface flex items-center gap-3.5 p-4 rounded-2xl border border-border/70 bg-card/60">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Radio className="size-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinic Operations
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Synchronized
              </span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">
              Live Queues Active
            </p>
            <p className="text-[11px] text-muted-foreground">
              {stats.totalActiveQueues} departments operational
            </p>
          </div>
        </div>

        {/* Public TV Signage Status */}
        <div className="surface flex items-center gap-3.5 p-4 rounded-2xl border border-border/70 bg-card/60">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Tv className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Waiting TV Signage
              </span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">
              Zero-PII Public Board
            </p>
            <a
              href={`/display?queue=${encodeURIComponent(firstQueueSlug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              Launch Signage <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Facility KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Specialty Departments"
          value={stats.totalDepartments}
          icon={Network}
          description="Configured clinical specialty wings"
          variant="primary"
          loading={isLoading}
          onClick={() => onNavigateTab('departments')}
        />

        <StatCard
          title="Active Clinical Queues"
          value={stats.totalActiveQueues}
          icon={ListOrdered}
          description={`${stats.totalQueues} total registered rooms`}
          variant="success"
          loading={isLoading}
          onClick={() => onNavigateTab('queues')}
        />

        <StatCard
          title="Assigned Doctors"
          value={stats.totalAssignedDoctors}
          icon={Stethoscope}
          description="Physicians assigned to consultation rooms"
          variant="default"
          loading={isLoading}
          onClick={() => onNavigateTab('doctors')}
        />

        <StatCard
          title="Reception Desks"
          value={stats.receptionCountersCount}
          icon={UserCheck}
          description={`Allowance: ${stats.counterAllowance} desks configured`}
          variant="warning"
          loading={isLoading}
          onClick={() => onNavigateTab('staff')}
        />
      </div>

      {/* Quick Launch & Operational Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Links & Shortcuts */}
        <div className="surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Operational Shortcuts</h2>
            <Sparkles className="size-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Direct shortcuts to configure departments, manage room assignments, and inspect public displays.
          </p>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={onOpenAddDepartment}
              className="press w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/40 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Network className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Add Specialty Department</p>
                  <p className="text-[11px] text-muted-foreground">Expand clinical wings and units</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onOpenProvisionQueue}
              className="press w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/40 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ListOrdered className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Provision Queue & Room</p>
                  <p className="text-[11px] text-muted-foreground">Setup new consultation room or desk</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>

            <a
              href={`/display?queue=${encodeURIComponent(firstQueueSlug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/40 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Tv className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Launch Public TV Signage</p>
                  <p className="text-[11px] text-muted-foreground">Open waiting hall display board</p>
                </div>
              </div>
              <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </a>

            <button
              type="button"
              onClick={() => onNavigateTab('activity')}
              className="press w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/40 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Activity className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">View Facility Activity Log</p>
                  <p className="text-[11px] text-muted-foreground">Audit counter intake & doctor calls</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Clinical Wings & Queues Summary */}
        <div className="lg:col-span-2 surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Clinical Specialty Wings</h2>
              <p className="text-xs text-muted-foreground">
                Overview of current departments and room occupancy.
              </p>
            </div>
            <Btn
              variant="soft"
              size="sm"
              onClick={() => onNavigateTab('departments')}
              className="text-xs rounded-xl"
            >
              Manage All <ArrowRight className="size-3" />
            </Btn>
          </div>

          {departments.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-border/80">
              <Network className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-foreground">No Specialty Departments Yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Get started by creating your hospital's first clinical department.
              </p>
              <Btn size="sm" onClick={onOpenAddDepartment} className="rounded-xl">
                <Plus className="size-3.5" /> Add First Department
              </Btn>
            </div>
          ) : (
            <div className="space-y-3">
              {departments.slice(0, 4).map((dept) => {
                const queues = dept.queues || [];
                const assignedDocs = queues.filter((q) => q.doctorId || q.doctor).length;

                return (
                  <div
                    key={dept.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/60 bg-background/40 hover:bg-background/80 transition-colors gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {dept.name}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {queues.length} {queues.length === 1 ? 'Room' : 'Rooms'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {assignedDocs > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {assignedDocs} of {queues.length} rooms assigned to doctors
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            No doctors assigned yet
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Btn
                        variant="soft"
                        size="sm"
                        onClick={() => onNavigateTab('queues')}
                        className="text-xs h-8 px-3 rounded-lg"
                      >
                        Inspect Queues
                      </Btn>
                    </div>
                  </div>
                );
              })}

              {departments.length > 4 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  + {departments.length - 4} additional departments active
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
