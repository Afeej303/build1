import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ScrollText,
  Activity,
  Search,
  Filter,
  Clock,
  Play,
  Pause,
  Eye,
  CheckCircle2,
  Calendar,
  User,
  Building,
  RotateCw,
  Code2,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  Pagination,
  EmptyState,
  QueryErrorState,
  DetailDrawer,
  AwaitingBackendBadge,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin';
import { Btn, minutesAgo } from '../../components/hq/ui';
import { superAdminService } from '../../services/superAdminService';
import type { AuditLogEntry } from '../../services/types';

export function SystemAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh state (every 10 seconds)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  // Inspection drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  const loadLogs = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const res = await superAdminService.fetchAuditLogs(currentPage, pageSize);
      setLogs(res.items);
      setTotalItems(res.meta?.totalItems ?? res.items.length);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentPage]);

  // Handle auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadLogs(true);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [autoRefresh, currentPage]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setCountdown(10);
    await loadLogs(true);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        log.action.toLowerCase().includes(q) ||
        (log.actorEmail && log.actorEmail.toLowerCase().includes(q)) ||
        (log.actorName && log.actorName.toLowerCase().includes(q)) ||
        (log.actorId && log.actorId.toLowerCase().includes(q)) ||
        (log.hospitalId && log.hospitalId.toLowerCase().includes(q));

      const matchesAction =
        actionFilter === 'all' ||
        log.action.toLowerCase().includes(actionFilter.toLowerCase());

      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    let badgeClass = 'bg-muted text-muted-foreground border-border';
    if (act.includes('CALL') || act.includes('NEXT')) {
      badgeClass = 'bg-primary/10 text-primary border-primary/20';
    } else if (act.includes('WALK_IN') || act.includes('CREATE') || act.includes('ONBOARD')) {
      badgeClass = 'bg-success-soft text-success border-success/20';
    } else if (act.includes('COMPLETE')) {
      badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    } else if (act.includes('CANCEL') || act.includes('DELETE') || act.includes('REVOKE')) {
      badgeClass = 'bg-destructive/10 text-destructive border-destructive/20';
    }

    return (
      <span
        className={`inline-flex items-center rounded-lg border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight ${badgeClass}`}
      >
        {action}
      </span>
    );
  };

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      width: '180px',
      render: (log) => getActionBadge(log.action),
    },
    {
      key: 'actor',
      header: 'Actor / Identity',
      render: (log) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground text-xs">
            {log.actorEmail || log.actorName || 'System Service'}
          </div>
          {log.actorId && (
            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
              ID: {log.actorId}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Entity Scope',
      render: (log) => (
        <div className="text-xs space-y-0.5">
          {log.hospitalId ? (
            <div className="flex items-center gap-1 font-mono text-[11px] text-foreground">
              <Building className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[160px]">{log.hospitalId}</span>
            </div>
          ) : (
            <span className="text-muted-foreground italic text-[11px]">Platform Scope</span>
          )}
          {log.tokenId && (
            <div className="text-[10px] text-muted-foreground font-mono">
              Token: {log.tokenId}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      width: '110px',
      render: (log) => (
        <code className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {log.source || 'api'}
        </code>
      ),
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      width: '160px',
      render: (log) => {
        const d = log.createdAt ? new Date(log.createdAt) : new Date();
        return (
          <div className="text-xs">
            <span className="text-foreground font-medium block">{minutesAgo(d.getTime())}</span>
            <span className="text-[10px] text-muted-foreground">{d.toLocaleTimeString()}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Payload',
      align: 'right',
      width: '90px',
      render: (log) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(log);
          }}
          className="press inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Code2 className="size-3.5" />
          <span>JSON</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="System Audit Log"
        subtitle="Immutable, centralized event stream recording clinical state changes, staff transitions, and administrative actions."
        eyebrow="Platform Governance"
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        badge={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`press inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                autoRefresh
                  ? 'border-success/30 bg-success-soft text-success'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              {autoRefresh ? (
                <>
                  <Pause className="size-3" />
                  <span>Auto-refreshing ({countdown}s)</span>
                </>
              ) : (
                <>
                  <Play className="size-3" />
                  <span>Auto-refresh Paused</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Filter events by action, actor, hospital ID, or token..."
        filters={[
          {
            id: 'action',
            label: 'Action Category',
            value: actionFilter,
            options: [
              { label: 'All Actions', value: 'all' },
              { label: 'CALL_NEXT', value: 'call_next' },
              { label: 'WALK_IN', value: 'walk_in' },
              { label: 'COMPLETE', value: 'complete' },
              { label: 'ADMIN / CREATE', value: 'create' },
            ],
            onChange: (val) => {
              setActionFilter(val);
              setCurrentPage(1);
            },
          },
        ]}
        onReset={() => {
          setSearchQuery('');
          setActionFilter('all');
          setCurrentPage(1);
        }}
        extraActions={
          <span className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredLogs.length}</strong> events
          </span>
        }
      />

      {error ? (
        <QueryErrorState
          error={error}
          title="Audit Stream Disconnected"
          message="Could not stream audit records from /audit-logs endpoint."
          onRetry={() => loadLogs()}
        />
      ) : (
        <div className="space-y-4">
          <DataTable<AuditLogEntry>
            columns={columns}
            data={filteredLogs}
            keyExtractor={(l) => l.id}
            isLoading={isLoading}
            onRowClick={(l) => setSelectedLog(l)}
            emptyTitle="No Audit Events Recorded"
            emptyDescription="Events generated by patient arrivals, doctor calls, and administrator actions will appear here."
            emptyIcon={ScrollText}
          />

          {!isLoading && totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* JSON Inspection Drawer */}
      <DetailDrawer
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Inspection"
        subtitle={selectedLog ? `Event ID: ${selectedLog.id}` : undefined}
        badge={selectedLog && getActionBadge(selectedLog.action)}
        width="lg"
      >
        {selectedLog && (
          <div className="space-y-5">
            {/* Metadata Summary */}
            <div className="surface rounded-2xl p-4 bg-muted/20 border border-border/70 text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Action:</span>
                <span className="font-mono font-semibold text-foreground">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Actor:</span>
                <span className="font-medium text-foreground">
                  {selectedLog.actorEmail || selectedLog.actorName || selectedLog.actorId}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Timestamp:</span>
                <span className="text-foreground">
                  {selectedLog.createdAt ? new Date(selectedLog.createdAt).toISOString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Source Gateway:</span>
                <span className="font-mono text-foreground">{selectedLog.source}</span>
              </div>
            </div>

            {/* Raw JSON Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Raw Event Metadata
                </h4>
              </div>
              <pre className="rounded-2xl border border-border/70 bg-card p-4 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto max-h-[360px]">
                {JSON.stringify(selectedLog.metadata || selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
