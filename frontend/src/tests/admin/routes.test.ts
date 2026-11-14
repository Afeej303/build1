/**
 * HQMS Admin Integration Test Suite — Route Configuration & Preservation
 *
 * Verifies:
 * 1. Super Admin route isolation (/admin, /admin/*) protected exclusively by 'super_admin'
 * 2. Hospital Admin route isolation (/hospital-admin, /hospital-admin/*) protected exclusively by 'hospital_admin'
 * 3. Legacy Admin route (/admin-classic) preserved with role 'admin'
 * 4. Core clinical workstations preserved:
 *    - /intake (receptionist WalkInDesk)
 *    - /consultation (doctor DoctorConsole)
 *    - /track (patient TokenTracker)
 *    - /display (public TV PublicWaitingBoard)
 *    - /display/:roomId (public TV per-room PublicWaitingBoard)
 * 5. Public entry routes preserved:
 *    - / (LandingPage)
 *    - /staff-login (StaffLoginPage)
 * 6. Catch-all fallback route (* -> redirect to /)
 */

import React from 'react';
import { App } from '../../App';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { SuperAdminDashboard } from '../../features/super-admin/SuperAdminDashboard';
import { HospitalAdminDashboard } from '../../features/hospital-admin/HospitalAdminDashboard';
import { AdminDashboard } from '../../features/admin/AdminDashboard';
import { WalkInDesk } from '../../features/receptionist/WalkInDesk';
import { DoctorConsole } from '../../features/doctor/DoctorConsole';
import { TokenTracker } from '../../features/patient/TokenTracker';
import { PublicWaitingBoard } from '../../features/display/PublicWaitingBoard';
import { StaffLoginPage } from '../../pages/StaffLoginPage';
import { LandingPage } from '../../pages/LandingPage';
import { Navigate, Routes } from 'react-router-dom';

interface RouteDefinition {
  path: string;
  isProtected: boolean;
  requiredRole?: string;
  componentType: any;
}

export function extractAppRoutes(): Map<string, RouteDefinition> {
  const tree: any = App({});
  // Structure: QueryClientProvider -> AuthProvider -> BrowserRouter -> Routes -> Route[]
  const authProvider = tree.props.children;
  const browserRouter = authProvider.props.children;
  const routerChildren = React.Children.toArray(browserRouter.props.children);
  const routesComponent: any =
    routerChildren.find((c: any) => c?.type === Routes || c?.props?.children) || browserRouter.props.children;
  const routeElements: any[] = React.Children.toArray(routesComponent?.props?.children || []);

  const routeMap = new Map<string, RouteDefinition>();

  for (const route of routeElements) {
    const path = route.props.path;
    const element = route.props.element;

    if (element.type === ProtectedRoute) {
      routeMap.set(path, {
        path,
        isProtected: true,
        requiredRole: element.props.requiredRole,
        componentType: element.props.children?.type,
      });
    } else {
      routeMap.set(path, {
        path,
        isProtected: false,
        componentType: element.type,
      });
    }
  }

  return routeMap;
}

export function runRouteTests(): { passed: number; failed: number; assertions: string[] } {
  const assertions: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      passed++;
      assertions.push(`[PASS] ${description}`);
    } else {
      failed++;
      assertions.push(`[FAIL] ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  const routes = extractAppRoutes();

  // 1. Super Admin Route Isolation
  const adminRoute = routes.get('/admin');
  assert(!!adminRoute, "Route '/admin' must be registered");
  assert(adminRoute?.isProtected === true, "Route '/admin' must be protected");
  assert(adminRoute?.requiredRole === 'super_admin', "Route '/admin' must require 'super_admin' role exclusively");
  assert(adminRoute?.componentType === SuperAdminDashboard, "Route '/admin' must render SuperAdminDashboard");

  const adminWildcardRoute = routes.get('/admin/*');
  assert(!!adminWildcardRoute, "Route '/admin/*' must be registered for deep linking");
  assert(adminWildcardRoute?.isProtected === true, "Route '/admin/*' must be protected");
  assert(adminWildcardRoute?.requiredRole === 'super_admin', "Route '/admin/*' must require 'super_admin' role exclusively");
  assert(adminWildcardRoute?.componentType === SuperAdminDashboard, "Route '/admin/*' must render SuperAdminDashboard");

  // 2. Hospital Admin Route Isolation
  const hospAdminRoute = routes.get('/hospital-admin');
  assert(!!hospAdminRoute, "Route '/hospital-admin' must be registered");
  assert(hospAdminRoute?.isProtected === true, "Route '/hospital-admin' must be protected");
  assert(hospAdminRoute?.requiredRole === 'hospital_admin', "Route '/hospital-admin' must require 'hospital_admin' role exclusively");
  assert(hospAdminRoute?.componentType === HospitalAdminDashboard, "Route '/hospital-admin' must render HospitalAdminDashboard");

  const hospAdminWildcardRoute = routes.get('/hospital-admin/*');
  assert(!!hospAdminWildcardRoute, "Route '/hospital-admin/*' must be registered for deep linking");
  assert(hospAdminWildcardRoute?.isProtected === true, "Route '/hospital-admin/*' must be protected");
  assert(hospAdminWildcardRoute?.requiredRole === 'hospital_admin', "Route '/hospital-admin/*' must require 'hospital_admin' role exclusively");
  assert(hospAdminWildcardRoute?.componentType === HospitalAdminDashboard, "Route '/hospital-admin/*' must render HospitalAdminDashboard");

  // 3. Backward Compatibility: Legacy Admin Operations Center
  const legacyAdminRoute = routes.get('/admin-classic');
  assert(!!legacyAdminRoute, "Legacy route '/admin-classic' must be preserved for backward compatibility");
  assert(legacyAdminRoute?.isProtected === true, "Legacy route '/admin-classic' must be protected");
  assert(legacyAdminRoute?.requiredRole === 'admin', "Legacy route '/admin-classic' must require 'admin' role");
  assert(legacyAdminRoute?.componentType === AdminDashboard, "Legacy route '/admin-classic' must render AdminDashboard");

  // 4. Core Clinical Workstation Preservation
  // 4a. Receptionist Walk-In Desk
  const intakeRoute = routes.get('/intake');
  assert(!!intakeRoute, "Workstation route '/intake' must be preserved");
  assert(intakeRoute?.isProtected === true, "Workstation route '/intake' must be protected");
  assert(intakeRoute?.requiredRole === 'receptionist', "Workstation route '/intake' must require 'receptionist' role");
  assert(intakeRoute?.componentType === WalkInDesk, "Workstation route '/intake' must render WalkInDesk");

  // 4b. Doctor Clinical Console
  const consultationRoute = routes.get('/consultation');
  assert(!!consultationRoute, "Workstation route '/consultation' must be preserved");
  assert(consultationRoute?.isProtected === true, "Workstation route '/consultation' must be protected");
  assert(consultationRoute?.requiredRole === 'doctor', "Workstation route '/consultation' must require 'doctor' role");
  assert(consultationRoute?.componentType === DoctorConsole, "Workstation route '/consultation' must render DoctorConsole");

  // 4c. Patient Mobile Tracker
  const trackRoute = routes.get('/track');
  assert(!!trackRoute, "Patient route '/track' must be preserved");
  assert(trackRoute?.isProtected === false, "Patient route '/track' must be accessible without staff role requirement");
  assert(trackRoute?.componentType === TokenTracker, "Patient route '/track' must render TokenTracker");

  // 4d. Public TV Display Signage
  const displayRoute = routes.get('/display');
  assert(!!displayRoute, "Public display route '/display' must be preserved");
  assert(displayRoute?.isProtected === false, "Public display route '/display' must be unauthenticated zero-PII");
  assert(displayRoute?.componentType === PublicWaitingBoard, "Public display route '/display' must render PublicWaitingBoard");

  const displayRoomRoute = routes.get('/display/:roomId');
  assert(!!displayRoomRoute, "Public room display route '/display/:roomId' must be preserved");
  assert(displayRoomRoute?.isProtected === false, "Public room display route '/display/:roomId' must be unauthenticated");
  assert(displayRoomRoute?.componentType === PublicWaitingBoard, "Public room display route '/display/:roomId' must render PublicWaitingBoard");

  // 5. Entry & Public Pages
  const landingRoute = routes.get('/');
  assert(!!landingRoute, "Root route '/' must render LandingPage");
  assert(landingRoute?.componentType === LandingPage, "Root route '/' must render LandingPage");

  const staffLoginRoute = routes.get('/staff-login');
  assert(!!staffLoginRoute, "Route '/staff-login' must render StaffLoginPage");
  assert(staffLoginRoute?.componentType === StaffLoginPage, "Route '/staff-login' must render StaffLoginPage");

  // 6. Catch-all Fallback
  const wildcardFallback = routes.get('*');
  assert(!!wildcardFallback, "Catch-all '*' route must be defined for invalid path fallback");
  assert(wildcardFallback?.componentType === Navigate, "Catch-all route must use React Router Navigate");

  return { passed, failed, assertions };
}

// Execute test suite immediately upon import / execution
export const routeTestResults = runRouteTests();
console.log(`\n--- App Route Integration Suite (${routeTestResults.passed} passed, ${routeTestResults.failed} failed) ---`);
routeTestResults.assertions.forEach((a) => console.log(a));

