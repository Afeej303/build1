/**
 * Hospital Queue Management System — Hospital Admin Unit & Contract Tests
 * Validates module exports, component signatures, service contracts, and constraints.
 */

import {
  HospitalAdminDashboard,
  FacilityOverview,
  DepartmentManager,
  QueueRoomManager,
  DoctorAssignment,
  ReceptionCounterManager,
  FacilityActivityLog,
  ReportIncidentModal,
} from './index';

import {
  hospitalAdminService,
  HospitalAdminService,
  type HospitalFacilityStats,
} from '../../services/hospitalAdminService';

import type {
  Hospital,
  Department,
  HospitalQueue,
  StaffUser,
  ReceptionCounter,
  AuditLogEntry,
  WebIncident,
} from '../../services/types';

// ============================================================================
// 1. Component Export Integrity
// ============================================================================

const hospitalAdminComponents = [
  { name: 'HospitalAdminDashboard', comp: HospitalAdminDashboard },
  { name: 'FacilityOverview', comp: FacilityOverview },
  { name: 'DepartmentManager', comp: DepartmentManager },
  { name: 'QueueRoomManager', comp: QueueRoomManager },
  { name: 'DoctorAssignment', comp: DoctorAssignment },
  { name: 'ReceptionCounterManager', comp: ReceptionCounterManager },
  { name: 'FacilityActivityLog', comp: FacilityActivityLog },
  { name: 'ReportIncidentModal', comp: ReportIncidentModal },
];

for (const { name, comp } of hospitalAdminComponents) {
  if (typeof comp !== 'function') {
    throw new Error(`Hospital Admin component ${name} export test failed: expected function, got ${typeof comp}`);
  }
}

// ============================================================================
// 2. Service Method Signatures
// ============================================================================

const requiredServiceMethods = [
  'fetchHospitalFacility',
  'createDepartment',
  'createQueue',
  'assignDoctor',
  'fetchActivityLog',
  'fetchStaffQueues',
  'computeFacilityStats',
  'getHospitalDoctors',
  'getHospitalCounters',
] as const;

for (const method of requiredServiceMethods) {
  if (typeof hospitalAdminService[method] !== 'function') {
    throw new Error(`hospitalAdminService.${method} missing or not a function`);
  }
}

// ============================================================================
// 3. Validation Rules Tests
// ============================================================================

export async function testCreateDepartmentValidation() {
  try {
    await hospitalAdminService.createDepartment('', 'Cardiology');
    throw new Error('createDepartment should reject empty hospitalId');
  } catch (err: any) {
    if (err.message !== 'Hospital ID is required to create a department.') {
      throw err;
    }
  }

  try {
    await hospitalAdminService.createDepartment('hosp-1', '   ');
    throw new Error('createDepartment should reject blank name');
  } catch (err: any) {
    if (err.message !== 'Department name cannot be blank.') {
      throw err;
    }
  }
}

export async function testCreateQueueValidation() {
  try {
    await hospitalAdminService.createQueue('', 'Room 1');
    throw new Error('createQueue should reject empty departmentId');
  } catch (err: any) {
    if (err.message !== 'Department ID is required to provision a queue.') {
      throw err;
    }
  }

  try {
    await hospitalAdminService.createQueue('dept-1', '   ');
    throw new Error('createQueue should reject blank name');
  } catch (err: any) {
    if (err.message !== 'Queue name cannot be blank.') {
      throw err;
    }
  }
}

export async function testAssignDoctorValidation() {
  try {
    await hospitalAdminService.assignDoctor('', null);
    throw new Error('assignDoctor should reject empty queueId');
  } catch (err: any) {
    if (err.message !== 'Queue ID is required to assign doctor.') {
      throw err;
    }
  }
}

// ============================================================================
// 4. Facility Statistics & Calculation Verification
// ============================================================================

const mockHospital: Hospital = {
  id: 'hosp-test-123',
  name: 'St. Jude Specialty Hospital',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  departments: [
    {
      id: 'dept-cardio',
      hospitalId: 'hosp-test-123',
      name: 'Cardiology',
      queues: [
        {
          id: 'q-101',
          departmentId: 'dept-cardio',
          name: 'Consultation Room 1',
          roomLabel: 'Room 101',
          publicQueueId: 'cardio-room-1',
          acceptingWalkIns: true,
          updatedAt: new Date().toISOString(),
          doctorId: 'doc-jenkins',
          doctor: { id: 'doc-jenkins', name: 'Dr. Jenkins' },
        },
        {
          id: 'q-102',
          departmentId: 'dept-cardio',
          name: 'Consultation Room 2',
          roomLabel: 'Room 102',
          publicQueueId: 'cardio-room-2',
          acceptingWalkIns: false,
          updatedAt: new Date().toISOString(),
          doctorId: null,
        },
      ],
    },
  ],
};

const computedStats: HospitalFacilityStats = hospitalAdminService.computeFacilityStats(mockHospital);

if (computedStats.totalDepartments !== 1) {
  throw new Error(`Expected 1 department, got ${computedStats.totalDepartments}`);
}

if (computedStats.totalQueues !== 2) {
  throw new Error(`Expected 2 queues, got ${computedStats.totalQueues}`);
}

if (computedStats.totalAssignedDoctors !== 1) {
  throw new Error(`Expected 1 assigned doctor, got ${computedStats.totalAssignedDoctors}`);
}

// ============================================================================
// 5. Reception Counters Verification
// ============================================================================

const counters: ReceptionCounter[] = hospitalAdminService.getHospitalCounters(mockHospital);
if (counters.length === 0) {
  throw new Error('Expected reception counters to be generated from departments');
}

// ============================================================================
// 6. Export index verification
// ============================================================================
export {
  mockHospital,
  computedStats,
  counters,
};
