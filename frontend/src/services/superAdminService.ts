/**
 * Hospital Queue Management System — Super Admin Service
 * Provides typed domain operations for platform-wide hospital management,
 * identity directories, RBAC queries, and system audit event logs.
 */

import { apiClient } from '../lib/api-client';
import type { Hospital, AuditLogEntry, StaffUser } from './types';

export interface PlatformRole {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
  createdAt?: string;
}

export interface PlatformPermission {
  id: string;
  key: string;
  name?: string;
  description?: string;
  category?: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING' | string;
  roles: string[];
  permissions?: string[];
  hospitalId?: string | null;
  hospitalName?: string | null;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSignInAt?: string;
}

export interface AuditLogPaginationMeta {
  page: number;
  limit: number;
  totalItems?: number;
  totalPages?: number;
  total?: number;
}

export interface SystemAuditLogsResponse {
  items: AuditLogEntry[];
  meta: AuditLogPaginationMeta;
}

export interface PlatformUsersResponse {
  items: PlatformUser[];
  meta: AuditLogPaginationMeta;
}

/**
 * Fetch all platform hospitals, including department hierarchies and assigned staff.
 */
export async function fetchHospitals(): Promise<Hospital[]> {
  const data = await apiClient.getAdminHospitals();
  return Array.isArray(data) ? data : [];
}

/**
 * Provision / Onboard a new hospital entity.
 */
export async function createHospital(name: string): Promise<Hospital> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Hospital name is required.');
  }
  return await apiClient.createHospital(trimmedName);
}

/**
 * Query system-wide audit event streams with page & limit parameters.
 */
export async function fetchAuditLogs(
  page: number = 1,
  limit: number = 25
): Promise<SystemAuditLogsResponse> {
  const result = await apiClient.getSystemAuditLogs(page, limit);
  const items = Array.isArray(result?.items) ? result.items : [];
  const meta: AuditLogPaginationMeta = {
    page: result?.meta?.page ?? page,
    limit: result?.meta?.limit ?? limit,
    totalItems: result?.meta?.totalItems ?? result?.meta?.total ?? items.length,
    totalPages:
      result?.meta?.totalPages ??
      Math.max(1, Math.ceil((result?.meta?.totalItems ?? items.length) / limit)),
  };
  return { items, meta };
}

/**
 * Query platform identity users directory.
 */
export async function fetchUsers(
  page: number = 1,
  limit: number = 50
): Promise<PlatformUsersResponse> {
  const result = await apiClient.getPlatformUsers(page, limit);
  const rawItems = Array.isArray(result?.items) ? result.items : [];
  
  // Normalize user items to ensure consistent schema
  const items: PlatformUser[] = rawItems.map((u: any) => ({
    id: u.id || u.user_id || '',
    email: u.email || '',
    name: u.name || u.displayName || u.raw_user_meta_data?.name || (u.email ? u.email.split('@')[0] : 'User'),
    displayName: u.displayName || u.name,
    status: u.status || 'ACTIVE',
    roles: Array.isArray(u.roles)
      ? u.roles
      : u.role
      ? [u.role]
      : u.raw_user_meta_data?.role
      ? [u.raw_user_meta_data.role]
      : ['patient'],
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    hospitalId: u.hospitalId || u.hospital_id || null,
    hospitalName: u.hospitalName || u.hospital?.name || null,
    phone: u.phone || u.phone_number || undefined,
    createdAt: u.createdAt || u.created_at || new Date().toISOString(),
    updatedAt: u.updatedAt || u.updated_at || undefined,
    lastSignInAt: u.lastSignInAt || u.last_sign_in_at || undefined,
  }));

  const meta: AuditLogPaginationMeta = {
    page: result?.meta?.page ?? page,
    limit: result?.meta?.limit ?? limit,
    totalItems: result?.meta?.totalItems ?? result?.meta?.total ?? items.length,
    totalPages:
      result?.meta?.totalPages ??
      Math.max(1, Math.ceil((result?.meta?.totalItems ?? items.length) / limit)),
  };

  return { items, meta };
}

/**
 * Fetch platform RBAC roles definition list.
 */
export async function fetchRoles(): Promise<PlatformRole[]> {
  try {
    const roles = await apiClient.getPlatformRoles();
    return Array.isArray(roles) ? roles : [];
  } catch {
    // Standard baseline fallback roles if backend table is unseeded
    return [
      { id: 'role-super-admin', name: 'super_admin', description: 'Complete platform administration & governance authority' },
      { id: 'role-hospital-admin', name: 'hospital_admin', description: 'Hospital-level administration: departments, queues, schedules' },
      { id: 'role-doctor', name: 'doctor', description: 'Clinical provider: consultation, queue call, slot management' },
      { id: 'role-receptionist', name: 'receptionist', description: 'Desk operator: walk-in intake, token generation, triage' },
      { id: 'role-patient', name: 'patient', description: 'Self-service patient: token tracking, appointment booking' },
    ];
  }
}

/**
 * Fetch platform system permissions list.
 */
export async function fetchPermissions(): Promise<PlatformPermission[]> {
  try {
    const permissions = await apiClient.getPlatformPermissions();
    return Array.isArray(permissions) ? permissions : [];
  } catch {
    // Standard baseline fallback permissions
    return [
      { id: 'perm-hospitals-read', key: 'hospitals:read', name: 'View Hospitals', category: 'Hospital' },
      { id: 'perm-hospitals-write', key: 'hospitals:write', name: 'Create & Manage Hospitals', category: 'Hospital' },
      { id: 'perm-users-read', key: 'users:read', name: 'View Platform Identities', category: 'Identity' },
      { id: 'perm-users-write', key: 'users:write', name: 'Manage Platform Identities', category: 'Identity' },
      { id: 'perm-audit-read', key: 'audit:read', name: 'Inspect Audit Logs', category: 'Governance' },
      { id: 'perm-queues-manage', key: 'queues:manage', name: 'Administer Clinical Queues', category: 'Clinical' },
    ];
  }
}

export const superAdminService = {
  fetchHospitals,
  createHospital,
  fetchAuditLogs,
  fetchUsers,
  fetchRoles,
  fetchPermissions,
};
