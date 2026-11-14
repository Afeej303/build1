import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  AlertTriangle,
  Settings,
  Network,
  ListOrdered,
  CalendarClock,
  UserCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease, Logo } from '../hq/ui';

export type AdminRole = 'super_admin' | 'hospital_admin';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'danger' | 'warning';
}

export const SUPER_ADMIN_NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '/admin' },
  { id: 'hospitals', label: 'Hospitals', icon: Building2, href: '/admin/hospitals' },
  { id: 'users', label: 'Users & Roles', icon: Users, href: '/admin/users' },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText, href: '/admin/audit' },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle, href: '/admin/incidents' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
];

export const HOSPITAL_ADMIN_NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '/admin' },
  { id: 'departments', label: 'Departments', icon: Network, href: '/admin/departments' },
  { id: 'queues', label: 'Queues & Rooms', icon: ListOrdered, href: '/admin/queues' },
  { id: 'schedules', label: 'Doctors & Schedules', icon: CalendarClock, href: '/admin/schedules' },
  { id: 'counters', label: 'Staff & Counters', icon: UserCheck, href: '/admin/counters' },
  { id: 'activity', label: 'Activity Log', icon: Activity, href: '/admin/activity' },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle, href: '/admin/incidents' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
];

export interface AdminSidebarProps {
  role: AdminRole;
  activeId?: string;
  onSelect?: (id: string, item: NavItemConfig) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  hospitalName?: string;
  incidentCount?: number;
  className?: string;
  customItems?: NavItemConfig[];
}

/**
 * AdminSidebar
 * Role-aware administrative sidebar supporting Super Admin and Hospital Admin navigation links,
 * active indicator animations, collapsible state, and badge counters.
 */
export function AdminSidebar({
  role,
  activeId = 'overview',
  onSelect,
  collapsed = false,
  onToggleCollapse,
  hospitalName,
  incidentCount,
  className,
  customItems,
}: AdminSidebarProps) {
  const baseItems = customItems || (role === 'super_admin' ? SUPER_ADMIN_NAV_ITEMS : HOSPITAL_ADMIN_NAV_ITEMS);

  // Inject dynamic incident badge if supplied
  const items = baseItems.map((item) => {
    if (item.id === 'incidents' && incidentCount !== undefined && incidentCount > 0) {
      return {
        ...item,
        badge: incidentCount,
        badgeVariant: 'danger' as const,
      };
    }
    return item;
  });

  return (
    <aside
      aria-label="Admin Sidebar"
      className={cn(
        'surface glass relative flex h-full flex-col border-r border-border/70 bg-card/80 transition-all duration-300',
        collapsed ? 'w-18' : 'w-64',
        className
      )}
    >
      {/* Brand & Role Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/70 px-3.5">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Logo className="text-sm shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {role === 'super_admin' ? 'Super Admin' : 'Hospital Admin'}
                </span>
                {hospitalName && role === 'hospital_admin' && (
                  <span className="text-xs font-medium text-foreground truncate">
                    {hospitalName}
                  </span>
                )}
              </div>
            </div>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="press rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="press flex items-center justify-center size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="size-4.5" />
              </button>
            ) : (
              <span className="grid size-8 place-items-center rounded-lg bg-ink text-ink-foreground">
                <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
                  <path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z" />
                </svg>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav aria-label="Admin Navigation" className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id, item)}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'press group relative flex w-full items-center rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none',
                collapsed ? 'justify-center' : 'justify-between',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon
                  className={cn(
                    'size-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!collapsed && item.badge !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : item.badgeVariant === 'danger'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {item.badge}
                </span>
              )}

              {/* Active Indicator Bar on Collapsed View */}
              {collapsed && isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Toggle */}
      <div className="border-t border-border/70 p-2.5">
        {collapsed ? (
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="press flex w-full items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              title="Expand sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="size-4" />
            </button>
          )
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-2 border border-border/50 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2 truncate">
              {role === 'super_admin' ? (
                <ShieldCheck className="size-4 text-primary shrink-0" />
              ) : (
                <Building className="size-4 text-primary shrink-0" />
              )}
              <div className="flex flex-col truncate">
                <span className="font-semibold text-foreground truncate">
                  {role === 'super_admin' ? 'Multi-Tenant Root' : 'Tenant Admin'}
                </span>
                <span className="truncate text-[10px]">HQMS v1.0 Admin Console</span>
              </div>
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="press rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none cursor-pointer"
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
