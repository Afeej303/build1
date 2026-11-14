import {
  UserProfile,
  StaffQueuesResponse,
  PatientLookupResponse,
  WalkInRequest,
  WalkInResponse,
  CallNextResponse,
  CompleteTokenResponse,
  PatientTokenStatus,
  PublicQueueStatus,
  QueueDashboard,
} from '../types/contract';
import { mockApi } from '../mocks/mock-api';
import { supabase } from './supabase';

export interface ApiHealthStatus {
  online: boolean;
  database: string;
  uptimeSeconds?: number;
  statusCode?: number;
  errorMessage?: string;
}

export type ErrorCategory =
  | 'NETWORK'
  | 'AUTH'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'VALIDATION'
  | 'UNKNOWN';

export class ApiError extends Error {
  public status?: number;
  public code?: string;
  public category: ErrorCategory;
  public details?: any;
  public isNetworkError: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      category?: ErrorCategory;
      details?: any;
      isNetworkError?: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
    this.isNetworkError = Boolean(options?.isNetworkError);

    if (options?.category) {
      this.category = options?.category;
    } else if (this.isNetworkError) {
      this.category = 'NETWORK';
    } else if (this.status === 401) {
      this.category = 'AUTH';
    } else if (this.status === 403) {
      this.category = 'FORBIDDEN';
    } else if (this.status === 404) {
      this.category = 'NOT_FOUND';
    } else if (this.status && this.status >= 500) {
      this.category = 'SERVER';
    } else if (this.status === 400 || this.status === 422) {
      this.category = 'VALIDATION';
    } else {
      this.category = 'UNKNOWN';
    }
  }
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://192.168.1.249:3000';
const USE_MOCK_FALLBACK =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK_FALLBACK) !== 'false';

class ApiClient {
  private token: string | null = null;

  public setToken(token: string | null) {
    this.token = token;
  }

  public async getAuthHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    let authToken = this.token;
    if (!authToken) {
      try {
        const { data } = await supabase.auth.getSession();
        authToken = data.session?.access_token || null;
      } catch {
        // Supabase session lookup silently handled
      }
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  }

  /**
   * Centralized HTTP request execution with robust error classification.
   * - Browser CORS or network drops throw ApiError with isNetworkError: true, category: 'NETWORK', code: 'BACKEND_CONNECTION_ERROR'.
   * - Never invents HTTP status codes for network failures.
   * - Preserves genuine backend status codes (401, 403, 404, 500) and backend error codes.
   */
  public async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    const defaultHeaders = await this.getAuthHeaders();
    const headers = {
      ...defaultHeaders,
      ...(options.headers || {}),
    };

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      // Browser network or CORS failure: TypeError: Failed to fetch
      throw new ApiError(
        `Unable to reach backend service at ${API_BASE_URL}. Check network connection and CORS configuration.`,
        {
          isNetworkError: true,
          category: 'NETWORK',
          code: 'BACKEND_CONNECTION_ERROR',
          cause: err,
        }
      );
    }

    if (!res.ok) {
      let errorBody: any = {};
      try {
        errorBody = await res.json();
      } catch {
        // Not JSON
      }
      const message = errorBody?.message || `Request to ${path} failed with HTTP ${res.status}`;
      const code = errorBody?.code || errorBody?.error;
      throw new ApiError(message, {
        status: res.status,
        code: typeof code === 'string' ? code : undefined,
        details: errorBody,
      });
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  // Check /health endpoint
  public async checkHealth(): Promise<ApiHealthStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        return {
          online: false,
          database: 'unknown',
          statusCode: res.status,
          errorMessage: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      return {
        online: data.status === 'ok',
        database: data.database || 'connected',
        uptimeSeconds: data.uptimeSeconds,
        statusCode: 200,
      };
    } catch (err: any) {
      return {
        online: false,
        database: 'unreachable',
        errorMessage: err.message || 'Network unreachable',
      };
    }
  }

  // GET /users/me
  public async getCurrentUser(): Promise<UserProfile> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/users/me`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 401 && USE_MOCK_FALLBACK) {
        // Unauthenticated on live backend, fallback to mock data
        return await mockApi.getMe();
      }
      throw new Error(`Live API /users/me failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getMe();
      }
      throw err;
    }
  }

  // GET /staff/queues
  public async getStaffQueues(): Promise<StaffQueuesResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/staff/queues`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getStaffQueues();
      }
      throw new Error(`Failed to fetch staff queues: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getStaffQueues();
      }
      throw err;
    }
  }

  // GET /staff/patients/lookup?patientNumber=...
  public async lookupPatient(patientNumber: string): Promise<PatientLookupResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/staff/patients/lookup?patientNumber=${encodeURIComponent(patientNumber)}`, {
        headers,
      });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.lookupPatient(patientNumber);
      }
      throw new Error(`Patient lookup failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.lookupPatient(patientNumber);
      }
      throw err;
    }
  }

  // POST /walk-ins
  public async issueWalkIn(request: WalkInRequest): Promise<WalkInResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/walk-ins`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.issueWalkIn(request.patientId, request.queueId);
      }
      throw new Error(`Issue walk-in failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.issueWalkIn(request.patientId, request.queueId);
      }
      throw err;
    }
  }

  // GET /queues/{queueId}/dashboard
  public async getQueueDashboard(queueId: string): Promise<QueueDashboard> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/queues/${queueId}/dashboard`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getQueueDashboard(queueId);
      }
      throw new Error(`Dashboard fetch failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getQueueDashboard(queueId);
      }
      throw err;
    }
  }

  // POST /queues/{queueId}/call-next
  public async callNext(queueId: string): Promise<CallNextResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/queues/${queueId}/call-next`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.callNext(queueId);
      }
      throw new Error(`Call next failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.callNext(queueId);
      }
      throw err;
    }
  }

  // POST /queue-tokens/{tokenId}/complete
  public async completeToken(tokenId: string): Promise<CompleteTokenResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/queue-tokens/${tokenId}/complete`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.completeToken(tokenId);
      }
      throw new Error(`Complete token failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.completeToken(tokenId);
      }
      throw err;
    }
  }

  // GET /queue-tokens/{tokenId}
  public async getPatientToken(tokenId: string): Promise<PatientTokenStatus> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/queue-tokens/${tokenId}`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getPatientToken(tokenId);
      }
      throw new Error(`Get patient token failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getPatientToken(tokenId);
      }
      throw err;
    }
  }

  // GET /users/me/queue-tokens?status=active
  public async getActivePatientTokens(): Promise<{ items: PatientTokenStatus[] }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/users/me/queue-tokens?status=active`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK || res.status >= 500) {
        return { items: [] };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch active tokens: ${res.status} [${err.code || 'ERROR'}]`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return { items: [] };
      }
      throw err;
    }
  }

  // GET /public/queues/{publicQueueId} (Zero PII, unauthenticated)
  public async getPublicQueue(publicQueueId: string): Promise<PublicQueueStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/public/queues/${publicQueueId}`);
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getPublicQueue(publicQueueId);
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Public queue fetch failed: ${res.status}`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return await mockApi.getPublicQueue(publicQueueId);
      }
      throw err;
    }
  }

  // --- M2 Appointment & Profile Endpoints ---

  // GET /appointment-queues
  public async getAppointmentQueues(): Promise<{ items: any[] }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/appointment-queues`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK || res.status >= 500) {
        return { items: [] };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch appointment queues: ${res.status} [${err.code || 'ERROR'}]`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return { items: [] };
      }
      throw err;
    }
  }

  // GET /users/me/patients
  public async getMyPatients(): Promise<{ items: any[] }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/users/me/patients`, { headers });
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK || res.status >= 500) {
        return { items: [] };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch patients: ${res.status} [${err.code || 'ERROR'}]`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return { items: [] };
      }
      throw err;
    }
  }

  // POST /patients/self
  public async selfRegisterPatient(hospitalId: string, displayName: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/patients/self`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ hospitalId, displayName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Self-registration failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // PATCH /users/me/patients/:patientId
  public async updatePatientProfile(
    patientId: string,
    data: { displayName?: string; phone?: string | null; gender?: string | null; dateOfBirth?: string | null }
  ): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/users/me/patients/${patientId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Profile update failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // POST /staff/patients
  public async registerStaffPatient(queueId: string, displayName: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/staff/patients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ queueId, displayName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Staff patient registration failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // POST /queues/:queueId/appointment-slots (Doctor publishes slot)
  public async publishSlot(queueId: string, startsAt: string, endsAt: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/queues/${queueId}/appointment-slots`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ startsAt, endsAt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Publish slot failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // GET /queues/:queueId/appointment-slots?from=...&to=...
  public async getAvailableSlots(queueId: string, from: string, to: string): Promise<{ items: any[] }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(
        `${API_BASE_URL}/queues/${queueId}/appointment-slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers }
      );
      if (res.ok) {
        return await res.json();
      }
      if (USE_MOCK_FALLBACK || res.status >= 500) {
        return { items: [] };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch slots: ${res.status} [${err.code || 'ERROR'}]`);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        return { items: [] };
      }
      throw err;
    }
  }

  // POST /appointments (Patient or staff books slot)
  public async bookAppointment(slotId: string, patientId?: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(patientId ? { slotId, patientId } : { slotId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Appointment booking failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // GET /users/me/appointments?from=...&to=...
  public async getMyAppointments(from: string, to: string): Promise<{ items: any[] }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/users/me/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch my appointments: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // GET /staff/appointments?from=...&to=...
  public async getStaffAppointments(from: string, to: string): Promise<{ items: any[] }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/staff/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch staff appointments: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // POST /appointments/:appointmentId/check-in (Returns queue token)
  public async checkInAppointment(appointmentId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/check-in`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Check-in failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // POST /appointments/:appointmentId/cancel
  public async cancelAppointment(appointmentId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Appointment cancellation failed: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // GET /staff/audit-log
  public async getStaffAuditLog(): Promise<{ items: any[] }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/staff/audit-log`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch audit log: ${res.status} [${err.code || 'ERROR'}]`);
    }
    return await res.json();
  }

  // ============================================================================
  // Admin & Higher-Level Governance Endpoints
  // ============================================================================

  // GET /admin/hospitals (Hospitals, departments, queues, doctors, receptionists)
  public async getAdminHospitals(): Promise<any[]> {
    return this.request<any[]>('/admin/hospitals');
  }

  // GET /audit-logs?page=...&limit=... (System-wide audit event stream)
  public async getSystemAuditLogs(page = 1, limit = 25): Promise<{ items: any[]; meta: any }> {
    return this.request<{ items: any[]; meta: any }>(`/audit-logs?page=${page}&limit=${limit}`);
  }

  // GET /users?page=...&limit=... (Platform users directory)
  public async getPlatformUsers(page = 1, limit = 50): Promise<{ items: any[]; meta: any }> {
    return this.request<{ items: any[]; meta: any }>(`/users?page=${page}&limit=${limit}`);
  }

  // GET /roles (RBAC roles list)
  public async getPlatformRoles(): Promise<any[]> {
    return this.request<any[]>('/roles');
  }

  // GET /permissions (System permissions list)
  public async getPlatformPermissions(): Promise<any[]> {
    return this.request<any[]>('/permissions');
  }

  // POST /admin/hospitals (Create/Onboard a new hospital)
  public async createHospital(name: string): Promise<any> {
    return this.request<any>('/admin/hospitals', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // POST /admin/hospitals/:hospitalId/departments (Create a department for a hospital)
  public async createDepartment(hospitalId: string, name: string): Promise<any> {
    return this.request<any>(`/admin/hospitals/${hospitalId}/departments`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // POST /admin/departments/:departmentId/queues (Create a queue for a department)
  public async createQueue(departmentId: string, name: string, roomLabel?: string): Promise<any> {
    return this.request<any>(`/admin/departments/${departmentId}/queues`, {
      method: 'POST',
      body: JSON.stringify({ name, roomLabel: roomLabel || undefined }),
    });
  }

  // PATCH /admin/queues/:queueId (Assign doctor or update queue)
  public async assignDoctorToQueue(queueId: string, doctorId: string | null): Promise<any> {
    return this.request<any>(`/admin/queues/${queueId}`, {
      method: 'PATCH',
      body: JSON.stringify({ doctorId }),
    });
  }
}

export const apiClient = new ApiClient();
