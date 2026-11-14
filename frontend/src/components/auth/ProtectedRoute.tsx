import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Btn } from '../hq/ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'doctor' | 'receptionist' | 'staff' | 'patient' | 'admin' | 'super_admin' | 'hospital_admin';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { session, profile, loading, isDoctor, isReceptionist, isAdmin, isSuperAdmin, isHospitalAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-muted-foreground font-mono">Verifying clinical credentials...</p>
      </div>
    );
  }

  // Not signed in
  if (!session) {
    if (
      requiredRole === 'doctor' ||
      requiredRole === 'receptionist' ||
      requiredRole === 'staff' ||
      requiredRole === 'admin' ||
      requiredRole === 'super_admin' ||
      requiredRole === 'hospital_admin'
    ) {
      return <Navigate to={`/staff-login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    }
    return <Navigate to="/track" replace />;
  }

  // Super Admin validation
  if (requiredRole === 'super_admin' && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full surface p-8 border border-border text-center shadow-lift">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Platform Super Admin Required</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your account ({profile?.email}) is not authorized for platform-level super administrative governance.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/staff-login">
              <Btn variant="ink" size="sm" className="w-full">
                Sign in with Super Admin Account
              </Btn>
            </Link>
            <Link to="/hospital-admin">
              <Btn variant="soft" size="sm" className="w-full">
                Go to Hospital Facility Admin
              </Btn>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Hospital Admin validation
  if (requiredRole === 'hospital_admin' && !(isHospitalAdmin || isSuperAdmin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full surface p-8 border border-border text-center shadow-lift">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Hospital Facility Admin Required</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your account ({profile?.email}) is not authorized for hospital facility administration.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/staff-login">
              <Btn variant="ink" size="sm" className="w-full">
                Switch Administrative Account
              </Btn>
            </Link>
            <Link to="/">
              <Btn variant="soft" size="sm" className="w-full gap-1.5">
                <ArrowLeft size={14} /> Back to Home
              </Btn>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Generic Admin validation
  if (requiredRole === 'admin' && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full surface p-8 border border-border text-center shadow-lift">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Administrative Access Required</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your account ({profile?.email}) is not authorized for administrative governance. Please sign in with an authorized hospital or super admin account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/staff-login">
              <Btn variant="ink" size="sm" className="w-full">
                Switch Administrative Account
              </Btn>
            </Link>
            <Link to="/">
              <Btn variant="soft" size="sm" className="w-full gap-1.5">
                <ArrowLeft size={14} /> Back to Home
              </Btn>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Role validation
  if (requiredRole === 'doctor' && !isDoctor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full surface p-8 border border-border text-center shadow-lift">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Doctor Access Required</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your account ({profile?.email}) is not assigned to any doctor clinical queue. Please sign in with an authorized doctor account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/staff-login">
              <Btn variant="ink" size="sm" className="w-full">
                Switch Staff Account
              </Btn>
            </Link>
            <Link to="/">
              <Btn variant="soft" size="sm" className="w-full gap-1.5">
                <ArrowLeft size={14} /> Back to Home
              </Btn>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRole === 'receptionist' && !isReceptionist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full surface p-8 border border-border text-center shadow-lift">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Receptionist Access Required</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your account ({profile?.email}) is not assigned to any reception counter. Please sign in with an authorized receptionist account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/staff-login">
              <Btn variant="ink" size="sm" className="w-full">
                Switch Staff Account
              </Btn>
            </Link>
            <Link to="/">
              <Btn variant="soft" size="sm" className="w-full gap-1.5">
                <ArrowLeft size={14} /> Back to Home
              </Btn>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
