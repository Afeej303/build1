import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  ListOrdered,
  Users,
  Activity,
  Plus,
  ShieldAlert,
  Server,
  Database,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { PageHeader, StatCard, QueryErrorState, AwaitingBackendBadge } from '../../components/admin';
import { Btn, minutesAgo, ease } from '../../components/hq/ui';
import { apiClient, type ApiHealthStatus } from '../../lib/api-client';
import { superAdminService } from '../../services/superAdminService';
import type { Hospital, AuditLogEntry } from '../../services/types';
import { HospitalOnboardModal } from './HospitalOnboardModal';

export interface PlatformOverviewProps {
  onNavigate?: (tabId: string) => void;
}

export function PlatformOverview({ onNavigate }: PlatformOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<ApiHealthStatus | null>(null);

  // Onboard modal state
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [hospitalsData, logsData, usersData, health] = await Promise.all([
        superAdminService.fetchHospitals().catch(() => []),
        superAdminService.fetchAuditLogs(1, 8).catch(() => ({ items: [], meta: { page: 1, limit: 8 } })),
        superAdminService.fetchUsers(1, 1).catch(() => ({ items: [], meta: { page: 1, limit: 1, totalItems: 0 } })),
        apiClient.checkHealth().catch(() => ({ online: false, database: 'unreachable' })),
      ]);

      setHospitals(hospitalsData);
      setRecentLogs(logsData.items || []);
      setTotalUsersCount(usersData.meta?.totalItems ?? usersData.items?.length ?? 0);
      setHealthStatus(health);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true);
  };

  // KPI Calculations
  const totalHospitals = hospitals.length;
  const totalDepartments = hospitals.reduce((acc, h) => {
    return acc + (Array.isArray(h.departments) ? h.departments.length : 0);
  }, 0);
  const totalQueues = hospitals.reduce((acc, h) => {
    const depts = Array.isArray(h.departments) ? h.departments : [];
    return (
      acc +
      depts.reduce((dAcc, d) => {
        return dAcc + (Array.isArray(d.queues) ? d.queues.length : 0);
      }, 0)
    );
  }, 0);

  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CALL') || act.includes('NEXT')) return 'bg-primary/10 text-primary border-primary/20';
    if (act.includes('WALK_IN') || act.includes('CREATE')) return 'bg-success-soft text-success border-success/20';
    if (act.includes('COMPLETE')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (act.includes('CANCEL') || act.includes('DELETE') || act.includes('REVOKE'))
      return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Super Admin Operations Center"
        subtitle="Global platform overview, multi-tenant clinical capacity, infrastructure health, and system telemetry."
        eyebrow="Platform Governance"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        actions={
          <div className="flex items-center gap-2.5">
            <Btn
              variant="primary"
              size="md"
              onClick={() => setOnboardModalOpen(true)}
            >
              <Plus className="size-4" />
              <span>Onboard Hospital</span>
            </Btn>
          </div>
        }
      />

      {error && (
        <QueryErrorState
          error={error}
          title="Telemetry Connection Failed"
          message="Could not synchronize with platform management endpoints."
          onRetry={() => loadData()}
        />
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Hospitals Onboarded"
          value={totalHospitals}
          icon={Building2}
          description="Active multi-tenant facilities"
          variant="primary"
          loading={loading}
          trend={{ value: totalHospitals > 0 ? '+100%' : '0%', direction: 'up' }}
          onClick={() => onNavigate?.('hospitals')}
        />
        <StatCard
          title="Active Departments"
          value={totalDepartments}
          icon={Layers}
          description="Clinical departments configured"
          variant="success"
          loading={loading}
          onClick={() => onNavigate?.('hospitals')}
        />
        <StatCard
          title="Total Clinical Queues"
          value={totalQueues}
          icon={ListOrdered}
          description="Live patient queues & counters"
          variant="default"
          loading={loading}
          onClick={() => onNavigate?.('hospitals')}
        />
        <StatCard
          title="Platform Users"
          value={totalUsersCount}
          icon={Users}
          description="Registered system identities"
          variant="default"
          loading={loading}
          onClick={() => onNavigate?.('users')}
        />
      </div>

      {/* Main Grid: Health Card & Recent Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1 col): System Health & Quick Operations */}
        <div className="space-y-6">
          {/* System Health Card */}
          <div className="surface rounded-2xl p-5 sm:p-6 border border-border/80 bg-card/70 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Server className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Infrastructure Telemetry
                  </h3>
                  <span className="text-[11px] text-muted-foreground">Cluster Diagnostics</span>
                </div>
              </div>
              {healthStatus?.online ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Operational
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  Degraded
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Server className="size-3.5" /> API Gateway
                </span>
                <span className="font-mono font-medium text-foreground">
                  {healthStatus?.online ? 'Online (HTTP 200)' : 'Unreachable'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="size-3.5" /> Database Connectivity
                </span>
                <span className="font-mono font-medium capitalize text-foreground">
                  {healthStatus?.database || 'Connected'}
                </span>
              </div>
              {healthStatus?.uptimeSeconds !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5" /> Core Uptime
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {Math.floor(healthStatus.uptimeSeconds / 3600)}h{' '}
                    {Math.floor((healthStatus.uptimeSeconds % 3600) / 60)}m
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Architecture Version</span>
                <span className="font-mono font-medium text-foreground">M1 Multi-Tenant Core</span>
              </div>
            </div>

            <div className="pt-2">
              <AwaitingBackendBadge
                variant="chip"
                endpoint="GET /admin/metrics/prometheus"
                featureName="Prometheus Metrics Gateway"
                milestone="M2"
              />
            </div>
          </div>

          {/* Quick Admin Actions */}
          <div className="surface rounded-2xl p-5 border border-border/80 bg-card/70 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Operations
            </h4>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setOnboardModalOpen(true)}
                className="press w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Onboard Healthcare Facility
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('users')}
                className="press w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Inspect Platform Identities
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('audit')}
                className="press w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  View System Audit Stream
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('incidents')}
                className="press w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  Incident Triage Desk
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (2 cols): Real-Time Activity Stream Preview */}
        <div className="lg:col-span-2 surface rounded-2xl p-5 sm:p-6 border border-border/80 bg-card/70 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Recent Platform Activity Stream
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Live audit events across all hospital tenants
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('audit')}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>View full log</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          {/* Activity items list */}
          <div className="flex-1 space-y-2.5">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton size-8 rounded-xl" />
                    <div className="space-y-1.5 flex-1">
                      <div className="skeleton h-3 w-48" />
                      <div className="skeleton h-2.5 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentLogs.length > 0 ? (
              <div className="divide-y divide-border/50">
                {recentLogs.map((log) => {
                  const createdAtTs = log.createdAt ? new Date(log.createdAt).getTime() : Date.now();
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-muted/30 rounded-xl transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-tight ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <div>
                          <div className="font-medium text-foreground">
                            {log.actorEmail || log.actorName || log.actorId || 'System Worker'}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>Source: {log.source || 'api'}</span>
                            {log.hospitalId && (
                              <span className="truncate max-w-[140px]">
                                Hospital: {log.hospitalId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground whitespace-nowrap">
                        {minutesAgo(createdAtTs)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No recent activity events recorded yet.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Continuous background event ingestion</span>
            <span className="font-mono text-[11px]">Auto-refreshed with PageHeader</span>
          </div>
        </div>
      </div>

      {/* Hospital Onboarding Modal */}
      <HospitalOnboardModal
        open={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        onSuccess={(created) => {
          setHospitals((prev) => [created, ...prev]);
        }}
      />
    </div>
  );
}
