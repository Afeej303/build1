/**
 * Seeded Mock Data for Hospital Queue Management System
 * Matches the exact shapes required by docs/API-CONTRACT.md (Commit d15be09)
 */

import {
  UserProfile,
  StaffQueueItem,
  PatientLookupItem,
  QueueDashboard,
  PublicQueueStatus,
  PatientTokenStatus,
} from '../types/contract';

// Seeded Users
export const SEEDED_RECEPTIONIST_USER: UserProfile = {
  id: 'usr_receptionist_01',
  email: 'reception@hospital.com',
  name: 'Ananya Sharma',
  roles: ['receptionist'],
  permissions: ['queue:issue_walkin', 'patient:lookup'],
  staffAssignments: [
    {
      role: 'receptionist',
      hospitalId: 'hosp_main_01',
      department: {
        id: 'dept_gen_med',
        name: 'General Medicine',
      },
      queues: [
        {
          id: 'q_genmed_room2',
          name: 'General Medicine - Room 2',
          doctorName: 'Dr. Rao',
          roomLabel: 'Room 2',
        },
      ],
    },
  ],
};

export const SEEDED_DOCTOR_USER: UserProfile = {
  id: 'usr_doctor_01',
  email: 'dr.rao@hospital.com',
  name: 'Dr. Rao',
  roles: ['doctor'],
  permissions: ['queue:call_next', 'queue:complete'],
  staffAssignments: [
    {
      role: 'doctor',
      hospitalId: 'hosp_main_01',
      department: {
        id: 'dept_gen_med',
        name: 'General Medicine',
      },
      queues: [
        {
          id: 'q_genmed_room2',
          name: 'General Medicine - Room 2',
          doctorName: 'Dr. Rao',
          roomLabel: 'Room 2',
        },
      ],
    },
  ],
};

export const SEEDED_PATIENT_USER: UserProfile = {
  id: 'usr_patient_01',
  email: 'patient@example.com',
  name: 'Rahul Verma',
  roles: ['patient'],
  permissions: ['queue:view_own_token'],
  staffAssignments: [],
};

// Seeded Accessible Queues
export const SEEDED_STAFF_QUEUES: StaffQueueItem[] = [
  {
    id: 'q_genmed_room2',
    name: 'General Medicine - Room 2',
    department: {
      id: 'dept_gen_med',
      name: 'General Medicine',
    },
    doctor: {
      id: 'doc_rao_01',
      name: 'Dr. Rao',
    },
    roomLabel: 'Room 2',
    acceptingWalkIns: true,
    publicQueueId: 'general-medicine-2',
  },
  {
    id: 'q_cardio_room4',
    name: 'Cardiology - Room 4',
    department: {
      id: 'dept_cardio',
      name: 'Cardiology',
    },
    doctor: {
      id: 'doc_jenkins_02',
      name: 'Dr. Sarah Jenkins',
    },
    roomLabel: 'Room 4',
    acceptingWalkIns: true,
    publicQueueId: 'cardiology-4',
  },
];

// Seeded Registered Patients for Exact UHID Lookup
export const SEEDED_PATIENTS: PatientLookupItem[] = [
  {
    id: 'pat_rahul_01',
    patientNumber: 'UHID-1001',
    displayName: 'Rahul Verma',
  },
  {
    id: 'pat_priya_02',
    patientNumber: 'UHID-1002',
    displayName: 'Priya Nair',
  },
  {
    id: 'pat_amit_03',
    patientNumber: 'UHID-1003',
    displayName: 'Amit Patel',
  },
];

// Initial Doctor/Receptionist Dashboard Queue State
export const INITIAL_QUEUE_DASHBOARD: QueueDashboard = {
  queueId: 'q_genmed_room2',
  department: {
    id: 'dept_gen_med',
    name: 'General Medicine',
  },
  roomLabel: 'Room 2',
  activeToken: null,
  waitingTokens: [
    {
      id: 'tk_101',
      queueId: 'q_genmed_room2',
      displayNumber: 'A-012',
      status: 'WAITING',
      priority: 'STANDARD',
    },
    {
      id: 'tk_102',
      queueId: 'q_genmed_room2',
      displayNumber: 'A-013',
      status: 'WAITING',
      priority: 'SENIOR_CITIZEN',
    },
  ],
  updatedAt: new Date().toISOString(),
};

// Initial Public Queue State (Zero PII)
export const INITIAL_PUBLIC_QUEUE: PublicQueueStatus = {
  publicQueueId: 'general-medicine-2',
  departmentName: 'General Medicine',
  roomLabel: 'Room 2',
  currentDisplayNumber: null,
  waitingCount: 2,
  estimatedWaitMinutes: 20,
  updatedAt: new Date().toISOString(),
};

// Initial Patient Token
export const INITIAL_PATIENT_TOKEN: PatientTokenStatus = {
  id: 'tk_101',
  queueId: 'q_genmed_room2',
  displayNumber: 'A-012',
  status: 'WAITING',
  departmentName: 'General Medicine',
  doctorName: 'Dr. Rao',
  roomLabel: 'Room 2',
  patientsAhead: 0,
  estimatedWaitMinutes: 10,
  updatedAt: new Date().toISOString(),
};
