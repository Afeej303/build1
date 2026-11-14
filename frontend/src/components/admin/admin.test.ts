/**
 * Hospital Queue Management System — Administration Infrastructure Tests
 * Verifies component exports, domain model schemas, and type-level contracts.
 */

import type {
  Hospital,
  Department,
  HospitalQueue,
  StaffUser,
  DoctorSchedule,
  ReceptionCounter,
  AuditLogEntry,
  WebIncident,
  AdminRole,
  PaginationMeta,
  PaginatedResponse,
  TableSortState,
} from '../../services/types';

import {
  AwaitingBackendBadge,
  Breadcrumbs,
  EmptyState,
  QueryErrorState,
  ConfirmDialog,
  DetailDrawer,
  StatCard,
  Pagination,
  FilterBar,
  DataTable,
  PageHeader,
  AdminSidebar,
  AdminLayout,
  SUPER_ADMIN_NAV_ITEMS,
  HOSPITAL_ADMIN_NAV_ITEMS,
} from './index';

// ============================================================================
// 1. Export Integrity & Runtime Component Type Check
// ============================================================================

const requiredComponents = [
  { name: 'AwaitingBackendBadge', component: AwaitingBackendBadge },
  { name: 'Breadcrumbs', component: Breadcrumbs },
  { name: 'EmptyState', component: EmptyState },
  { name: 'QueryErrorState', component: QueryErrorState },
  { name: 'ConfirmDialog', component: ConfirmDialog },
  { name: 'DetailDrawer', component: DetailDrawer },
  { name: 'StatCard', component: StatCard },
  { name: 'Pagination', component: Pagination },
  { name: 'FilterBar', component: FilterBar },
  { name: 'DataTable', component: DataTable },
  { name: 'PageHeader', component: PageHeader },
  { name: 'AdminSidebar', component: AdminSidebar },
  { name: 'AdminLayout', component: AdminLayout },
];

for (const { name, component } of requiredComponents) {
  if (typeof component !== 'function') {
    throw new Error(`Component ${name} failed export check: expected function, got ${typeof component}`);
  }
}

// ============================================================================
// 2. Navigation Structure Verification
// ============================================================================

// Verify Super Admin Nav Items
const expectedSuperAdminIds = ['overview', 'hospitals', 'users', 'audit', 'incidents', 'settings'];
const actualSuperAdminIds = SUPER_ADMIN_NAV_ITEMS.map((item) => item.id);

for (const id of expectedSuperAdminIds) {
  if (!actualSuperAdminIds.includes(id)) {
    throw new Error(`Super Admin navigation missing required item: ${id}`);
  }
}

// Verify Hospital Admin Nav Items
const expectedHospitalAdminIds = [
  'overview',
  'departments',
  'queues',
  'schedules',
  'counters',
  'activity',
  'incidents',
  'settings',
];
const actualHospitalAdminIds = HOSPITAL_ADMIN_NAV_ITEMS.map((item) => item.id);

for (const id of expectedHospitalAdminIds) {
  if (!actualHospitalAdminIds.includes(id)) {
    throw new Error(`Hospital Admin navigation missing required item: ${id}`);
  }
}

// ============================================================================
// 3. Domain Model Type Contract Assertions
// ============================================================================

// Hospital
const sampleHospital: Hospital = {
  id: 'hosp-001',
  name: 'City General Hospital',
  code: 'CGH-01',
  status: 'ACTIVE',
  createdAt: '2026-11-14T00:00:00Z',
  updatedAt: '2026-11-14T12:00:00Z',
  admins: [],
  departments: [],
};

// Department
const sampleDepartment: Department = {
  id: 'dept-001',
  hospitalId: sampleHospital.id,
  name: 'General Medicine',
  status: 'ACTIVE',
  queues: [],
  receptionists: [],
};

// HospitalQueue
const sampleQueue: HospitalQueue = {
  id: 'queue-001',
  departmentId: sampleDepartment.id,
  doctorId: 'doc-001',
  publicQueueId: 'gm',
  name: 'General OPD Queue 1',
  roomLabel: 'Room 101',
  acceptingWalkIns: true,
  updatedAt: '2026-11-14T12:00:00Z',
  doctor: { id: 'doc-001', name: 'Dr. Sarah Smith', email: 'doctor@hospital.org' },
};

// StaffUser
const sampleStaffUser: StaffUser = {
  id: 'user-001',
  email: 'admin@hospital.org',
  name: 'Hospital Administrator',
  status: 'ACTIVE',
  roles: ['hospital_admin'],
  permissions: ['manage_queues', 'manage_departments'],
  staffAssignments: [],
};

// DoctorSchedule
const sampleSchedule: DoctorSchedule = {
  id: 'sched-001',
  doctorId: 'doc-001',
  queueId: sampleQueue.id,
  dayOfWeek: 1, // Monday
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: 15,
  isAvailable: true,
  doctorName: 'Dr. Sarah Smith',
  queueName: 'General OPD Queue 1',
  roomLabel: 'Room 101',
};

// ReceptionCounter
const sampleCounter: ReceptionCounter = {
  id: 'counter-001',
  departmentId: sampleDepartment.id,
  counterNumber: 1,
  counterLabel: 'Intake Counter 1',
  status: 'ACTIVE',
  currentStaff: sampleStaffUser,
  departmentName: 'General Medicine',
};

// AuditLogEntry
const sampleAudit: AuditLogEntry = {
  id: 'audit-001',
  action: 'QUEUE_PAUSED',
  actorId: sampleStaffUser.id,
  departmentId: sampleDepartment.id,
  tokenId: null,
  source: 'ADMIN_CONSOLE',
  createdAt: '2026-11-14T12:15:00Z',
  metadata: { reason: 'Lunch Break' },
};

// WebIncident
const sampleIncident: WebIncident = {
  id: 'inc-001',
  hospitalName: sampleHospital.name,
  reporterEmail: sampleStaffUser.email,
  title: 'Display Screen Disconnected',
  severity: 'HIGH',
  category: 'HARDWARE',
  description: 'Waiting room display lost HDMI signal.',
  component: 'Public Display Hall A',
  status: 'OPEN',
  createdAt: '2026-11-14T12:20:00Z',
};

// Output success message
console.log('HQMS Administration Infrastructure test assertions passed successfully:');
console.log(`- Validated ${requiredComponents.length} admin UI components.`);
console.log(`- Verified ${SUPER_ADMIN_NAV_ITEMS.length} Super Admin navigation links.`);
console.log(`- Verified ${HOSPITAL_ADMIN_NAV_ITEMS.length} Hospital Admin navigation links.`);
console.log('- Verified all 8 Domain Models and contract types.');
