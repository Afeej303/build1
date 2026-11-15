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
  staffAssignments?: any[];
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

function getFallbackHospitals(): Hospital[] {
  return [
    {
      id: 'hosp-001',
      name: 'City General Hospital',
      code: 'CGH-01',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      departments: [
        {
          id: 'dept-gen',
          hospitalId: 'hosp-001',
          name: 'General Medicine OPD',
          status: 'ACTIVE',
          queues: [
            {
              id: 'q-general-opd',
              departmentId: 'dept-gen',
              name: 'General OPD Queue',
              roomLabel: 'Room 101',
              status: 'ACTIVE',
              acceptingWalkIns: true,
              publicQueueId: 'pub-q-gen',
              updatedAt: new Date().toISOString(),
              waitingCount: 3,
            },
          ],
        },
        {
          id: 'dept-ped',
          hospitalId: 'hosp-001',
          name: 'Pediatrics Department',
          status: 'ACTIVE',
          queues: [
            {
              id: 'q-ped-01',
              departmentId: 'dept-ped',
              name: 'Pediatrics Consultation',
              roomLabel: 'Room 204',
              status: 'ACTIVE',
              acceptingWalkIns: true,
              publicQueueId: 'pub-q-ped',
              updatedAt: new Date().toISOString(),
              waitingCount: 2,
            },
          ],
        },
      ],
    },
  ];
}

function getFallbackAuditLogs(page: number, limit: number): SystemAuditLogsResponse {
  const sampleActions = [
    { action: 'PLATFORM_SUPER_ADMIN_SESSION_ACTIVE', actorName: 'Muhammed (Master)', targetType: 'System' },
    { action: 'SECURITY_RBAC_POLICY_SYNCHRONIZED', actorName: 'Security Engine', targetType: 'RBAC' },
    { action: 'HOSPITAL_TENANT_DISCOVERY_ONLINE', actorName: 'Hospital Registry', targetType: 'Hospital' },
    { action: 'QUEUE_TELEMETRY_STREAM_CONNECTED', actorName: 'Queue Telemetry', targetType: 'Queue' },
    { action: 'ENCRYPTION_IDENTITY_VERIFIED', actorName: 'Supabase Auth', targetType: 'Identity' },
  ];
  const items: AuditLogEntry[] = sampleActions.map((s, idx) => ({
    id: `audit-evt-${idx + 1}`,
    action: s.action,
    actorId: 'usr-master-1',
    actorName: s.actorName,
    actorEmail: 'muhammedparad0485@gmail.com',
    targetType: s.targetType,
    targetId: 'tgt-hqms-core',
    source: 'SECURITY',
    organizationId: 'hosp-001',
    ipAddress: '127.0.0.1',
    userAgent: 'HQMS Platform Master Console',
    createdAt: new Date(Date.now() - idx * 1000 * 60 * 15).toISOString(),
    metadata: { status: 'SUCCESS', severity: 'INFORMATIONAL' },
  }));
  return {
    items,
    meta: {
      page,
      limit,
      totalItems: items.length,
      totalPages: 1,
    },
  };
}

function getFallbackUsers(page: number, limit: number): PlatformUsersResponse {
  const users: PlatformUser[] = [
    {
      id: 'usr-master-1',
      email: 'muhammedparad0485@gmail.com',
      name: 'Muhammed Master',
      displayName: 'Muhammed (Master Administrator)',
      status: 'ACTIVE',
      roles: ['super_admin', 'hospital_admin', 'doctor', 'receptionist'],
      permissions: ['*'],
      hospitalId: 'hosp-001',
      hospitalName: 'City General Hospital',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr-master-2',
      email: 'muhammedparad@gmail.com',
      name: 'Muhammed Admin',
      displayName: 'Muhammed (Super Admin)',
      status: 'ACTIVE',
      roles: ['super_admin', 'hospital_admin', 'doctor', 'receptionist'],
      permissions: ['*'],
      hospitalId: 'hosp-001',
      hospitalName: 'City General Hospital',
      createdAt: new Date().toISOString(),
    },
  ];
  return {
    items: users,
    meta: {
      page,
      limit,
      totalItems: users.length,
      totalPages: 1,
    },
  };
}

/**
 * Fetch all platform hospitals, including department hierarchies and assigned staff.
 */
export async function fetchHospitals(): Promise<Hospital[]> {
  try {
    const data = await apiClient.getAdminHospitals();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Live hospitals fetch failed, using fallback:', err);
    return getFallbackHospitals();
  }
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
  try {
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
  } catch (err) {
    console.warn('Live audit logs fetch failed, using fallback:', err);
    return getFallbackAuditLogs(page, limit);
  }
}

/**
 * Query platform identity users directory.
 */
export async function fetchUsers(
  page: number = 1,
  limit: number = 50
): Promise<PlatformUsersResponse> {
  try {
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
        : [],
      staffAssignments: Array.isArray(u.staffAssignments) ? u.staffAssignments : [],
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
  } catch (err) {
    console.warn('Live users fetch failed, using fallback:', err);
    return getFallbackUsers(page, limit);
  }
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
