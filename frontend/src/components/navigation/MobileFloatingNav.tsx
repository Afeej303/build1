import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  MessageSquare,
  Heart,
  User,
  Stethoscope,
  ClipboardList,
  Building2,
  ShieldCheck,
  Tv,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; fill?: string }>;
  badge?: number | string;
}

export const MobileFloatingNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isDoctor, isReceptionist, isSuperAdmin, isHospitalAdmin } = useAuth();

  // Determine active item from current route
  const currentPath = location.pathname;

  // Construct adaptive navigation items tailored to the user role
  const navItems: NavItem[] = React.useMemo(() => {
    if (session) {
      if (isSuperAdmin) {
        return [
          { id: 'home', label: 'Home', path: '/', icon: Home },
          { id: 'admin', label: 'Admin', path: '/admin', icon: ShieldCheck },
          { id: 'display', label: 'Board', path: '/display', icon: Tv },
          { id: 'profile', label: 'Account', path: '/staff-login', icon: User },
        ];
      }
      if (isHospitalAdmin) {
        return [
          { id: 'home', label: 'Home', path: '/', icon: Home },
          { id: 'facility', label: 'Facility', path: '/hospital-admin', icon: Building2 },
          { id: 'display', label: 'Board', path: '/display', icon: Tv },
          { id: 'profile', label: 'Account', path: '/staff-login', icon: User },
        ];
      }
      if (isDoctor) {
        return [
          { id: 'home', label: 'Home', path: '/', icon: Home },
          { id: 'consult', label: 'Consult', path: '/consultation', icon: Stethoscope },
          { id: 'display', label: 'Board', path: '/display', icon: Tv },
          { id: 'profile', label: 'Doctor', path: '/staff-login', icon: User },
        ];
      }
      if (isReceptionist) {
        return [
          { id: 'home', label: 'Home', path: '/', icon: Home },
          { id: 'intake', label: 'Intake', path: '/intake', icon: ClipboardList },
          { id: 'display', label: 'Board', path: '/display', icon: Tv },
          { id: 'profile', label: 'Staff', path: '/staff-login', icon: User },
        ];
      }
    }

    // Default visitor / patient navigation (matches the user's provided mockup structure)
    return [
      { id: 'home', label: 'Home', path: '/', icon: Home },
      { id: 'queue', label: 'Queue', path: '/track', icon: MessageSquare },
      { id: 'care', label: 'Care', path: '/track#care', icon: Heart },
      { id: 'account', label: session ? 'Account' : 'Sign in', path: '/staff-login', icon: User },
    ];
  }, [session, isDoctor, isReceptionist, isSuperAdmin, isHospitalAdmin]);

  // Hide on landing page, display signage, and admin consoles (admin handles its own floating section dock)
  if (
    location.pathname === '/' ||
    location.pathname.startsWith('/display') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/hospital-admin')
  ) {
    return null;
  }

  // Find currently active item
  const activeItem =
    navItems.find((item) => {
      if (item.path === '/') return currentPath === '/';
      return currentPath.startsWith(item.path.split('#')[0]);
    }) || navItems[0];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]">
        {navItems.map((item) => {
          const isActive = activeItem.id === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.path.includes('#')) {
                  const [route, hash] = item.path.split('#');
                  navigate(route);
                  setTimeout(() => {
                    const el = document.getElementById(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                } else {
                  navigate(item.path);
                }
              }}
              className="relative flex items-center justify-center rounded-full transition-colors cursor-pointer focus:outline-none"
              style={{ minHeight: '44px' }}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active pill background container (Theme color styled) */}
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active-pill"
                  className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/20 dark:border-primary/30"
                  transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}

              {/* Icon & Label container */}
              <div
                className={`relative z-10 flex items-center gap-2 px-3.5 py-2 transition-colors ${
                  isActive
                    ? 'text-primary dark:text-primary font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-3'
                }`}
              >
                <Icon
                  className={`size-[20px] transition-transform ${
                    isActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                  fill={isActive ? 'currentColor' : 'none'}
                />

                {/* Animated text label for active item */}
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0, x: -4 }}
                      animate={{ opacity: 1, width: 'auto', x: 0 }}
                      exit={{ opacity: 0, width: 0, x: -4 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
      </div>
    </nav>
  );
};
