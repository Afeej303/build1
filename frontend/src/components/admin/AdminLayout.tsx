import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut,
  Building2,
  ShieldCheck,
  ChevronDown,
  User as UserIcon,
  Bell,
  LayoutDashboard,
  Users,
  ScrollText,
  AlertTriangle,
  Settings,
  Network,
  ListOrdered,
  CalendarClock,
  UserCheck,
  Activity,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease } from '../hq/ui';
import { AdminSidebar, AdminRole, SUPER_ADMIN_NAV_ITEMS, HOSPITAL_ADMIN_NAV_ITEMS } from './AdminSidebar';

export interface AdminUser {
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}

export interface AdminLayoutProps {
  role: AdminRole;
  hospitalName?: string;
  children: React.ReactNode;
  user?: AdminUser;
  onLogout?: () => void;
  activeNavId?: string;
  onNavigate?: (id: string) => void;
  topRightActions?: React.ReactNode;
  incidentCount?: number;
  className?: string;
}

/**
 * AdminLayout
 * Unified administrative shell providing:
 * - Desktop: Collapsible sidebar navigation (lg:block)
 * - Mobile: Modern floating pill dock with all section tabs (lg:hidden) - NO redundant drawer
 * - Top bar: Tenant badge, live system indicator, and opaque user menu popover
 */
export function AdminLayout({
  role,
  hospitalName = 'City General Hospital',
  children,
  user = {
    name: role === 'super_admin' ? 'Super Administrator' : 'Hospital Administrator',
    email: role === 'super_admin' ? 'superadmin@hqms.health' : 'admin@hospital.org',
  },
  onLogout,
  activeNavId = 'overview',
  onNavigate,
  topRightActions,
  incidentCount,
  className,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Configure mobile navigation items based on role
  const mobileNavConfig = React.useMemo(() => {
    if (role === 'super_admin') {
      const primary = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'hospitals', label: 'Hospitals', icon: Building2 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'audit', label: 'Logs', icon: ScrollText },
      ];
      const secondary = [
        { id: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: incidentCount },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
      return { primary, secondary };
    }

    // Hospital Admin
    const primary = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'departments', label: 'Depts', icon: Network },
      { id: 'queues', label: 'Queues', icon: ListOrdered },
      { id: 'doctors', label: 'Doctors', icon: CalendarClock },
    ];
    const secondary = [
      { id: 'staff', label: 'Staff & Counters', icon: UserCheck },
      { id: 'activity', label: 'Activity Log', icon: Activity },
      { id: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: incidentCount },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];
    return { primary, secondary };
  }, [role, incidentCount]);

  const isSecondaryActive = mobileNavConfig.secondary.some((s) => s.id === activeNavId);
  const activeSecondaryItem = mobileNavConfig.secondary.find((s) => s.id === activeNavId);

  return (
    <div className={cn('min-h-screen bg-background text-foreground flex', className)}>
      {/* Desktop Sidebar (Only on large screens) */}
      <div className="hidden lg:block shrink-0">
        <div className="sticky top-0 h-screen">
          <AdminSidebar
            role={role}
            activeId={activeNavId}
            onSelect={(id) => onNavigate?.(id)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            hospitalName={hospitalName}
            incidentCount={incidentCount}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Frosted Glass Top Navigation Bar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hospital / Tenant Badge */}
            {role === 'hospital_admin' ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-foreground shadow-xs">
                <Building2 className="size-3.5 text-primary" />
                <span className="truncate max-w-[170px] sm:max-w-xs">{hospitalName}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-foreground shadow-xs">
                <ShieldCheck className="size-3.5 text-primary" />
                <span className="font-semibold text-xs sm:text-sm">HQMS Operations Center</span>
              </div>
            )}
          </div>

          {/* Right Header Navigation Items */}
          <div className="flex items-center gap-3">
            {/* Live Status Indicator */}
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-success/30 bg-success-soft/70 px-2.5 py-1 text-[11px] font-medium text-success">
              <span className="pulse-dot size-1.5 rounded-full bg-success" />
              <span>Live System</span>
            </div>

            {topRightActions}

            {/* User Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="press flex items-center gap-2 rounded-full border border-border bg-card p-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="User account menu"
              >
                <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline-block truncate max-w-[120px] font-medium">
                  {user.name}
                </span>
                <ChevronDown className="hidden sm:inline size-3.5 text-muted-foreground" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease }}
                      className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-border/80 bg-card/98 p-2 shadow-2xl backdrop-blur-xl"
                    >
                      <div className="px-3 py-2 border-b border-border/60">
                        <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {role}
                        </span>
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onLogout?.();
                          }}
                          className="press flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive cursor-pointer"
                        >
                          <LogOut className="size-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Body (with bottom padding on mobile so floating bar never covers content) */}
        <main className="flex-1 min-w-0 pb-28 lg:pb-8">{children}</main>
      </div>

      {/* Mobile Floating Navigation Bar (lg:hidden) - Completely replaces mobile drawer */}
      <nav
        aria-label="Admin Navigation"
        className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="relative flex items-center gap-1.5 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]">
          {/* Primary Tabs */}
          {mobileNavConfig.primary.map((item) => {
            const isActive = activeNavId === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setMoreMenuOpen(false);
                  onNavigate?.(item.id);
                }}
                className="relative flex items-center justify-center rounded-full transition-colors cursor-pointer focus:outline-none"
                style={{ minHeight: '44px' }}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-mobile-nav-active-pill"
                    className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/20 dark:border-primary/30"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                <div
                  className={`relative z-10 flex items-center gap-1.5 px-3 py-2 transition-colors ${
                    isActive
                      ? 'text-primary dark:text-primary font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2.5'
                  }`}
                >
                  <Icon
                    className={`size-[18px] transition-transform ${
                      isActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                  />
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, width: 0, x: -4 }}
                        animate={{ opacity: 1, width: 'auto', x: 0 }}
                        exit={{ opacity: 0, width: 0, x: -4 }}
                        transition={{ duration: 0.2, ease }}
                        className="text-xs font-semibold tracking-tight whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            );
          })}

          {/* 'More' Button (Opens remaining sections in a sleek floating menu) */}
          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="relative flex items-center justify-center rounded-full transition-colors cursor-pointer focus:outline-none"
              style={{ minHeight: '44px' }}
              aria-label="More admin sections"
            >
              {isSecondaryActive && (
                <motion.div
                  layoutId="admin-mobile-nav-active-pill"
                  className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/20 dark:border-primary/30"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}

              <div
                className={`relative z-10 flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  isSecondaryActive
                    ? 'text-primary dark:text-primary font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2.5'
                }`}
              >
                <MoreHorizontal
                  className={`size-[18px] transition-transform ${
                    isSecondaryActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
                <AnimatePresence initial={false}>
                  {isSecondaryActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0, x: -4 }}
                      animate={{ opacity: 1, width: 'auto', x: 0 }}
                      exit={{ opacity: 0, width: 0, x: -4 }}
                      transition={{ duration: 0.2, ease }}
                      className="text-xs font-semibold tracking-tight whitespace-nowrap overflow-hidden"
                    >
                      {activeSecondaryItem?.label || 'More'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </button>

            {/* More Sections Popover Menu */}
            <AnimatePresence>
              {moreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
                    onClick={() => setMoreMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.18, ease }}
                    className="absolute bottom-full right-0 mb-3 w-56 rounded-2xl border border-border/90 bg-card/98 p-2 shadow-2xl backdrop-blur-xl z-50 space-y-1"
                  >
                    <div className="px-3 py-1.5 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>Additional Sections</span>
                      <button
                        onClick={() => setMoreMenuOpen(false)}
                        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {mobileNavConfig.secondary.map((sec) => {
                      const SecIcon = sec.icon;
                      const isSecActive = activeNavId === sec.id;
                      return (
                        <button
                          key={sec.id}
                          onClick={() => {
                            setMoreMenuOpen(false);
                            onNavigate?.(sec.id);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                            isSecActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground hover:bg-muted/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SecIcon className="size-4 shrink-0" />
                            <span>{sec.label}</span>
                          </div>
                          {sec.badge !== undefined && Number(sec.badge) > 0 && (
                            <span className="rounded-full bg-destructive/15 text-destructive font-mono text-[10px] px-1.5 py-0.2">
                              {sec.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <div className="pt-1 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onLogout?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="size-4 shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </div>
  );
}
