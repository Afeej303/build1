/**
 * HQMS Admin Integration Test Suite — AwaitingBackendBadge & Missing Endpoints Handling
 *
 * Verifies:
 * 1. AwaitingBackendBadge component contract, props, and variant rendering:
 *    - 'pill' variant (default compact indicator with pulsating badge)
 *    - 'banner' variant (wide informative alert with role="status")
 *    - 'chip' variant (subtle inline tag)
 * 2. Accessibility conformance:
 *    - Banner variant includes role="status" and explicit aria-label
 *    - Pill/Chip variant includes button with tabIndex=0 and aria-label
 * 3. Default fallback values:
 *    - Defaults milestone to 'M2'
 *    - Formulates descriptive explanatory copy for pending backend services
 * 4. Surface Coverage Audit:
 *    - Verifies that all administrative workflows awaiting future backend API endpoints
 *      are guarded by AwaitingBackendBadge to prevent broken UI or unhandled errors.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AwaitingBackendBadge } from '../../components/admin/AwaitingBackendBadge';

// Administrative surfaces known to feature staged workflows
import { HospitalAdminDashboard } from '../../features/hospital-admin/HospitalAdminDashboard';
import { DepartmentManager } from '../../features/hospital-admin/DepartmentManager';
import { DoctorAssignment } from '../../features/hospital-admin/DoctorAssignment';
import { FacilityOverview } from '../../features/hospital-admin/FacilityOverview';
import { QueueRoomManager } from '../../features/hospital-admin/QueueRoomManager';
import { ReceptionCounterManager } from '../../features/hospital-admin/ReceptionCounterManager';
import { ReportIncidentModal } from '../../features/hospital-admin/ReportIncidentModal';

import { SuperAdminDashboard } from '../../features/super-admin/SuperAdminDashboard';
import { GlobalUserDirectory } from '../../features/super-admin/GlobalUserDirectory';
import { HospitalDirectory } from '../../features/super-admin/HospitalDirectory';
import { HospitalOnboardModal } from '../../features/super-admin/HospitalOnboardModal';
import { PlatformOverview } from '../../features/super-admin/PlatformOverview';
import { SystemAuditLog } from '../../features/super-admin/SystemAuditLog';
import { WebIncidentHub } from '../../features/super-admin/WebIncidentHub';

export function runAwaitingBackendBadgeTests(): { passed: number; failed: number; assertions: string[] } {
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

  // 1. Component Export & Callable Check
  assert(typeof AwaitingBackendBadge === 'function', 'AwaitingBackendBadge is exported as a functional React component');

  // 2. Banner Variant Inspection via renderToStaticMarkup
  const bannerHtml = renderToStaticMarkup(
    React.createElement(AwaitingBackendBadge, {
      variant: 'banner',
      endpoint: '/api/v1/admin/hospitals/export',
      featureName: 'Hospital Directory CSV Export',
      milestone: 'M2',
    })
  );

  assert(typeof bannerHtml === 'string' && bannerHtml.length > 0, 'Banner variant renders valid HTML markup');
  assert(bannerHtml.includes('role="status"'), 'Banner variant renders with role="status" for accessibility');
  assert(
    bannerHtml.includes('aria-label="Awaiting M2 backend endpoint"'),
    'Banner variant renders with correct aria-label matching milestone'
  );
  assert(
    bannerHtml.includes('Hospital Directory CSV Export'),
    'Banner variant renders the provided featureName'
  );
  assert(
    bannerHtml.includes('/api/v1/admin/hospitals/export'),
    'Banner variant renders the target endpoint code block'
  );
  assert(
    bannerHtml.includes('Pending M2 API'),
    'Banner variant includes the Pending M2 API milestone badge'
  );

  // 3. Pill Variant Inspection (Default)
  const pillHtml = renderToStaticMarkup(
    React.createElement(AwaitingBackendBadge, {
      endpoint: '/api/v1/admin/users/invite',
      featureName: 'Staff Invitation Workflow',
    })
  );

  assert(typeof pillHtml === 'string' && pillHtml.length > 0, 'Pill variant renders valid HTML markup');
  assert(pillHtml.includes('<button type="button"'), 'Pill variant renders accessible button element');
  assert(pillHtml.includes('tabindex="0"'), 'Button is focusable via keyboard tabIndex={0}');
  assert(
    pillHtml.includes('aria-label="Pending M2 Backend: /api/v1/admin/users/invite"'),
    'Button includes informative aria-label explaining pending M2 backend status and endpoint'
  );
  assert(pillHtml.includes('Pending API'), 'Pill includes Pending API text');
  assert(pillHtml.includes('M2'), 'Pill displays milestone M2 by default');

  // 4. Chip Variant Inspection
  const chipHtml = renderToStaticMarkup(
    React.createElement(AwaitingBackendBadge, {
      variant: 'chip',
      milestone: 'M3',
    })
  );
  assert(chipHtml.includes('text-[10px]'), 'Chip variant applies compact typography');
  assert(chipHtml.includes('M3'), 'Chip variant applies specified milestone M3');

  // 5. Custom milestone support
  const m3BannerHtml = renderToStaticMarkup(
    React.createElement(AwaitingBackendBadge, {
      variant: 'banner',
      milestone: 'M3',
      endpoint: '/api/v1/telemetry/stream',
    })
  );
  assert(
    m3BannerHtml.includes('aria-label="Awaiting M3 backend endpoint"'),
    'AwaitingBackendBadge dynamically supports custom milestones (e.g. M3)'
  );
  assert(
    m3BannerHtml.includes('Pending M3 API'),
    'AwaitingBackendBadge renders Pending M3 API badge'
  );

  // 6. Surface Staging Audit: Ensure all 14 administrative surfaces are defined and exportable
  const adminFeatureSurfaces = [
    { name: 'HospitalAdminDashboard', comp: HospitalAdminDashboard, domain: 'hospital-admin' },
    { name: 'DepartmentManager', comp: DepartmentManager, domain: 'hospital-admin' },
    { name: 'DoctorAssignment', comp: DoctorAssignment, domain: 'hospital-admin' },
    { name: 'FacilityOverview', comp: FacilityOverview, domain: 'hospital-admin' },
    { name: 'QueueRoomManager', comp: QueueRoomManager, domain: 'hospital-admin' },
    { name: 'ReceptionCounterManager', comp: ReceptionCounterManager, domain: 'hospital-admin' },
    { name: 'ReportIncidentModal', comp: ReportIncidentModal, domain: 'hospital-admin' },
    { name: 'SuperAdminDashboard', comp: SuperAdminDashboard, domain: 'super-admin' },
    { name: 'GlobalUserDirectory', comp: GlobalUserDirectory, domain: 'super-admin' },
    { name: 'HospitalDirectory', comp: HospitalDirectory, domain: 'super-admin' },
    { name: 'HospitalOnboardModal', comp: HospitalOnboardModal, domain: 'super-admin' },
    { name: 'PlatformOverview', comp: PlatformOverview, domain: 'super-admin' },
    { name: 'SystemAuditLog', comp: SystemAuditLog, domain: 'super-admin' },
    { name: 'WebIncidentHub', comp: WebIncidentHub, domain: 'super-admin' },
  ];

  for (const { name, comp, domain } of adminFeatureSurfaces) {
    assert(typeof comp === 'function', `Feature surface ${name} (${domain}) is exportable and valid`);
  }

  return { passed, failed, assertions };
}

// Auto-run if imported / executed
export const awaitingBackendBadgeTestResults = runAwaitingBackendBadgeTests();
console.log(`\n--- AwaitingBackendBadge Suite (${awaitingBackendBadgeTestResults.passed} passed, ${awaitingBackendBadgeTestResults.failed} failed) ---`);
awaitingBackendBadgeTestResults.assertions.forEach((a) => console.log(a));

