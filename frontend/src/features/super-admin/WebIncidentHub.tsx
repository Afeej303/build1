import React, { useState } from 'react';
import {
  AlertTriangle,
  Bug,
  Plus,
  ShieldAlert,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  Send,
  X,
  Radio,
  HelpCircle,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  EmptyState,
  DetailDrawer,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin';
import { Btn, minutesAgo, ease } from '../../components/hq/ui';
import type { WebIncident, IncidentSeverity, IncidentStatus } from '../../services/types';

const INITIAL_INCIDENTS: WebIncident[] = [
  {
    id: 'INC-1092',
    hospitalName: 'St. Jude Metropolitan Medical Center',
    reporterEmail: 'nurse.station@stjude.health',
    title: 'Thermal receipt printer paper jam in Reception Counter 2',
    severity: 'MEDIUM',
    category: 'HARDWARE',
    description: 'Walk-in desk counter 2 printer fails to auto-cut tickets. Receptionist manually routing patients.',
    component: 'Reception Desk',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'INC-1091',
    hospitalName: 'City Central General Hospital',
    reporterEmail: 'admin@citygeneral.health',
    title: 'Display screen websocket reconnect loop during network switchover',
    severity: 'HIGH',
    category: 'SYNC',
    description: 'Public waiting board TV signage briefly lost live queue broadcast during hospital gateway reboot.',
    component: 'Public Display',
    status: 'INVESTIGATING',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'INC-1089',
    hospitalName: 'Metro Health Specialized Clinic',
    reporterEmail: 'ops@metrohealth.org',
    title: 'Routine doctor consult queue token completed successfully',
    severity: 'LOW',
    category: 'QUEUE',
    description: 'Post-resolution verification of completed patient consult flow.',
    component: 'Doctor Workstation',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
  },
];

export function WebIncidentHub() {
  const [incidents, setIncidents] = useState<WebIncident[]>(INITIAL_INCIDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Inspection Drawer
  const [selectedIncident, setSelectedIncident] = useState<WebIncident | null>(null);

  // New Incident Modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHospital, setNewHospital] = useState('');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [newCategory, setNewCategory] = useState('QUEUE');
  const [newDescription, setNewDescription] = useState('');

  const filteredIncidents = incidents.filter((inc) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      inc.title.toLowerCase().includes(q) ||
      inc.hospitalName.toLowerCase().includes(q) ||
      inc.id.toLowerCase().includes(q) ||
      inc.reporterEmail.toLowerCase().includes(q);

    const matchesSeverity =
      severityFilter === 'all' ||
      inc.severity.toLowerCase() === severityFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'all' ||
      inc.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase tracking-wider">
            <Radio className="size-2.5 animate-pulse text-destructive" />
            P1 - Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            P2 - High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
            P3 - Medium
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            P4 - Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            <span className="size-1 rounded-full bg-destructive" />
            Open
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            <span className="size-1 rounded-full bg-amber-500" />
            Investigating
          </span>
        );
      case 'RESOLVED':
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
            <span className="size-1 rounded-full bg-success" />
            Resolved
          </span>
        );
    }
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newHospital.trim()) return;

    const created: WebIncident = {
      id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalName: newHospital.trim(),
      reporterEmail: 'superadmin@hqms.health',
      title: newTitle.trim(),
      severity: newSeverity,
      category: newCategory,
      description: newDescription.trim() || 'No description provided.',
      component: 'Platform Console',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    setIncidents([created, ...incidents]);
    setNewModalOpen(false);
    setNewTitle('');
    setNewHospital('');
    setNewDescription('');
  };

  const columns: ColumnDef<WebIncident>[] = [
    {
      key: 'severity',
      header: 'Severity',
      width: '120px',
      render: (inc) => getSeverityBadge(inc.severity),
    },
    {
      key: 'title',
      header: 'Incident Title',
      render: (inc) => (
        <div>
          <div className="font-semibold text-foreground text-xs">{inc.title}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
            <span className="font-mono">{inc.id}</span>
            <span>•</span>
            <span className="truncate max-w-[200px]">{inc.hospitalName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '110px',
      render: (inc) => (
        <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground border border-border/50">
          {inc.category}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '120px',
      render: (inc) => getStatusBadge(inc.status),
    },
    {
      key: 'createdAt',
      header: 'Reported',
      width: '130px',
      render: (inc) => {
        const ts = new Date(inc.createdAt).getTime();
        return (
          <span className="text-xs text-muted-foreground">
            {minutesAgo(ts)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '100px',
      render: (inc) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIncident(inc);
          }}
          className="press inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Eye className="size-3.5" />
          <span>Triage</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Web Incident Triage Hub"
        subtitle="Live incident response console, service reliability monitoring, and incident reporting protocol."
        eyebrow="Platform Reliability"
        actions={
          <Btn
            variant="primary"
            size="md"
            onClick={() => setNewModalOpen(true)}
          >
            <Plus className="size-4" />
            <span>Report Incident</span>
          </Btn>
        }
      />

      {/* SLA & Incident Protocol Summary Card */}
      <div className="surface rounded-2xl p-5 border border-border/80 bg-card/70 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-500" />
          HQMS Operational Reliability Protocol & SLA
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1">
            <span className="font-bold text-destructive block">P1 - Critical</span>
            <span className="text-muted-foreground text-[11px] block">
              Complete queue halt or auth outage.
            </span>
            <span className="font-mono text-[10px] text-foreground font-semibold">SLA: &lt; 15 mins</span>
          </div>
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
            <span className="font-bold text-amber-700 dark:text-amber-300 block">P2 - High</span>
            <span className="text-muted-foreground text-[11px] block">
              Department desync or display drop.
            </span>
            <span className="font-mono text-[10px] text-foreground font-semibold">SLA: &lt; 1 hour</span>
          </div>
          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
            <span className="font-bold text-blue-700 dark:text-blue-300 block">P3 - Medium</span>
            <span className="text-muted-foreground text-[11px] block">
              Peripheral hardware or slow query.
            </span>
            <span className="font-mono text-[10px] text-foreground font-semibold">SLA: &lt; 4 hours</span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-muted/40 space-y-1">
            <span className="font-bold text-muted-foreground block">P4 - Low</span>
            <span className="text-muted-foreground text-[11px] block">
              Minor UI anomaly or feature request.
            </span>
            <span className="font-mono text-[10px] text-foreground font-semibold">SLA: Next sprint</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search incidents by title, hospital, or ID..."
        filters={[
          {
            id: 'severity',
            label: 'Severity',
            value: severityFilter,
            options: [
              { label: 'All Severities', value: 'all' },
              { label: 'P1 - Critical', value: 'critical' },
              { label: 'P2 - High', value: 'high' },
              { label: 'P3 - Medium', value: 'medium' },
              { label: 'P4 - Low', value: 'low' },
            ],
            onChange: setSeverityFilter,
          },
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Open', value: 'open' },
              { label: 'Investigating', value: 'investigating' },
              { label: 'Resolved', value: 'resolved' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        onReset={() => {
          setSearchQuery('');
          setSeverityFilter('all');
          setStatusFilter('all');
        }}
        extraActions={
          <span className="text-xs text-muted-foreground">
            <strong className="text-foreground">{filteredIncidents.length}</strong> active tickets
          </span>
        }
      />

      {/* Incidents Table */}
      <DataTable<WebIncident>
        columns={columns}
        data={filteredIncidents}
        keyExtractor={(inc) => inc.id}
        onRowClick={(inc) => setSelectedIncident(inc)}
        emptyTitle="No Incidents Reported"
        emptyDescription="All healthcare services and clinical queues are running normally with zero open incidents."
        emptyIcon={Bug}
      />

      {/* Incident Details Drawer */}
      <DetailDrawer
        open={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident?.title || 'Incident Triage'}
        subtitle={selectedIncident?.id}
        badge={selectedIncident && getSeverityBadge(selectedIncident.severity)}
        width="lg"
      >
        {selectedIncident && (
          <div className="space-y-6">
            <div className="surface rounded-2xl p-4 bg-muted/20 border border-border/70 space-y-3 text-xs">
              <h4 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
                Incident Context
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Affected Hospital:</span>
                  <span className="font-semibold text-foreground">{selectedIncident.hospitalName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Reporter:</span>
                  <span className="text-foreground font-mono">{selectedIncident.reporterEmail}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Category:</span>
                  <span className="text-foreground">{selectedIncident.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Current Status:</span>
                  <span>{getStatusBadge(selectedIncident.status)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
                Detailed Description & Root Cause
              </h4>
              <p className="rounded-2xl border border-border/70 bg-card p-4 text-xs leading-relaxed text-foreground">
                {selectedIncident.description}
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Report New Incident Modal */}
      {newModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => setNewModalOpen(false)}
          />
          <div className="surface glass relative z-10 w-full max-w-lg rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <Bug className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Report Platform Incident</h3>
                  <p className="text-xs text-muted-foreground">Dispatch incident triage record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="press rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Incident Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Counter printer offline in Cardiology"
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Healthcare Facility <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newHospital}
                  onChange={(e) => setNewHospital(e.target.value)}
                  placeholder="e.g. City Central Hospital"
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Severity Tier</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                    className="h-10 w-full rounded-xl border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                  >
                    <option value="CRITICAL">P1 - Critical</option>
                    <option value="HIGH">P2 - High</option>
                    <option value="MEDIUM">P3 - Medium</option>
                    <option value="LOW">P4 - Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                  >
                    <option value="QUEUE">Queue Desync</option>
                    <option value="AUTH">Authentication</option>
                    <option value="HARDWARE">Hardware / Thermal Printer</option>
                    <option value="NETWORK">Network Connectivity</option>
                    <option value="SYNC">WebSocket Telemetry</option>
                    <option value="PERFORMANCE">Query Latency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Description & Observations
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide context, affected room/counter, or error messages..."
                  className="w-full rounded-xl border border-input bg-card p-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                <Btn
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={() => setNewModalOpen(false)}
                >
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  <Send className="size-3.5" />
                  <span>Submit Ticket</span>
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
