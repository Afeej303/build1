import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Printer,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  Search,
  RefreshCw,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  StatCard,
  AwaitingBackendBadge,
  ColumnDef,
} from '../../components/admin';
import { Btn, ease } from '../../components/hq/ui';
import { hospitalAdminService } from '../../services/hospitalAdminService';
import type { Hospital, ReceptionCounter } from '../../services/types';
import { cn } from '../../lib/utils';

export interface ReceptionCounterManagerProps {
  hospital: Hospital;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
}

/**
 * ReceptionCounterManager
 * Administrative console for managing intake desks, receptionist counter allocations,
 * and physical thermal printer slip terminals.
 */
export const ReceptionCounterManager: React.FC<ReceptionCounterManagerProps> = ({
  hospital,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [counterAllowance, setCounterAllowance] = useState<number>(5);
  const [saveAllowanceMsg, setSaveAllowanceMsg] = useState<string | null>(null);

  const rawCounters = useMemo(
    () => hospitalAdminService.getHospitalCounters(hospital),
    [hospital]
  );

  const stats = useMemo(
    () => hospitalAdminService.computeFacilityStats(hospital),
    [hospital]
  );

  // Filter counters
  const filteredCounters = useMemo(() => {
    return rawCounters.filter((c) => {
      const staffName =
        c.currentStaff && typeof c.currentStaff === 'object' && 'name' in c.currentStaff
          ? c.currentStaff.name
          : '';
      const matchesSearch =
        c.counterLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(c.counterNumber).includes(searchTerm) ||
        (c.departmentName && c.departmentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        staffName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [rawCounters, searchTerm]);

  const handleUpdateAllowance = (newVal: number) => {
    const clamped = Math.max(1, Math.min(20, newVal));
    setCounterAllowance(clamped);
    setSaveAllowanceMsg(`Counter allowance updated to ${clamped} active physical desks.`);
    setTimeout(() => setSaveAllowanceMsg(null), 3000);
  };

  const columns: ColumnDef<ReceptionCounter>[] = [
    {
      key: 'counter',
      header: 'Reception Desk / Counter',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold text-sm">
            #{c.counterNumber}
          </div>
          <div>
            <span className="font-semibold text-foreground text-sm block">
              {c.counterLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Wing: {c.departmentName || 'General Outpatient'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'staff',
      header: 'Assigned Intake Operator',
      render: (c) => {
        const staffObj =
          c.currentStaff && typeof c.currentStaff === 'object' && 'name' in c.currentStaff
            ? (c.currentStaff as { id: string; name: string; email?: string })
            : null;

        return staffObj ? (
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCheck className="size-3" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{staffObj.name}</p>
              {staffObj.email && (
                <p className="text-[10px] text-muted-foreground">{staffObj.email}</p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Floating Staff Allocation
          </span>
        );
      },
    },
    {
      key: 'printer',
      header: 'Ticket Terminal Hardware',
      render: () => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Printer className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>80mm ESC/POS Thermal</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Operating State',
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active Desk
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        eyebrow="INTAKE & RECEPTION CAPACITY"
        title="Reception Desks & Intake Counters"
        subtitle="Configure physical intake desks, thermal receipt printers, and licensed counter capacity."
        badge={
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {counterAllowance} Desks Licensed
          </span>
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Counter Allowance Controller Banner */}
      <div className="surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Counter Allowance & Concurrency Governor
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Controls maximum simultaneous reception intake windows open across all clinical wings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Allowance:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleUpdateAllowance(counterAllowance - 1)}
                disabled={counterAllowance <= 1}
                className="size-8 flex items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold hover:bg-muted disabled:opacity-40 transition-colors"
              >
                -
              </button>
              <span className="w-10 text-center font-mono font-bold text-base text-foreground">
                {counterAllowance}
              </span>
              <button
                type="button"
                onClick={() => handleUpdateAllowance(counterAllowance + 1)}
                disabled={counterAllowance >= 20}
                className="size-8 flex items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold hover:bg-muted disabled:opacity-40 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {saveAllowanceMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{saveAllowanceMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Currently Provisioned
            </p>
            <p className="text-xl font-bold text-foreground mt-1">{rawCounters.length} Desks</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Maximum Allowance
            </p>
            <p className="text-xl font-bold text-foreground mt-1">{counterAllowance} Desks</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Capacity Status
            </p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
              Within Normal Operational Limits
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search reception desks, numbers, or staff..."
        onReset={() => setSearchTerm('')}
      />

      {/* Counters DataTable */}
      <DataTable
        columns={columns}
        data={filteredCounters}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No Reception Counters Configured"
        emptyDescription="Reception counters are automatically generated from department intake configurations."
      />
    </div>
  );
};
