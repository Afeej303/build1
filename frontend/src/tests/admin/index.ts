/**
 * HQMS Admin Integration & Regression Test Suite Runner
 *
 * Consolidates:
 * 1. App Route Configuration & Clinical Workstation Preservation (`routes.test.ts`)
 * 2. Role Separation & RBAC Security Matrix (`role-separation.test.ts`)
 * 3. Super Admin Domain Service Verification (`super-admin-service.test.ts`)
 * 4. Hospital Admin Domain Service Verification (`hospital-admin-service.test.ts`)
 * 5. AwaitingBackendBadge & Missing Endpoints Handling (`awaiting-backend-badge.test.ts`)
 */

import { runRouteTests } from './routes.test';
import { runRoleSeparationTests } from './role-separation.test';
import { runSuperAdminServiceTests } from './super-admin-service.test';
import { runHospitalAdminServiceTests } from './hospital-admin-service.test';
import { runAwaitingBackendBadgeTests } from './awaiting-backend-badge.test';
import { runErrorHandlingTests } from './error-handling.test';
import { runMobileNavTests } from './mobile-floating-nav.test';

export interface ConsolidatedTestSummary {
  timestamp: string;
  totalSuites: number;
  totalPassed: number;
  totalFailed: number;
  suites: {
    name: string;
    passed: number;
    failed: number;
    assertions: string[];
  }[];
}

export async function runAllAdminIntegrationTests(): Promise<ConsolidatedTestSummary> {
  console.log('================================================================');
  console.log('HQMS Administration Integration & Regression Test Suite');
  console.log('================================================================');

  const startTime = Date.now();
  const suites = [];

  // Suite 1: Routes
  console.log('\n[Suite 1/5] Running Route Configuration & Workstation Preservation Tests...');
  const routeResults = runRouteTests();
  suites.push({ name: 'Route Configuration & Preservation', ...routeResults });

  // Suite 2: Role Separation
  console.log('\n[Suite 2/5] Running Role Separation & RBAC Matrix Tests...');
  const roleResults = runRoleSeparationTests();
  suites.push({ name: 'Role Separation & RBAC Matrix', ...roleResults });

  // Suite 3: Super Admin Service
  console.log('\n[Suite 3/5] Running Super Admin Domain Service Tests...');
  const superAdminResults = await runSuperAdminServiceTests();
  suites.push({ name: 'Super Admin Domain Service', ...superAdminResults });

  // Suite 4: Hospital Admin Service
  console.log('\n[Suite 4/5] Running Hospital Admin Domain Service Tests...');
  const hospAdminResults = await runHospitalAdminServiceTests();
  suites.push({ name: 'Hospital Admin Domain Service', ...hospAdminResults });

  // Suite 5: Awaiting Backend Badge
  console.log('\n[Suite 5/6] Running AwaitingBackendBadge & Missing Endpoints Tests...');
  const badgeResults = runAwaitingBackendBadgeTests();
  suites.push({ name: 'AwaitingBackendBadge & Missing Endpoints', ...badgeResults });

  // Suite 6: Error Classification & Diagnostics Sanitization
  console.log('\n[Suite 6/7] Running Error Classification & Diagnostics Sanitization Tests...');
  const errorResults = await runErrorHandlingTests();
  suites.push({ name: 'Error Classification & Diagnostics Sanitization', ...errorResults });

  // Suite 7: Mobile Floating Navigation
  console.log('\n[Suite 7/7] Running Mobile Floating Navigation Tests...');
  const mobileNavResults = runMobileNavTests();
  suites.push({ name: 'Mobile Floating Navigation', ...mobileNavResults });

  const totalPassed = suites.reduce((acc, s) => acc + s.passed, 0);
  const totalFailed = suites.reduce((acc, s) => acc + s.failed, 0);
  const durationMs = Date.now() - startTime;

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed (${durationMs}ms)`);
  console.log('================================================================');

  for (const s of suites) {
    const statusTag = s.failed === 0 ? 'PASS' : 'FAIL';
    console.log(` [${statusTag}] ${s.name}: ${s.passed}/${s.passed + s.failed} assertions passed`);
  }

  if (totalFailed > 0) {
    throw new Error(`Integration test run failed with ${totalFailed} failed assertions.`);
  }

  return {
    timestamp: new Date().toISOString(),
    totalSuites: suites.length,
    totalPassed,
    totalFailed,
    suites,
  };
}

// Auto-run if executed directly
export const adminTestSummary = await runAllAdminIntegrationTests();
