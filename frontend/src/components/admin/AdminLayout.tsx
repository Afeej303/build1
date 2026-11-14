import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  LogOut,
  Building2,
  ShieldCheck,
  ChevronDown,
  User as UserIcon,
  Bell,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ease } from '../hq/ui';
import { AdminSidebar, AdminRole } from './AdminSidebar';

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
 * Unified administrative shell providing a collapsible sidebar, mobile drawer,
 * frosted glass top navigation bar, hospital tenant badge, live status indicator,
 * and user menu.
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close mobile drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={cn('min-h-screen bg-background text-foreground flex', className)}>
      {/* Desktop Sidebar */}
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

      {/* Mobile Drawer Backdrop & Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease }}
              className="relative z-10 h-full w-72 max-w-[80vw]"
            >
              <AdminSidebar
                role={role}
                activeId={activeNavId}
                onSelect={(id) => {
                  onNavigate?.(id);
                  setMobileOpen(false);
                }}
                collapsed={false}
                hospitalName={hospitalName}
                incidentCount={incidentCount}
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close mobile navigation"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Frosted Glass Top Navigation Bar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="press lg:hidden rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open navigation sidebar"
            >
              <Menu className="size-4" />
            </button>

            {/* Hospital / Tenant Badge */}
            {role === 'hospital_admin' ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-foreground shadow-xs">
                <Building2 className="size-3.5 text-primary" />
                <span className="truncate max-w-[140px] sm:max-w-xs">{hospitalName}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-foreground shadow-xs">
                <ShieldCheck className="size-3.5 text-primary" />
                <span className="font-semibold">Super Administrator</span>
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
                className="press flex items-center gap-2 rounded-full border border-border bg-card p-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="surface glass absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-border p-2 shadow-xl"
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

        {/* Content Body */}
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="flex-1 p-4 sm:p-6 lg:p-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
