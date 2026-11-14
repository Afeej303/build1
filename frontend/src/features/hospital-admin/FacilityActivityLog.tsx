import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ScrollText,
  Clock,
  User,
  Ticket,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  EmptyState,
  QueryErrorState,
  ColumnDef,
} from '../../components/admin';
import { Btn, ease } from '../../components/hq/ui';
import { hospitalAdminService } from '../../services/hospitalAdminService';
import type { Hospital, AuditLogEntry } from '../../services/types';
import { cn } from '../../lib/utils';

export interface FacilityActivityLogProps {
  hospital: Hospital;
  isLoading?: boolean;
}

/**
 * FacilityActivityLog
 * Operational audit log streaming intake events, patient calls, and doctor consultations.
 * Handles 403 Forbidden scenarios gracefully with QueryErrorState as mandated by M2 specs.
 */
export const FacilityActivityLog: React.FC<FacilityActivityLogProps> = ({ hospital }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const {
    data: auditData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['facility-activity-log', hospital.id],
    queryFn: () => hospitalAdminService.fetchActivityLog(),
    refetchInterval: 12000,
  });

  // Extract items or fallback
  const rawItems = auditData?.items || [];

  // Filter items
  const filteredItems = rawItems.filter((item) => {
    const matchesSearch =
      item.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.actorName && item.actorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.tokenId && item.tokenId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.source && item.source.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction =
      actionFilter === 'all' ||
      item.action.toLowerCase().includes(actionFilter.toLowerCase());

    return matchesSearch && matchesAction;
  });

  // Handle 403, Network Error, or API Error
  if (isError) {
    const isNetwork = Boolean(
      (error as any)?.isNetworkError ||
        (error as any)?.code === 'BACKEND_CONNECTION_ERROR' ||
        (error instanceof TypeError && error.message.includes('fetch'))
    );
    const resolvedStatus = (error as any)?.status;
    const is403 = resolvedStatus === 403 || (error as Error)?.message?.includes('403');

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="FACILITY EVENT STREAM"
          title="Facility Activity Stream"
          subtitle={`Audit stream recording intake counters and doctor room events for ${hospital.name}.`}
          onRefresh={() => {
            refetch();
          }}
          isRefreshing={isRefetching}
        />

        <QueryErrorState
          statusCode={isNetwork ? undefined : is403 ? 403 : resolvedStatus}
          errorCode={
            isNetwork
              ? 'BACKEND_CONNECTION_ERROR'
              : is403
              ? 'FORBIDDEN_STAFF_ASSIGNMENT'
              : (error as any)?.code || 'AUDIT_STREAM_ERROR'
          }
          title={
            isNetwork
              ? 'Backend Connectivity Error'
              : is403
              ? 'Audit Log Access Restricted'
              : undefined
          }
          message={
            isNetwork
              ? 'Unable to connect to the backend server. Failed to retrieve facility audit stream due to network or server connectivity.'
              : is403
              ? 'The audit stream requires staff reception assignment or administrator privileges.'
              : (error as Error)?.message
          }
          error={error}
          onRetry={() => {
            refetch();
          }}
          isRetrying={isRefetching}
        />
      </div>
    );
  }

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      width: '180px',
      render: (entry) => {
        const date = new Date(entry.createdAt);
        return (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="size-3 text-muted-foreground" />
            <span className="font-mono text-muted-foreground">
              {isNaN(date.getTime()) ? entry.createdAt : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action / Event',
      render: (entry) => {
        const actionLower = entry.action.toLowerCase();
        let badgeColor = 'bg-primary/10 text-primary border-primary/20';

        if (actionLower.includes('call') || actionLower.includes('next')) {
          badgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
        } else if (actionLower.includes('complete') || actionLower.includes('finish')) {
          badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
        } else if (actionLower.includes('cancel') || actionLower.includes('skip')) {
          badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
        }

        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
                badgeColor
              )}
            >
              <Activity className="size-3" />
              {entry.action.replace(/_/g, ' ')}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actor',
      header: 'Operator / Staff',
      render: (entry) => (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="size-3" />
          </div>
          <div>
            <span className="font-medium text-foreground block">
              {entry.actorName || 'Staff Member'}
            </span>
            {entry.actorEmail && (
              <span className="text-[10px] text-muted-foreground">{entry.actorEmail}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Token / Queue Context',
      render: (entry) => (
        <div className="text-xs text-muted-foreground">
          {entry.tokenId ? (
            <span className="inline-flex items-center gap-1 font-mono font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded">
              <Ticket className="size-3 text-primary" /> Token {entry.tokenId}
            </span>
          ) : (
            <span>Facility Terminal Event</span>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Terminal Source',
      render: (entry) => (
        <span className="text-xs font-mono text-muted-foreground">
          {entry.source || 'COUNTER_DESK'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        eyebrow="AUDIT & COMPLIANCE"
        title="Facility Activity Stream"
        subtitle={`Real-time audit log of intake desk operations, patient call events, and consultations for ${hospital.name}.`}
        badge={
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Live Stream
          </span>
        }
        onRefresh={() => {
          refetch();
        }}
        isRefreshing={isRefetching}
      />

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search events, tokens, staff, or actions..."
        filters={[
          {
            id: 'action',
            label: 'Event Type',
            value: actionFilter,
            options: [
              { label: 'All Events', value: 'all' },
              { label: 'Patient Calls', value: 'call' },
              { label: 'Intake Registrations', value: 'token' },
              { label: 'Consultations Completed', value: 'complete' },
            ],
            onChange: setActionFilter,
          },
        ]}
        onReset={() => {
          setSearchTerm('');
          setActionFilter('all');
        }}
      />

      {/* Audit Log DataTable */}
      <DataTable
        columns={columns}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No Activity Recorded"
        emptyDescription="Audit events will appear here as patients are registered at counters and called by physicians."
      />
    </div>
  );
};
