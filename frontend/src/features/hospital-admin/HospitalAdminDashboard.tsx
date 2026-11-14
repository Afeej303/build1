import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Network,
  ListOrdered,
  Stethoscope,
  UserCheck,
  Activity,
  AlertTriangle,
  Settings,
  Plus,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Radio,
  Bug,
  Sliders,
  Bell,
  Printer,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  AdminLayout,
  PageHeader,
  EmptyState,
  QueryErrorState,
  AwaitingBackendBadge,
  DataTable,
  ColumnDef,
} from '../../components/admin';
import { Btn, ease } from '../../components/hq/ui';
import { useAuth } from '../../lib/auth';
import { hospitalAdminService } from '../../services/hospitalAdminService';
import type { Hospital, HospitalQueue, WebIncident } from '../../services/types';
import { FacilityOverview } from './FacilityOverview';
import { DepartmentManager } from './DepartmentManager';
import { QueueRoomManager } from './QueueRoomManager';
import { DoctorAssignment } from './DoctorAssignment';
import { ReceptionCounterManager } from './ReceptionCounterManager';
import { FacilityActivityLog } from './FacilityActivityLog';
import { ReportIncidentModal } from './ReportIncidentModal';
import { cn } from '../../lib/utils';

export type HospitalAdminTab =
  | 'overview'
  | 'departments'
  | 'queues'
  | 'doctors'
  | 'staff'
  | 'activity'
  | 'incidents'
  | 'settings';

export interface HospitalAdminDashboardProps {
  className?: string;
  defaultTab?: HospitalAdminTab;
}

/**
 * HospitalAdminDashboard
 * Primary multi-tenant console for Hospital Administrators.
 * Enforces strict backend identity isolation based on profile tokens,
 * never trusting client-supplied URL parameters.
 */
export const HospitalAdminDashboard: React.FC<HospitalAdminDashboardProps> = ({
  className,
  defaultTab = 'overview',
}) => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<HospitalAdminTab>(defaultTab);

  // Global Quick Action Modals
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showProvisionQueueModal, setShowProvisionQueueModal] = useState(false);
  const [selectedQueueForDoctor, setSelectedQueueForDoctor] = useState<HospitalQueue | null>(null);
  const [showReportIncidentModal, setShowReportIncidentModal] = useState(false);
  const [selectedDeptForQueues, setSelectedDeptForQueues] = useState<string | undefined>(undefined);

  // Local Incidents State
  const [incidents, setIncidents] = useState<WebIncident[]>(() => {
    try {
      const stored = localStorage.getItem('hqms_hospital_incidents');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Settings State
  const [operatingHours, setOperatingHours] = useState('08:00 - 20:00');
  const [chimeAudio, setChimeAudio] = useState('bell');
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ==========================================================================
  // Constraint 1: Hospital Isolation strictly relies on verified backend identity
  // ==========================================================================
  const verifiedHospitalId = useMemo(() => {
    if (!profile) return undefined;
    // 1. Direct hospitalId property on profile
    if ((profile as any).hospitalId) {
      return (profile as any).hospitalId as string;
    }
    // 2. Staff assignments hospitalId
    if (profile.staffAssignments && profile.staffAssignments.length > 0) {
      const assigned = profile.staffAssignments.find((a) => a.hospitalId);
      if (assigned?.hospitalId) {
        return assigned.hospitalId;
      }
    }
    return undefined;
  }, [profile]);

  // Query hospital facility data
  const {
    data: hospital,
    isLoading: isLoadingFacility,
    isError: isFacilityError,
    error: facilityError,
    refetch: refetchFacility,
    isRefetching: isRefetchingFacility,
  } = useQuery({
    queryKey: ['hospital-facility', verifiedHospitalId],
    queryFn: () => hospitalAdminService.fetchHospitalFacility(verifiedHospitalId),
    enabled: !authLoading,
    staleTime: 10000,
    retry: (failureCount, err: any) => {
      // Do not repeat client errors (401, 403, 404)
      if (err?.status && err.status >= 400 && err.status < 500) return false;
      return failureCount < 2; // Strict requirement: Avoid infinite automatic retries
    },
  });

  const handleIncidentReported = (newIncident: WebIncident) => {
    setIncidents((prev) => [newIncident, ...prev]);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Map tab identifier to AdminSidebar ID and vice versa
  const sidebarNavId = useMemo(() => {
    if (activeTab === 'doctors') return 'schedules';
    if (activeTab === 'staff') return 'counters';
    return activeTab;
  }, [activeTab]);

  const handleSidebarNavigate = (id: string) => {
    if (id === 'schedules') {
      setActiveTab('doctors');
    } else if (id === 'counters') {
      setActiveTab('staff');
    } else {
      setActiveTab(id as HospitalAdminTab);
    }
  };

  // Auth Loading Shell
  if (authLoading || (isLoadingFacility && !hospital)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Loading Operations Dashboard...
          </p>
          <p className="text-xs text-muted-foreground">
            Verifying facility credentials and loading clinical data.
          </p>
        </div>
      </div>
    );
  }

  // Facility Error or Not Found
  if (isFacilityError || !hospital) {
    const isNetwork = Boolean(
      (facilityError as any)?.isNetworkError ||
        (facilityError as any)?.code === 'BACKEND_CONNECTION_ERROR' ||
        (facilityError instanceof TypeError && facilityError.message.includes('fetch'))
    );

    // Genuine 404 is ONLY when the network request succeeds, but no facility belongs to this admin
    const isGenuineNotFound = !isFacilityError && !hospital;
    const resolvedStatus = isGenuineNotFound ? 404 : (facilityError as any)?.status;
    const resolvedCode = isGenuineNotFound ? 'FACILITY_NOT_FOUND' : (facilityError as any)?.code;

    return (
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center max-w-xl mx-auto space-y-4">
        <QueryErrorState
          statusCode={resolvedStatus}
          errorCode={resolvedCode}
          title={
            isNetwork
              ? 'Backend Connectivity Error'
              : isGenuineNotFound
              ? 'Hospital Facility Not Found'
              : undefined
          }
          message={
            isNetwork
              ? 'Unable to communicate with the healthcare server. Please check your network connection and verify server connectivity.'
              : isGenuineNotFound
              ? 'Could not resolve an authorized healthcare facility for your account. Please contact your system administrator.'
              : (facilityError as Error)?.message
          }
          error={facilityError}
          onRetry={() => {
            refetchFacility();
          }}
          isRetrying={isRefetchingFacility}
        />
        <div className="flex justify-center pt-2">
          <Btn variant="soft" size="sm" onClick={() => signOut()}>
            <LogOut className="size-3.5" /> Sign Out
          </Btn>
        </div>
      </div>
    );
  }

  const incidentColumns: ColumnDef<WebIncident>[] = [
    {
      key: 'title',
      header: 'Incident / Diagnostic Report',
      render: (inc) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-sm text-foreground block">
            {inc.title}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Component: {inc.component}
          </span>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (inc) => {
        const colors = {
          CRITICAL: 'bg-destructive/10 text-destructive',
          HIGH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          MEDIUM: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
          LOW: 'bg-muted text-muted-foreground',
        }[inc.severity] || 'bg-muted text-muted-foreground';

        return (
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', colors)}>
            {inc.severity}
          </span>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      render: (inc) => (
        <span className="text-xs font-mono text-muted-foreground">
          {inc.category}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inc) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {inc.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Reported At',
      render: (inc) => {
        const d = new Date(inc.createdAt);
        return (
          <span className="text-xs font-mono text-muted-foreground">
            {isNaN(d.getTime()) ? inc.createdAt : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
    },
  ];

  return (
    <AdminLayout
      role="hospital_admin"
      hospitalName={hospital.name}
      activeNavId={sidebarNavId}
      onNavigate={handleSidebarNavigate}
      incidentCount={incidents.filter((i) => i.status === 'OPEN').length}
      onLogout={() => signOut()}
      user={{
        name: profile?.name || user?.email?.split('@')[0] || 'Hospital Administrator',
        email: profile?.email || user?.email || 'admin@hospital.org',
        role: 'Hospital Administrator',
      }}
      topRightActions={
        <div className="flex items-center gap-2">
          <Btn
            variant="soft"
            size="sm"
            onClick={() => setShowReportIncidentModal(true)}
            className="text-xs rounded-xl"
          >
            <Bug className="size-3.5" />
            Report Issue
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => refetchFacility()}
            disabled={isRefetchingFacility}
            className="text-xs size-8 p-0 rounded-xl"
            title="Refresh Facility Topology"
          >
            <RefreshCw className={cn('size-3.5', isRefetchingFacility && 'animate-spin')} />
          </Btn>
        </div>
      }
      className={className}
    >
      <div className="space-y-6">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <FacilityOverview
            hospital={hospital}
            isLoading={isLoadingFacility}
            onRefresh={() => {
              refetchFacility();
            }}
            isRefreshing={isRefetchingFacility}
            onNavigateTab={(tab) => handleSidebarNavigate(tab)}
            onOpenAddDepartment={() => {
              setActiveTab('departments');
            }}
            onOpenProvisionQueue={() => {
              setActiveTab('queues');
            }}
          />
        )}

        {/* Tab 2: Departments */}
        {activeTab === 'departments' && (
          <DepartmentManager
            hospital={hospital}
            isLoading={isLoadingFacility}
            onRefresh={() => {
              refetchFacility();
            }}
            isRefreshing={isRefetchingFacility}
            onNavigateToQueues={(deptId) => {
              setSelectedDeptForQueues(deptId);
              setActiveTab('queues');
            }}
            onDepartmentCreated={() => {
              refetchFacility();
            }}
          />
        )}

        {/* Tab 3: Queues & Consultation Rooms */}
        {activeTab === 'queues' && (
          <QueueRoomManager
            hospital={hospital}
            selectedDepartmentId={selectedDeptForQueues}
            isLoading={isLoadingFacility}
            onRefresh={() => {
              refetchFacility();
            }}
            isRefreshing={isRefetchingFacility}
            onQueueCreated={() => {
              refetchFacility();
            }}
            onOpenAssignDoctor={(queue) => {
              setSelectedQueueForDoctor(queue);
              setActiveTab('doctors');
            }}
          />
        )}

        {/* Tab 4: Doctor Assignment & Roster */}
        {activeTab === 'doctors' && (
          <DoctorAssignment
            hospital={hospital}
            initialSelectedQueue={selectedQueueForDoctor}
            isLoading={isLoadingFacility}
            onRefresh={() => {
              refetchFacility();
            }}
            isRefreshing={isRefetchingFacility}
            onAssignmentChanged={() => {
              refetchFacility();
            }}
          />
        )}

        {/* Tab 5: Staff & Reception Counters */}
        {activeTab === 'staff' && (
          <ReceptionCounterManager
            hospital={hospital}
            isLoading={isLoadingFacility}
            onRefresh={() => {
              refetchFacility();
            }}
            isRefreshing={isRefetchingFacility}
          />
        )}

        {/* Tab 6: Facility Activity Stream */}
        {activeTab === 'activity' && <FacilityActivityLog hospital={hospital} />}

        {/* Tab 7: Incident Diagnostics */}
        {activeTab === 'incidents' && (
          <div className="space-y-6">
            <PageHeader
              eyebrow="FACILITY TELEMETRY & DIAGNOSTICS"
              title="Incident Log & Bug Reports"
              subtitle={`Track hardware anomalies, thermal printer errors, and queue desync issues reported by staff at ${hospital.name}.`}
              badge={
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {incidents.length} Logged Issues
                </span>
              }
              actions={
                <Btn
                  variant="ink"
                  size="sm"
                  onClick={() => setShowReportIncidentModal(true)}
                  className="rounded-xl font-medium shadow-xs"
                >
                  <Bug className="size-3.5" />
                  Report New Incident
                </Btn>
              }
            />

            <DataTable
              columns={incidentColumns}
              data={incidents}
              keyExtractor={(item) => item.id}
              emptyTitle="No Facility Incidents Reported"
              emptyDescription="No UI glitches or hardware printer errors have been logged for this facility."
              emptyAction={
                <Btn size="sm" onClick={() => setShowReportIncidentModal(true)} className="rounded-xl">
                  <Bug className="size-3.5" /> Report Incident
                </Btn>
              }
            />
          </div>
        )}

        {/* Tab 8: Facility Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <PageHeader
              eyebrow="TENANT CONFIGURATION"
              title="Facility Preferences & Hardware Settings"
              subtitle={`Configure operational defaults, queue audio chimes, and printer specifications for ${hospital.name}.`}
            />

            <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
              {/* Facility Identity Card */}
              <div className="surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-semibold text-foreground">
                    Verified Multi-Tenant Identity
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-muted-foreground block mb-1">Hospital Name</label>
                    <input
                      type="text"
                      disabled
                      value={hospital.name}
                      className="h-10 w-full rounded-xl border border-input bg-muted/50 px-3 font-medium text-foreground cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Facility Tenant ID</label>
                    <input
                      type="text"
                      disabled
                      value={hospital.id}
                      className="h-10 w-full rounded-xl border border-input bg-muted/50 px-3 font-mono text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Operating Preferences */}
              <div className="surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">
                    Operating & Display Preferences
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-foreground font-medium block mb-1.5">
                      Daily Operating Hours
                    </label>
                    <input
                      type="text"
                      value={operatingHours}
                      onChange={(e) => setOperatingHours(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="text-foreground font-medium block mb-1.5">
                      Waiting TV Audio Chime
                    </label>
                    <select
                      value={chimeAudio}
                      onChange={(e) => setChimeAudio(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                    >
                      <option value="bell">Two-Tone Soft Chime (D5 / A5)</option>
                      <option value="airport">Airport Attention Gong</option>
                      <option value="digital">Modern Digital Beep</option>
                      <option value="silent">Muted (Zero Audio)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="auto-advance"
                    checked={autoAdvanceEnabled}
                    onChange={(e) => setAutoAdvanceEnabled(e.target.checked)}
                    className="size-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <label htmlFor="auto-advance" className="text-xs text-foreground select-none">
                    Automatically complete and advance previous token when doctor calls next patient
                  </label>
                </div>
              </div>

              {/* Hardware & Printer Station Configuration */}
              <div className="surface p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
                <div className="flex items-center gap-2">
                  <Printer className="size-4 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">
                    Thermal Slip Printer Profile
                  </h3>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Receipt Paper: 80mm ESC/POS Direct Thermal</p>
                  <p>QR Code Barcode: UHID Encoded (ISO/IEC 18004)</p>
                  <p>Driver Mode: WebUSB / Raw IP Network LPR Spooler</p>
                </div>
              </div>

              {settingsSaved && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                  Facility preferences saved to local console state.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Btn type="submit" variant="ink" size="sm" className="rounded-xl">
                  Save Facility Preferences
                </Btn>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Global Report Incident Modal */}
      <ReportIncidentModal
        open={showReportIncidentModal}
        onClose={() => setShowReportIncidentModal(false)}
        hospitalName={hospital.name}
        onIncidentReported={handleIncidentReported}
      />
    </AdminLayout>
  );
};
