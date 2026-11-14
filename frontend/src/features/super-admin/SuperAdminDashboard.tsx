import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Server,
  Database,
  Key,
  CreditCard,
  Flag,
  Archive,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { AdminLayout, PageHeader, Breadcrumbs } from '../../components/admin';
import { PlatformOverview } from './PlatformOverview';
import { HospitalDirectory } from './HospitalDirectory';
import { GlobalUserDirectory } from './GlobalUserDirectory';
import { SystemAuditLog } from './SystemAuditLog';
import { WebIncidentHub } from './WebIncidentHub';

export type SuperAdminTab = 'overview' | 'hospitals' | 'users' | 'audit' | 'incidents' | 'settings';

export function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');

  const tabLabels: Record<SuperAdminTab, string> = {
    overview: 'Operations Overview',
    hospitals: 'Hospital Directory',
    users: 'Platform Identities',
    audit: 'System Audit Logs',
    incidents: 'Incident Triage',
    settings: 'Platform Settings',
  };

  const breadcrumbs = [
    { label: 'Super Admin', href: '#', onClick: () => setActiveTab('overview') },
    { label: tabLabels[activeTab] },
  ];

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = '/staff-login';
  };

  return (
    <AdminLayout
      role="super_admin"
      hospitalName="HQMS Global Operations"
      activeNavId={activeTab}
      onNavigate={(id) => setActiveTab(id as SuperAdminTab)}
      onLogout={handleLogout}
      user={{
        name: 'Super Administrator',
        email: 'superadmin@hqms.health',
        role: 'super_admin',
      }}
    >
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Breadcrumb Navigation */}
        <div className="mb-2">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        {/* Tab Views */}
        {activeTab === 'overview' && (
          <PlatformOverview onNavigate={(id) => setActiveTab(id as SuperAdminTab)} />
        )}

        {activeTab === 'hospitals' && <HospitalDirectory />}

        {activeTab === 'users' && <GlobalUserDirectory />}

        {activeTab === 'audit' && <SystemAuditLog />}

        {activeTab === 'incidents' && <WebIncidentHub />}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <PageHeader
              title="Platform Settings & Governance"
              subtitle="Global architecture configuration, multi-tenant subscription tiers, feature flags, and backup protocol."
              eyebrow="Platform Configuration"
            />

            {/* Platform Core Configuration */}
            <div className="surface rounded-2xl p-6 border border-border/80 bg-card/70 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Server className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Core Architecture</h3>
                  <p className="text-xs text-muted-foreground">Runtime infrastructure environment</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-muted-foreground block text-[11px]">System Release:</span>
                  <span className="font-mono font-semibold text-foreground">HQMS Enterprise v1.0.0</span>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Authentication Provider:</span>
                  <span className="font-semibold text-foreground">Supabase Multi-Tenant Auth & JWT</span>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Primary Database:</span>
                  <span className="font-semibold text-foreground">PostgreSQL 15 (RLS Protected)</span>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Event Broadcast:</span>
                  <span className="font-semibold text-foreground">WebSocket Live Queue Feeds</span>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Security Posture:</span>
                  <span className="font-semibold text-success flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> High / Zero Password Bundling
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Audit Retention:</span>
                  <span className="font-semibold text-foreground">Immutable Append-Only Log</span>
                </div>
              </div>
            </div>

            {/* Governance & Extended Services */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Enterprise Governance & Policies
              </h3>

              <div className="space-y-4">
                {/* Subscription & Billing */}
                <div className="surface rounded-2xl p-6 border border-border/80 bg-card/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <CreditCard className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Multi-Tenant Licensing & Subscriptions
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Tiered hospital licensing, counter quotas, and API consumption metering.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-500/20">
                      Enterprise Tier Active
                    </span>
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="surface rounded-2xl p-6 border border-border/80 bg-card/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Flag className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Platform Feature Flags & Toggles
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Dynamic rollout of notifications, automated voice calling, and biometric check-ins.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Policy Engine Online
                    </span>
                  </div>
                </div>

                {/* Backup & Disaster Recovery */}
                <div className="surface rounded-2xl p-6 border border-border/80 bg-card/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Archive className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Automated Backup & Disaster Recovery (DR)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Cross-region encrypted snapshot management and one-click database rollback.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-500/20">
                      Automated Snapshots Daily
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
