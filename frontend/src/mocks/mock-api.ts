/**
 * In-Memory Mock API Service for Hospital Queue Management System
 * Simulates backend endpoints in full compliance with docs/API-CONTRACT.md (Commit d15be09)
 */

import {
  UserProfile,
  StaffQueuesResponse,
  PatientLookupResponse,
  WalkInResponse,
  CallNextResponse,
  CompleteTokenResponse,
  PatientTokenStatus,
  ActiveQueueTokensResponse,
  PublicQueueStatus,
  QueueDashboard,
  DashboardActiveToken,
  DashboardWaitingToken,
  ApiErrorResponse,
} from '../types/contract';

import {
  SEEDED_RECEPTIONIST_USER,
  SEEDED_DOCTOR_USER,
  SEEDED_PATIENTS,
  SEEDED_STAFF_QUEUES,
  INITIAL_QUEUE_DASHBOARD,
  INITIAL_PUBLIC_QUEUE,
} from './mock-data';

export class MockApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'MockApiError';
  }

  toJSON(): ApiErrorResponse {
    return {
      statusCode: this.statusCode,
      code: this.code as any,
      message: this.message,
    };
  }
}

class MockApiService {
  private currentUser: UserProfile = SEEDED_RECEPTIONIST_USER;
  private queueDashboard: QueueDashboard = { ...INITIAL_QUEUE_DASHBOARD };
  private publicQueue: PublicQueueStatus = { ...INITIAL_PUBLIC_QUEUE };
  private tokenCounter = 14;
  private patientActiveTokens: Map<string, PatientTokenStatus> = new Map();

  constructor() {
    // Seed initial active token for patient
    this.patientActiveTokens.set('pat_rahul_01', {
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
    });
  }

  // Switch simulation actor (receptionist, doctor, patient)
  public setActor(role: 'receptionist' | 'doctor' | 'patient') {
    if (role === 'receptionist') this.currentUser = SEEDED_RECEPTIONIST_USER;
    else if (role === 'doctor') this.currentUser = SEEDED_DOCTOR_USER;
    else this.currentUser = {
      id: 'usr_patient_01',
      email: 'patient@example.com',
      name: 'Rahul Verma',
      roles: ['patient'],
      permissions: ['queue:view_own_token'],
    };
  }

  // API-001: GET /users/me
  public async getMe(): Promise<UserProfile> {
    return { ...this.currentUser };
  }

  // GET /staff/queues?departmentId=...
  public async getStaffQueues(departmentId?: string): Promise<StaffQueuesResponse> {
    let items = [...SEEDED_STAFF_QUEUES];
    if (departmentId) {
      items = items.filter((q) => q.department.id === departmentId);
    }
    return { items };
  }

  // GET /staff/patients/lookup?patientNumber=...
  public async lookupPatient(patientNumber: string): Promise<PatientLookupResponse> {
    const cleanNumber = patientNumber.trim().toUpperCase();
    const match = SEEDED_PATIENTS.find((p) => p.patientNumber.toUpperCase() === cleanNumber);

    if (!match) {
      throw new MockApiError(
        404,
        'PATIENT_NOT_FOUND',
        `No patient record matches identifier "${patientNumber}".`
      );
    }

    return { items: [{ ...match }] };
  }

  // API-002: POST /walk-ins
  public async issueWalkIn(patientId: string, queueId: string): Promise<WalkInResponse> {
    const targetQueue = SEEDED_STAFF_QUEUES.find((q) => q.id === queueId);
    if (!targetQueue) {
      throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Target queue not found.');
    }

    if (!targetQueue.acceptingWalkIns) {
      throw new MockApiError(
        409,
        'QUEUE_NOT_AVAILABLE',
        'This queue is currently not accepting walk-ins.'
      );
    }

    // Check for duplicate active walk-in for this patient in this queue
    const existing = this.patientActiveTokens.get(patientId);
    if (existing && existing.queueId === queueId && (existing.status === 'WAITING' || existing.status === 'CALLED')) {
      throw new MockApiError(
        409,
        'DUPLICATE_WALK_IN',
        `Patient already has an active token (${existing.displayNumber}) in this queue.`
      );
    }

    const tokenNum = `A-${String(this.tokenCounter++).padStart(3, '0')}`;
    const tokenId = `tk_${Date.now()}`;
    const now = new Date().toISOString();

    const newWaitingToken: DashboardWaitingToken = {
      id: tokenId,
      queueId,
      displayNumber: tokenNum,
      status: 'WAITING',
      priority: 'STANDARD',
    };

    // Update internal queue
    this.queueDashboard.waitingTokens.push(newWaitingToken);
    this.queueDashboard.updatedAt = now;

    // Update public queue aggregate
    this.publicQueue.waitingCount = this.queueDashboard.waitingTokens.length;
    this.publicQueue.estimatedWaitMinutes = this.publicQueue.waitingCount * 10;
    this.publicQueue.updatedAt = now;

    // Update patient tracker
    this.patientActiveTokens.set(patientId, {
      id: tokenId,
      queueId,
      displayNumber: tokenNum,
      status: 'WAITING',
      departmentName: targetQueue.department.name,
      doctorName: targetQueue.doctor?.name || null,
      roomLabel: targetQueue.roomLabel || null,
      patientsAhead: this.queueDashboard.waitingTokens.length - 1,
      estimatedWaitMinutes: this.publicQueue.estimatedWaitMinutes,
      updatedAt: now,
    });

    return {
      id: tokenId,
      queueId,
      displayNumber: tokenNum,
      status: 'WAITING',
      issuedAt: now,
      slip: {
        departmentName: targetQueue.department.name,
        roomLabel: targetQueue.roomLabel || 'Room 2',
        publicQueueId: targetQueue.publicQueueId,
      },
    };
  }

  // GET /queues/{queueId}/dashboard
  public async getQueueDashboard(queueId: string): Promise<QueueDashboard> {
    if (queueId !== this.queueDashboard.queueId) {
      throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Queue dashboard not found.');
    }
    return JSON.parse(JSON.stringify(this.queueDashboard));
  }

  // API-003: POST /queues/{queueId}/call-next
  public async callNext(queueId: string): Promise<CallNextResponse> {
    if (this.queueDashboard.activeToken !== null) {
      throw new MockApiError(
        409,
        'CONSULTATION_ALREADY_ACTIVE',
        `A consultation is already active with token ${this.queueDashboard.activeToken.displayNumber}. Complete or skip it before calling next.`
      );
    }

    if (this.queueDashboard.waitingTokens.length === 0) {
      throw new MockApiError(
        409,
        'NO_ELIGIBLE_TOKENS',
        'No waiting patients available in this queue.'
      );
    }

    // Atomic claim of head of queue
    const nextToken = this.queueDashboard.waitingTokens.shift()!;
    const now = new Date().toISOString();

    const activeToken: DashboardActiveToken = {
      id: nextToken.id,
      queueId: nextToken.queueId,
      displayNumber: nextToken.displayNumber,
      status: 'CALLED',
      priority: nextToken.priority,
      calledAt: now,
      patient: {
        id: 'pat_rahul_01',
        patientNumber: 'UHID-1001',
        displayName: 'Rahul Verma',
      },
    };

    this.queueDashboard.activeToken = activeToken;
    this.queueDashboard.updatedAt = now;

    // Update public queue
    this.publicQueue.currentDisplayNumber = nextToken.displayNumber;
    this.publicQueue.waitingCount = this.queueDashboard.waitingTokens.length;
    this.publicQueue.estimatedWaitMinutes = Math.max(0, this.publicQueue.waitingCount * 10);
    this.publicQueue.updatedAt = now;

    return {
      id: nextToken.id,
      queueId: nextToken.queueId,
      displayNumber: nextToken.displayNumber,
      status: 'CALLED',
      calledAt: now,
    };
  }

  // API-004: POST /queue-tokens/{tokenId}/complete
  public async completeToken(tokenId: string): Promise<CompleteTokenResponse> {
    if (!this.queueDashboard.activeToken || this.queueDashboard.activeToken.id !== tokenId) {
      throw new MockApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `Token ${tokenId} is not currently active or has already been completed.`
      );
    }

    const completed = this.queueDashboard.activeToken;
    const now = new Date().toISOString();

    this.queueDashboard.activeToken = null;
    this.queueDashboard.updatedAt = now;

    // Public display: retain last completed or null until next call
    this.publicQueue.updatedAt = now;

    return {
      id: completed.id,
      queueId: completed.queueId,
      displayNumber: completed.displayNumber,
      status: 'COMPLETED',
    };
  }

  // API-005: GET /queue-tokens/{tokenId}
  public async getPatientToken(tokenId: string): Promise<PatientTokenStatus> {
    for (const token of this.patientActiveTokens.values()) {
      if (token.id === tokenId) {
        return { ...token };
      }
    }

    throw new MockApiError(404, 'TOKEN_NOT_FOUND', 'Requested queue token not found.');
  }

  // GET /users/me/queue-tokens?status=active
  public async getMyActiveTokens(): Promise<ActiveQueueTokensResponse> {
    const active = Array.from(this.patientActiveTokens.values()).filter(
      (t) => t.status === 'WAITING' || t.status === 'CALLED'
    );
    return { items: active };
  }

  // API-006: GET /public/queues/{publicQueueId}
  public async getPublicQueue(publicQueueId: string): Promise<PublicQueueStatus> {
    if (publicQueueId !== this.publicQueue.publicQueueId) {
      throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Public queue display not found.');
    }
    return { ...this.publicQueue };
  }
}

export const mockApi = new MockApiService();
