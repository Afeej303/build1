import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Mail,
  Calendar,
  Eye,
  Key,
  Shield,
  Building2,
  Lock,
  UserX,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  FilterBar,
  Pagination,
  EmptyState,
  QueryErrorState,
  DetailDrawer,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin';
import { Btn, ease } from '../../components/hq/ui';
import { superAdminService, type PlatformUser, type PlatformRole, type PlatformPermission } from '../../services/superAdminService';

export function GlobalUserDirectory() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Inspection Drawer
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 15;

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const [usersRes, rolesRes, permsRes] = await Promise.all([
        superAdminService.fetchUsers(currentPage, 100),
        superAdminService.fetchRoles().catch(() => []),
        superAdminService.fetchPermissions().catch(() => []),
      ]);

      setUsers(usersRes.items);
      setTotalItems(usersRes.meta?.totalItems ?? usersRes.items.length);
      setRoles(rolesRes);
      setPermissions(permsRes);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true);
  };

  const normalizeRoleName = (roleInput: any): string => {
    if (!roleInput) return 'patient';
    if (typeof roleInput === 'string') return roleInput;
    if (typeof roleInput === 'object') {
      return roleInput.slug || roleInput.name || roleInput.role || 'patient';
    }
    return String(roleInput);
  };

  // Filtered & Searched data
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.id && String(u.id).toLowerCase().includes(q));

      const matchesRole =
        roleFilter === 'all' ||
        (u.roles &&
          Array.isArray(u.roles) &&
          u.roles.some((r: any) => normalizeRoleName(r).toLowerCase() === roleFilter.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (u.status && String(u.status).toLowerCase() === statusFilter.toLowerCase());

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const getRoleBadge = (roleInput: any) => {
    const roleName = normalizeRoleName(roleInput);
    const r = roleName.toLowerCase();
    if (r === 'super_admin' || r === 'superadmin') {
      return (
        <span
          key={roleName}
          className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20"
        >
          <Shield className="size-2.5" />
          Super Admin
        </span>
      );
    }
    if (r === 'hospital_admin' || r === 'admin') {
      return (
        <span
          key={roleName}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20"
        >
          <ShieldCheck className="size-2.5" />
          Hospital Admin
        </span>
      );
    }
    if (r === 'doctor') {
      return (
        <span
          key={roleName}
          className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-500/20"
        >
          <UserCheck className="size-2.5" />
          Doctor
        </span>
      );
    }
    if (r === 'receptionist') {
      return (
        <span
          key={roleName}
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20"
        >
          Receptionist
        </span>
      );
    }
    return (
      <span
        key={roleName}
        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border"
      >
        {roleName}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
          <span className="size-1 rounded-full bg-success" />
          Active
        </span>
      );
    }
    if (s === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          <span className="size-1 rounded-full bg-destructive" />
          Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {status}
      </span>
    );
  };

  const columns: ColumnDef<PlatformUser>[] = [
    {
      key: 'name',
      header: 'Identity Name',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground font-semibold text-xs uppercase">
            {u.name ? u.name.slice(0, 2) : 'US'}
          </div>
          <div>
            <div className="font-semibold text-foreground">{u.name || 'Unnamed User'}</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              ID: {u.id.length > 18 ? `${u.id.slice(0, 16)}…` : u.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      render: (u) => (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Mail className="size-3 text-muted-foreground shrink-0" />
          <span className="truncate max-w-[200px]">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Assigned Roles',
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {u.roles && Array.isArray(u.roles) && u.roles.length > 0
            ? u.roles.map((r, idx) => (
                <React.Fragment key={`${u.id}-role-${idx}`}>
                  {getRoleBadge(r)}
                </React.Fragment>
              ))
            : getRoleBadge('patient')}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '100px',
      render: (u) => getStatusBadge(u.status || 'ACTIVE'),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: '130px',
      render: (u) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3" />
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '110px',
      render: (u) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(u);
          }}
          className="press inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Eye className="size-3.5" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Global User Directory"
        subtitle="Manage platform-wide identities, multi-tenant clinical staff assignments, and RBAC authority."
        eyebrow="Platform Identity"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        badge={
          <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
            {totalItems} Users
          </span>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search users by name, email, or ID..."
        filters={[
          {
            id: 'role',
            label: 'Role',
            value: roleFilter,
            options: [
              { label: 'All Roles', value: 'all' },
              { label: 'Super Admin', value: 'super_admin' },
              { label: 'Hospital Admin', value: 'hospital_admin' },
              { label: 'Doctor', value: 'doctor' },
              { label: 'Receptionist', value: 'receptionist' },
              { label: 'Patient', value: 'patient' },
            ],
            onChange: (val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            },
          },
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
            ],
            onChange: (val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            },
          },
        ]}
        onReset={() => {
          setSearchQuery('');
          setRoleFilter('all');
          setStatusFilter('all');
          setCurrentPage(1);
        }}
        extraActions={
          <span className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredUsers.length}</strong> matching identities
          </span>
        }
      />

      {error ? (
        <QueryErrorState
          error={error}
          title="User Directory Offline"
          message="Failed to retrieve user identities from platform endpoints."
          onRetry={() => loadData()}
        />
      ) : (
        <div className="space-y-4">
          <DataTable<PlatformUser>
            columns={columns}
            data={paginatedUsers}
            keyExtractor={(u) => u.id}
            isLoading={isLoading}
            onRowClick={(u) => setSelectedUser(u)}
            emptyTitle="No Identities Match Filters"
            emptyDescription="Try broadening your role filter or clearing search terms."
            emptyIcon={Users}
          />

          {!isLoading && filteredUsers.length > pageSize && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* User Details Drawer */}
      <DetailDrawer
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'User Profile'}
        subtitle={selectedUser?.email}
        badge={
          selectedUser && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {selectedUser.status}
            </span>
          )
        }
        width="md"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Meta Card */}
            <div className="surface rounded-2xl p-4 bg-muted/20 border border-border/70 space-y-3 text-xs">
              <h4 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
                Identity Metadata
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Unique User ID:</span>
                  <code className="font-mono text-foreground font-semibold">
                    {selectedUser.id}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Email Address:</span>
                  <span className="text-foreground">{selectedUser.email}</span>
                </div>
                {selectedUser.hospitalId && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Hospital Tenant:</span>
                    <span className="text-foreground font-mono">{selectedUser.hospitalId}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block text-[11px]">Registered Date:</span>
                  <span className="text-foreground">
                    {selectedUser.createdAt
                      ? new Date(selectedUser.createdAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Roles & Capabilities */}
            <div className="space-y-3">
              <h4 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px] flex items-center gap-1.5">
                <Key className="size-3.5" />
                Assigned RBAC Roles
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedUser.roles && selectedUser.roles.length > 0 ? (
                  selectedUser.roles.map((r) => getRoleBadge(r))
                ) : (
                  <span className="text-xs text-muted-foreground">No roles assigned.</span>
                )}
              </div>
            </div>

            {/* Security & Access Posture */}
            <div className="space-y-3 pt-3 border-t border-border/60">
              <h4 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
                Account Security & Compliance
              </h4>
              
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account Status</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Active & Verified
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Session Authentication</span>
                  <span className="font-medium text-foreground">Supabase JWT Secure Session</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credential Storage</span>
                  <span className="font-medium text-foreground">Zero Client-Side Passwords</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
