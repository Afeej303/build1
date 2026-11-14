import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Eye,
  ExternalLink,
  Layers,
  Users,
  Calendar,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader, StatCard, DataTable, FilterBar, Pagination, EmptyState, QueryErrorState, DetailDrawer } from '../../components/admin';
import type { ColumnDef } from '../../components/admin';
import { Btn, ease } from '../../components/hq/ui';
import { superAdminService } from '../../services/superAdminService';
import type { Hospital, Department, StaffUser } from '../../services/types';
import { HospitalOnboardModal } from './HospitalOnboardModal';

export function HospitalDirectory() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Drawers
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadHospitals = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const data = await superAdminService.fetchHospitals();
      setHospitals(data);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHospitals(true);
  };

  // Filtered & Searched Data
  const filteredHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.address && h.address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (!h.status || h.status === 'ACTIVE')) ||
        (statusFilter === 'inactive' && h.status === 'INACTIVE');

      return matchesSearch && matchesStatus;
    });
  }, [hospitals, searchQuery, statusFilter]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHospitals.slice(start, start + pageSize);
  }, [filteredHospitals, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredHospitals.length / pageSize));

  // Columns definition for DataTable
  const columns: ColumnDef<Hospital>[] = [
    {
      key: 'name',
      header: 'Hospital Name',
      sortable: true,
      render: (h) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </div>
          <div>
            <div className="font-semibold text-foreground">{h.name}</div>
            {h.address && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate max-w-[220px]">{h.address}</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Hospital ID',
      width: '180px',
      render: (h) => (
        <code className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground border border-border/50">
          {h.id.length > 16 ? `${h.id.slice(0, 14)}…` : h.id}
        </code>
      ),
    },
    {
      key: 'adminsCount',
      header: 'Admins',
      align: 'center',
      width: '110px',
      render: (h) => {
        const count = Array.isArray(h.admins) ? h.admins.length : 0;
        return (
          <span className="inline-flex items-center gap-1 font-medium text-xs text-foreground">
            <ShieldCheck className="size-3.5 text-muted-foreground" />
            {count}
          </span>
        );
      },
    },
    {
      key: 'departmentsCount',
      header: 'Departments',
      align: 'center',
      width: '130px',
      render: (h) => {
        const count = Array.isArray(h.departments) ? h.departments.length : 0;
        return (
          <span className="inline-flex items-center gap-1 font-medium text-xs text-foreground">
            <Layers className="size-3.5 text-muted-foreground" />
            {count}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Registered',
      width: '150px',
      render: (h) => {
        const dateStr = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'N/A';
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {dateStr}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '130px',
      render: (h) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedHospital(h);
          }}
          className="press inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Eye className="size-3.5" />
          <span>Details</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Hospital Directory"
        subtitle="Manage registered multi-tenant healthcare facilities, departments, and administrative governance."
        eyebrow="Platform Governance"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        actions={
          <Btn
            variant="primary"
            size="md"
            onClick={() => setOnboardModalOpen(true)}
          >
            <Plus className="size-4" />
            <span>Onboard Hospital</span>
          </Btn>
        }
      />

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search hospitals by name, ID, or campus..."
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Active Facilities', value: 'active' },
              { label: 'Inactive / Archived', value: 'inactive' },
            ],
            onChange: (val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            },
          },
        ]}
        onReset={() => {
          setSearchQuery('');
          setStatusFilter('all');
          setCurrentPage(1);
        }}
        extraActions={
          <span className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filteredHospitals.length}</strong> of{' '}
            <strong className="text-foreground">{hospitals.length}</strong> facilities
          </span>
        }
      />

      {/* Error state */}
      {error ? (
        <QueryErrorState
          error={error}
          title="Failed to Load Hospitals"
          onRetry={() => loadHospitals()}
        />
      ) : (
        /* Data Table */
        <div className="space-y-4">
          <DataTable<Hospital>
            columns={columns}
            data={paginatedData}
            keyExtractor={(h) => h.id}
            isLoading={isLoading}
            onRowClick={(h) => setSelectedHospital(h)}
            emptyTitle="No Hospitals Matching Criteria"
            emptyDescription="We couldn't find any healthcare facilities matching your search query or filter selection."
            emptyIcon={Building2}
            emptyAction={
              <Btn
                variant="primary"
                size="sm"
                onClick={() => setOnboardModalOpen(true)}
              >
                <Plus className="size-3.5" />
                <span>Onboard New Hospital</span>
              </Btn>
            }
          />

          {/* Pagination */}
          {!isLoading && filteredHospitals.length > pageSize && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredHospitals.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Hospital Onboarding Modal */}
      <HospitalOnboardModal
        open={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        onSuccess={(createdHospital) => {
          setHospitals((prev) => [createdHospital, ...prev]);
          setSelectedHospital(createdHospital);
        }}
      />

      {/* Detail Drawer for Inspecting Hospital */}
      <DetailDrawer
        open={Boolean(selectedHospital)}
        onClose={() => setSelectedHospital(null)}
        title={selectedHospital?.name || 'Hospital Details'}
        subtitle={selectedHospital ? `ID: ${selectedHospital.id}` : undefined}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" />
            Active Facility
          </span>
        }
        width="lg"
      >
        {selectedHospital && (
          <div className="space-y-6">
            {/* Metadata Summary */}
            <div className="surface rounded-2xl p-4 space-y-3 bg-muted/20 border border-border/70">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Facility Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Facility ID:</span>
                  <code className="font-mono text-foreground font-semibold">
                    {selectedHospital.id}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground block">Onboarded:</span>
                  <span className="text-foreground">
                    {selectedHospital.createdAt
                      ? new Date(selectedHospital.createdAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                {selectedHospital.address && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block">Address:</span>
                    <span className="text-foreground">{selectedHospital.address}</span>
                  </div>
                )}
                {selectedHospital.contactEmail && (
                  <div>
                    <span className="text-muted-foreground block">Contact Email:</span>
                    <span className="text-foreground">{selectedHospital.contactEmail}</span>
                  </div>
                )}
                {selectedHospital.contactPhone && (
                  <div>
                    <span className="text-muted-foreground block">Contact Phone:</span>
                    <span className="text-foreground">{selectedHospital.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Departments Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  Clinical Departments (
                  {Array.isArray(selectedHospital.departments)
                    ? selectedHospital.departments.length
                    : 0}
                  )
                </h4>
              </div>

              {Array.isArray(selectedHospital.departments) &&
              selectedHospital.departments.length > 0 ? (
                <div className="divide-y divide-border/60 rounded-2xl border border-border bg-card/60 overflow-hidden">
                  {selectedHospital.departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-3 text-xs hover:bg-muted/40 transition-colors"
                    >
                      <div>
                        <span className="font-medium text-foreground">{dept.name}</span>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          ID: {dept.id}
                        </div>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {dept.queues?.length || 0} Queues
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground bg-muted/10">
                  No departments provisioned yet for this facility.
                </div>
              )}
            </div>

            {/* Hospital Admins Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" />
                  Assigned Hospital Administrators (
                  {Array.isArray(selectedHospital.admins)
                    ? selectedHospital.admins.length
                    : 0}
                  )
                </h4>
              </div>

              {Array.isArray(selectedHospital.admins) &&
              selectedHospital.admins.length > 0 ? (
                <div className="divide-y divide-border/60 rounded-2xl border border-border bg-card/60 overflow-hidden">
                  {selectedHospital.admins.map((adm) => (
                    <div
                      key={adm.id}
                      className="flex items-center justify-between p-3 text-xs"
                    >
                      <div>
                        <div className="font-medium text-foreground">{adm.name}</div>
                        <div className="text-[11px] text-muted-foreground">{adm.email}</div>
                      </div>
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                        Admin
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground bg-muted/10">
                  No dedicated hospital admins assigned to this facility.
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
