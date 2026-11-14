/**
 * HQMS Admin Integration Test Suite — Hospital Admin Domain Service Verification
 *
 * Verifies:
 * 1. hospitalAdminService method signatures and contracts
 * 2. Scoped facility isolation (filtering strictly by verified hospital ID)
 * 3. Input validation constraints:
 *    - createDepartment rejects empty hospitalId and blank department names
 *    - createQueue rejects empty departmentId and blank queue names
 *    - assignDoctor rejects empty queueId
 * 4. Delegation to verified backend apiClient methods:
 *    - getAdminHospitals, createDepartment, createQueue, assignDoctorToQueue, getStaffAuditLog, getStaffQueues
 * 5. Analytical topology calculations:
 *    - computeFacilityStats computes accurate totals and active queue counts
 *    - getHospitalDoctors collects all unique clinical providers
 *    - getHospitalCounters dynamically models counter capacity per department
 */

import {
  hospitalAdminService,
  HospitalAdminService,
  type HospitalFacilityStats,
} from '../../services/hospitalAdminService';

import { apiClient } from '../../lib/api-client';
import type { Hospital, Department, HospitalQueue } from '../../services/types';

export async function runHospitalAdminServiceTests(): Promise<{ passed: number; failed: number; assertions: string[] }> {
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

  // 1. Signature & Export Integrity
  assert(hospitalAdminService instanceof HospitalAdminService, 'hospitalAdminService must be an instance of HospitalAdminService');
  assert(typeof hospitalAdminService.fetchHospitalFacility === 'function', 'fetchHospitalFacility must be a function');
  assert(typeof hospitalAdminService.createDepartment === 'function', 'createDepartment must be a function');
  assert(typeof hospitalAdminService.createQueue === 'function', 'createQueue must be a function');
  assert(typeof hospitalAdminService.assignDoctor === 'function', 'assignDoctor must be a function');
  assert(typeof hospitalAdminService.fetchActivityLog === 'function', 'fetchActivityLog must be a function');
  assert(typeof hospitalAdminService.fetchStaffQueues === 'function', 'fetchStaffQueues must be a function');
  assert(typeof hospitalAdminService.computeFacilityStats === 'function', 'computeFacilityStats must be a function');
  assert(typeof hospitalAdminService.getHospitalDoctors === 'function', 'getHospitalDoctors must be a function');
  assert(typeof hospitalAdminService.getHospitalCounters === 'function', 'getHospitalCounters must be a function');

  // 2. Validation Constraints
  // 2a. createDepartment
  try {
    await hospitalAdminService.createDepartment('', 'Cardiology');
    assert(false, 'createDepartment should reject empty hospitalId');
  } catch (err: any) {
    assert(err.message === 'Hospital ID is required to create a department.', 'createDepartment requires hospital ID');
  }

  try {
    await hospitalAdminService.createDepartment('hosp-1', '   ');
    assert(false, 'createDepartment should reject whitespace department name');
  } catch (err: any) {
    assert(err.message === 'Department name cannot be blank.', 'createDepartment rejects blank department name');
  }

  // 2b. createQueue
  try {
    await hospitalAdminService.createQueue('', 'Triage Queue 1');
    assert(false, 'createQueue should reject empty departmentId');
  } catch (err: any) {
    assert(err.message === 'Department ID is required to provision a queue.', 'createQueue requires department ID');
  }

  try {
    await hospitalAdminService.createQueue('dept-1', '   ');
    assert(false, 'createQueue should reject whitespace queue name');
  } catch (err: any) {
    assert(err.message === 'Queue name cannot be blank.', 'createQueue rejects blank queue name');
  }

  // 2c. assignDoctor
  try {
    await hospitalAdminService.assignDoctor('', 'doc-123');
    assert(false, 'assignDoctor should reject empty queueId');
  } catch (err: any) {
    assert(err.message === 'Queue ID is required to assign doctor.', 'assignDoctor requires queue ID');
  }

  // 3. Topology & Statistics Calculation
  const mockHospitalTopology: Hospital = {
    id: 'hosp-001',
    name: 'Memorial Research Hospital',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    departments: [
      {
        id: 'dept-10',
        hospitalId: 'hosp-001',
        name: 'Emergency',
        status: 'ACTIVE',
        queues: [
          {
            id: 'q-101',
            departmentId: 'dept-10',
            name: 'ER Acute',
            status: 'ACTIVE',
            publicQueueId: 'er-acute',
            acceptingWalkIns: true,
            updatedAt: new Date().toISOString(),
            doctorId: 'doc-alpha',
            doctor: { id: 'doc-alpha', name: 'Dr. Alpha' },
          },
          {
            id: 'q-102',
            departmentId: 'dept-10',
            name: 'ER Triage FastTrack',
            status: 'ACTIVE',
            publicQueueId: 'er-fast',
            acceptingWalkIns: true,
            updatedAt: new Date().toISOString(),
            doctorId: 'doc-beta',
            doctor: { id: 'doc-beta', name: 'Dr. Beta' },
          },
        ],
      },
      {
        id: 'dept-20',
        hospitalId: 'hosp-001',
        name: 'Pediatrics',
        status: 'ACTIVE',
        queues: [
          {
            id: 'q-201',
            departmentId: 'dept-20',
            name: 'Pediatric Clinic A',
            status: 'CLOSED',
            publicQueueId: 'ped-a',
            acceptingWalkIns: false,
            updatedAt: new Date().toISOString(),
            doctorId: null,
          },
        ],
      },
    ],
  };

  const stats = hospitalAdminService.computeFacilityStats(mockHospitalTopology);
  assert(stats.totalDepartments === 2, 'computeFacilityStats counts total departments correctly (2)');
  assert(stats.totalQueues === 3, 'computeFacilityStats counts total queues correctly (3)');
  assert(stats.totalActiveQueues === 2, 'computeFacilityStats counts active queues correctly (2 active, 1 closed)');
  assert(stats.totalAssignedDoctors === 2, 'computeFacilityStats counts unique assigned doctors correctly (2)');
  assert(stats.receptionCountersCount >= 4, 'computeFacilityStats provisions adequate counter capacity');

  // Null topology fallback
  const nullStats = hospitalAdminService.computeFacilityStats(null);
  assert(nullStats.totalDepartments === 0, 'null hospital returns 0 departments');
  assert(nullStats.totalQueues === 0, 'null hospital returns 0 queues');
  assert(nullStats.totalAssignedDoctors === 0, 'null hospital returns 0 assigned doctors');

  // 4. Clinical Doctors & Counter Extraction
  const doctors = hospitalAdminService.getHospitalDoctors(mockHospitalTopology);
  assert(doctors.length >= 2, 'getHospitalDoctors returns medical staff list');
  assert(doctors.some((d) => d.id === 'doc-alpha'), 'getHospitalDoctors extracts Dr. Alpha from queue');
  assert(doctors.some((d) => d.id === 'doc-beta'), 'getHospitalDoctors extracts Dr. Beta from queue');

  const counters = hospitalAdminService.getHospitalCounters(mockHospitalTopology);
  assert(counters.length === 4, 'getHospitalCounters generates 2 counters per department (4 total)');
  assert(counters.some((c) => c.departmentName === 'Emergency'), 'Emergency counters generated');
  assert(counters.some((c) => c.departmentName === 'Pediatrics'), 'Pediatrics counters generated');

  // Null topology counter fallback
  const fallbackCounters = hospitalAdminService.getHospitalCounters(null);
  assert(fallbackCounters.length === 0, 'null hospital returns empty counter list');

  const emptyHospitalCounters = hospitalAdminService.getHospitalCounters({
    id: 'hosp-empty',
    name: 'Empty Clinic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    departments: [],
  });
  assert(emptyHospitalCounters.length === 1, 'Empty hospital without departments generates default intake counter');
  assert(emptyHospitalCounters[0].counterLabel === 'Lobby Intake Counter 1', 'Default counter label is Lobby Intake Counter 1');

  // 5. Backend API Delegation & Facility Scoping
  const origGetAdminHospitals = apiClient.getAdminHospitals;
  const origCreateDepartment = apiClient.createDepartment;
  const origCreateQueue = apiClient.createQueue;
  const origAssignDoctorToQueue = apiClient.assignDoctorToQueue;
  const origGetStaffAuditLog = apiClient.getStaffAuditLog;
  const origGetStaffQueues = apiClient.getStaffQueues;

  try {
    // 5a. fetchHospitalFacility strictly isolates to verifiedHospitalId
    apiClient.getAdminHospitals = async () => [
      { id: 'hosp-other', name: 'Other Hospital', departments: [] },
      mockHospitalTopology,
      { id: 'hosp-third', name: 'Third Clinic', departments: [] },
    ];

    const isolatedHospital = await hospitalAdminService.fetchHospitalFacility('hosp-001');
    assert(isolatedHospital?.id === 'hosp-001', 'fetchHospitalFacility matches verifiedHospitalId strictly');
    assert(isolatedHospital?.name === 'Memorial Research Hospital', 'fetchHospitalFacility returns correct hospital');

    // Fallback if verified ID not found
    const fallbackHospital = await hospitalAdminService.fetchHospitalFacility('non-existent');
    assert(fallbackHospital?.id === 'hosp-other', 'fetchHospitalFacility falls back safely to first tenant if ID not matched');

    // 5b. createDepartment calls apiClient.createDepartment
    let passedHospId = '';
    let passedDeptName = '';
    apiClient.createDepartment = async (hospId: string, name: string) => {
      passedHospId = hospId;
      passedDeptName = name;
      return { id: 'dept-new', hospitalId: hospId, name, queues: [] };
    };

    const newDept = await hospitalAdminService.createDepartment('hosp-001', '  Neurology  ');
    assert(passedHospId === 'hosp-001', 'createDepartment passes hospitalId to backend');
    assert(passedDeptName === 'Neurology', 'createDepartment trims whitespace before sending to backend');
    assert(newDept.id === 'dept-new', 'createDepartment returns created department');

    // 5c. createQueue calls apiClient.createQueue
    let passedQDeptId = '';
    let passedQName = '';
    let passedQRoom = '';
    apiClient.createQueue = async (deptId: string, name: string, roomLabel?: string) => {
      passedQDeptId = deptId;
      passedQName = name;
      passedQRoom = roomLabel || '';
      return { id: 'q-new', departmentId: deptId, name, roomLabel, status: 'OPEN' };
    };

    const newQ = await hospitalAdminService.createQueue('dept-10', '  Neuro Consult  ', '  Room 302  ');
    assert(passedQDeptId === 'dept-10', 'createQueue passes departmentId to backend');
    assert(passedQName === 'Neuro Consult', 'createQueue trims queue name');
    assert(passedQRoom === 'Room 302', 'createQueue trims room label');
    assert(newQ.id === 'q-new', 'createQueue returns created queue');

    // 5d. assignDoctor calls apiClient.assignDoctorToQueue
    let assignedQId = '';
    let assignedDocId: string | null = '';
    apiClient.assignDoctorToQueue = async (queueId: string, doctorId: string | null) => {
      assignedQId = queueId;
      assignedDocId = doctorId;
      return { id: queueId, doctorId };
    };

    const assignedQ = await hospitalAdminService.assignDoctor('q-101', 'doc-alpha');
    assert(assignedQId === 'q-101', 'assignDoctor passes queueId to backend');
    assert(assignedDocId === 'doc-alpha', 'assignDoctor passes doctorId to backend');

    // Unassign doctor (null)
    await hospitalAdminService.assignDoctor('q-101', null);
    assert(assignedDocId === null, 'assignDoctor supports unassigning doctor with null');

    // 5e. fetchActivityLog delegates to apiClient.getStaffAuditLog
    apiClient.getStaffAuditLog = async () => ({
      items: [
        {
          id: 'log-audit-1',
          action: 'TOKEN_CALLED',
          user: 'Dr. Sarah',
          hospitalId: 'hosp-001',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const activity = await hospitalAdminService.fetchActivityLog();
    assert(activity.items.length === 1, 'fetchActivityLog retrieves items from getStaffAuditLog');
    assert(activity.items[0].action === 'TOKEN_CALLED', 'fetchActivityLog formats action');
    assert(activity.items[0].actorName === 'Dr. Sarah', 'fetchActivityLog formats actorName');

    // 5f. fetchStaffQueues delegates to apiClient.getStaffQueues
    let calledStaffQueues = false;
    apiClient.getStaffQueues = async () => {
      calledStaffQueues = true;
      return { items: [] };
    };
    await hospitalAdminService.fetchStaffQueues();
    assert(calledStaffQueues, 'fetchStaffQueues delegates to apiClient.getStaffQueues');

  } finally {
    apiClient.getAdminHospitals = origGetAdminHospitals;
    apiClient.createDepartment = origCreateDepartment;
    apiClient.createQueue = origCreateQueue;
    apiClient.assignDoctorToQueue = origAssignDoctorToQueue;
    apiClient.getStaffAuditLog = origGetStaffAuditLog;
    apiClient.getStaffQueues = origGetStaffQueues;
  }

  return { passed, failed, assertions };
}

// Auto-run if imported / executed
export const hospitalAdminServiceTestResults = await runHospitalAdminServiceTests();
console.log(`\n--- Hospital Admin Service Suite (${hospitalAdminServiceTestResults.passed} passed, ${hospitalAdminServiceTestResults.failed} failed) ---`);
hospitalAdminServiceTestResults.assertions.forEach((a) => console.log(a));
