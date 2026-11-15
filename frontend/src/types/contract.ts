/**
 * Hospital Queue Management System — API Contract Types
 * Directly aligned with docs/API-CONTRACT.md (Commit d15be09)
 */

// ============================================================================
// Core Enums & Machine-Readable Error Codes
// ============================================================================

export type TokenStatus = 'WAITING' | 'CALLED' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'INSUFFICIENT_PERMISSION'
  | 'UNAUTHORIZED_QUEUE_ACCESS'
  | 'RESOURCE_NOT_FOUND'
  | 'TOKEN_NOT_FOUND'
  | 'PATIENT_NOT_FOUND'
  | 'QUEUE_NOT_AVAILABLE'
  | 'DUPLICATE_WALK_IN'
  | 'NO_ELIGIBLE_TOKENS'
  | 'CONSULTATION_ALREADY_ACTIVE'
  | 'INVALID_STATE_TRANSITION';

export interface ApiErrorResponse {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
}

// ============================================================================
// API-001: Current User & Staff Assignment
// ============================================================================

export interface StaffQueueAssignment {
  id: string;
  name: string;
  doctorName?: string | null;
  roomLabel?: string | null;
}

export interface StaffAssignment {
  role: 'receptionist' | 'doctor' | 'admin' | string;
  hospitalId: string;
  department: {
    id: string;
    name: string;
  } | null;
  queues: StaffQueueAssignment[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  hospitalId?: string | null;
  staffAssignments?: StaffAssignment[];
}

// ============================================================================
// API-002: Issue Walk-In Token
// ============================================================================

export interface WalkInRequest {
  patientId: string;
  queueId: string;
}

export interface WalkInSlipMetadata {
  departmentName: string;
  roomLabel: string;
  publicQueueId: string;
}

export interface WalkInResponse {
  id: string;
  queueId: string;
  displayNumber: string;
  status: TokenStatus;
  issuedAt: string;
  slip?: WalkInSlipMetadata;
}

// ============================================================================
// API-003 & API-004: Call Next & Complete Consultation
// ============================================================================

export interface CallNextResponse {
  id: string;
  queueId: string;
  displayNumber: string;
  status: 'CALLED';
  calledAt: string;
}

export interface CompleteTokenResponse {
  id: string;
  queueId: string;
  displayNumber: string;
  status: 'COMPLETED';
}

// ============================================================================
// API-005: Patient Token Status
// ============================================================================

export interface PatientTokenStatus {
  id: string;
  queueId: string;
  displayNumber: string;
  status: TokenStatus;
  departmentName: string;
  doctorName?: string | null;
  roomLabel?: string | null;
  patientsAhead: number;
  estimatedWaitMinutes: number | null;
  updatedAt: string;
}

// ============================================================================
// API-006: Public Queue Status (Zero-PII Waiting Room & QR Display)
// ============================================================================

export interface PublicQueueStatus {
  publicQueueId: string;
  departmentName?: string | null;
  roomLabel?: string | null;
  currentDisplayNumber: string | null;
  waitingCount: number;
  estimatedWaitMinutes: number | null;
  updatedAt: string;
}

// ============================================================================
// Staff Extensions (Revision for M1 Review)
// ============================================================================

export interface StaffQueueItem {
  id: string;
  name: string;
  department: {
    id: string;
    name: string;
  };
  doctor?: {
    id: string;
    name: string;
  } | null;
  roomLabel?: string | null;
  acceptingWalkIns: boolean;
  publicQueueId: string;
}

export interface StaffQueuesResponse {
  items: StaffQueueItem[];
}

export interface PatientLookupItem {
  id: string;
  patientNumber: string;
  displayName: string;
}

export interface PatientLookupResponse {
  items: PatientLookupItem[];
}

export interface DashboardPatientInfo {
  id: string;
  patientNumber: string;
  displayName: string;
}

export interface DashboardActiveToken {
  id: string;
  queueId: string;
  displayNumber: string;
  status: 'CALLED';
  priority?: string;
  calledAt: string;
  patient?: DashboardPatientInfo;
}

export interface DashboardWaitingToken {
  id: string;
  queueId: string;
  displayNumber: string;
  status: 'WAITING';
  priority?: string;
}

export interface QueueDashboard {
  queueId: string;
  department: {
    id: string;
    name: string;
  };
  roomLabel?: string | null;
  activeToken: DashboardActiveToken | null;
  waitingTokens: DashboardWaitingToken[];
  updatedAt: string;
}

export interface ActiveQueueTokensResponse {
  items: PatientTokenStatus[];
}
