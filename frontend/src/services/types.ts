/**
 * Hospital Queue Management System — Administration Domain Models
 * Multi-tenant Administration Types & Domain Contracts
 */

import type { StaffAssignment, UserProfile, TokenStatus } from '../types/contract';

// ============================================================================
// Multi-Tenant Hospital & Administration Models
// ============================================================================

export type AdminRole = 'super_admin' | 'hospital_admin';

export type HospitalStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Hospital {
  id: string;
  name: string;
  code?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: HospitalStatus;
  createdAt: string;
  updatedAt: string;
  admins?: StaffUser[];
  departments?: Department[];
}

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  description?: string;
  status?: DepartmentStatus;
  createdAt?: string;
  updatedAt?: string;
  queues?: HospitalQueue[];
  receptionists?: StaffUser[];
}

export type QueueStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';

export interface HospitalQueue {
  id: string;
  departmentId: string;
  doctorId?: string | null;
  publicQueueId: string;
  name: string;
  roomLabel?: string | null;
  acceptingWalkIns: boolean;
  status?: QueueStatus;
  currentServingToken?: string | null;
  waitingCount?: number;
  updatedAt: string;
  doctor?: StaffUser | { id: string; name: string; email?: string } | null;
}

export type StaffUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  status: StaffUserStatus;
  roles: string[];
  permissions: string[];
  staffAssignments?: StaffAssignment[];
  hospitalId?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  queueId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:MM" e.g. "09:00"
  endTime: string; // "HH:MM" e.g. "17:00"
  slotDurationMinutes: number;
  isAvailable: boolean;
  doctorName?: string;
  queueName?: string;
  roomLabel?: string;
}

export type CounterStatus = 'ACTIVE' | 'CLOSED' | 'BREAK';

export interface ReceptionCounter {
  id: string;
  departmentId: string;
  counterNumber: number | string;
  counterLabel: string;
  status: CounterStatus;
  currentStaff?: StaffUser | { id: string; name: string; email?: string } | null;
  departmentName?: string;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  hospitalId?: string;
  departmentId?: string | null;
  tokenId?: string | null;
  source: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export type IncidentCategory =
  | 'QUEUE'
  | 'AUTH'
  | 'HARDWARE'
  | 'NETWORK'
  | 'SYNC'
  | 'PERFORMANCE'
  | 'OTHER';

export interface WebIncident {
  id: string;
  hospitalName: string;
  reporterEmail: string;
  title: string;
  severity: IncidentSeverity;
  category: IncidentCategory | string;
  description: string;
  component: string;
  status: IncidentStatus;
  createdAt: string;
  resolvedAt?: string | null;
}

// ============================================================================
// Pagination, Sorting, and Filter Helpers
// ============================================================================

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export type SortDirection = 'asc' | 'desc';

export interface TableSortState {
  field: string;
  direction: SortDirection;
}
