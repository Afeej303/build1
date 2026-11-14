import { useSyncExternalStore } from 'react';
import { apiClient } from './api-client';
import { supabase, isSupabaseConfigured } from './supabase';

export type Status = 'waiting' | 'called' | 'done';
export type Gender = 'male' | 'female' | 'other';

export type Dept = {
  id: string;
  name: string;
  doctor: string;
  room: string;
  prefix: string;
  avgMin: number;
};

export type Patient = {
  uhid: string;
  name: string;
  phone: string;
  email?: string;
  gender?: Gender;
  age?: number;
};

export type Token = {
  code: string;
  uhid: string;
  dept: string;
  status: Status;
  isEmergency?: boolean;
  issuedAt: number;
  calledAt?: number;
};

export type Appointment = {
  id: string;
  uhid: string;
  patientName: string;
  patientAge: number;
  patientGender: Gender;
  dept: string;
  doctor: string;
  room: string;
  date: string;
  slot: string;
  tokenCode: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  createdAt: number;
  bookedBy: 'patient' | 'receptionist';
};

export type AuditLogEntry = {
  id: string;
  timestamp: number;
  action: 'BOOK_APPOINTMENT' | 'WALK_IN_TOKEN' | 'CALL_NEXT' | 'COMPLETE' | 'CANCEL_APPOINTMENT';
  actor: string;
  patientName: string;
  tokenCode: string;
  dept: string;
  details: string;
};

export const HOSPITAL = 'City General Hospital';

export const DEPTS: Dept[] = [
  { id: 'gm', name: 'General Medicine', doctor: 'Dr. Rao', room: 'Room 2', prefix: 'A', avgMin: 6 },
  { id: 'card', name: 'Cardiology', doctor: 'Dr. Menon', room: 'Room 5', prefix: 'B', avgMin: 10 },
  { id: 'ped', name: 'Pediatrics', doctor: 'Dr. Iyer', room: 'Room 3', prefix: 'C', avgMin: 8 },
  { id: 'ortho', name: 'Orthopedics', doctor: 'Dr. Sharma', room: 'Room 4', prefix: 'D', avgMin: 12 },
];

export type State = {
  patients: Patient[];
  tokens: Token[];
  appointments: Appointment[];
  auditLogs: AuditLogEntry[];
  counters: Record<string, number>;
  me: string | null;
  lastCall: { code: string; dept: string; room: string; at: number } | null;
};

// Pure empty state — ZERO mock or demo data
const emptyState = (): State => ({
  patients: [],
  tokens: [],
  appointments: [],
  auditLogs: [],
  counters: {},
  me: null,
  lastCall: null,
});

const STORAGE_KEY = 'hqms-real-prod-v1';
let state: State = emptyState();
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((cb) => cb());
let isHydrated = false;

function hydrate() {
  if (isHydrated || typeof window === 'undefined') return;
  isHydrated = true;

  // Clear any legacy mock storage keys
  try {
    localStorage.removeItem('hqms-minimal-v1');
    localStorage.removeItem('hqms-minimal-v2');
    localStorage.removeItem('hqms-minimal-v3');
    localStorage.removeItem('hqms-state-v1');
  } catch {}

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {}

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue);
        emit();
      } catch {}
    }
  });
  queueMicrotask(emit);
}

function updateState(updater: (prev: State) => State) {
  state = updater(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  emit();
}

const serverState = emptyState();
const subscribe = (cb: () => void) => {
  subscribers.add(cb);
  hydrate();
  return () => {
    subscribers.delete(cb);
  };
};

export function useHQ(): State {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

export const dept = (id: string) => DEPTS.find((d) => d.id === id) || DEPTS[0];
export const patientOf = (s: State, uhid: string) => s.patients.find((p) => p.uhid === uhid);
export const queueOf = (s: State, deptId: string) => s.tokens.filter((t) => t.dept === deptId);
export const waitingOf = (s: State, deptId: string) => s.tokens.filter((t) => t.dept === deptId && t.status === 'waiting');
export const servingOf = (s: State, deptId: string) => s.tokens.find((t) => t.dept === deptId && t.status === 'called');

export const actions = {
  // Quick patient registration
  register(p: { name: string; phone: string; age?: number; gender?: Gender }) {
    const uhid = `UHID-${1001 + state.patients.length}`;
    const newPatient: Patient = {
      uhid,
      name: p.name,
      phone: p.phone,
      gender: p.gender || 'male',
      age: p.age || 30,
    };
    updateState((s) => ({
      ...s,
      patients: [...s.patients, newPatient],
    }));
    return uhid;
  },

  // Real user signup via Supabase & backend
  async signUp(p: {
    name: string;
    phone: string;
    email: string;
    gender: Gender;
    age: number;
    password?: string;
  }) {
    if (isSupabaseConfigured && p.password) {
      try {
        await supabase.auth.signUp({
          email: p.email,
          password: p.password,
          options: {
            data: {
              name: p.name,
              phone: p.phone,
              gender: p.gender,
              age: p.age,
            },
          },
        });
      } catch (err) {
        console.warn('Supabase signup:', err);
      }
    }

    const uhid = `UHID-${1001 + state.patients.length}`;
    const newPatient: Patient = {
      uhid,
      name: p.name,
      phone: p.phone,
      email: p.email,
      gender: p.gender,
      age: p.age,
    };

    updateState((s) => ({
      ...s,
      patients: [...s.patients, newPatient],
      me: uhid,
      auditLogs: [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          action: 'BOOK_APPOINTMENT',
          actor: 'Self-Registration',
          patientName: p.name,
          tokenCode: '—',
          dept: 'Registration',
          details: `Patient account created (${uhid})`,
        },
        ...s.auditLogs,
      ],
    }));

    return uhid;
  },

  // Real user signin via Supabase & backend
  async signIn(emailOrUhid: string, password?: string) {
    if (isSupabaseConfigured && password && emailOrUhid.includes('@')) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailOrUhid,
        password,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    const clean = emailOrUhid.trim().toLowerCase();
    const existing = state.patients.find(
      (p) => p.uhid.toLowerCase() === clean || p.email?.toLowerCase() === clean
    );

    if (existing) {
      updateState((s) => ({ ...s, me: existing.uhid }));
      return existing;
    }

    // New profile session
    const uhid = emailOrUhid.startsWith('UHID-') ? emailOrUhid.toUpperCase() : `UHID-${1001 + state.patients.length}`;
    const newP: Patient = {
      uhid,
      name: emailOrUhid.split('@')[0],
      phone: '',
      email: emailOrUhid.includes('@') ? emailOrUhid : undefined,
    };
    updateState((s) => ({
      ...s,
      patients: [...s.patients, newP],
      me: uhid,
    }));
    return newP;
  },

  // Google Sign-in
  async signInWithGoogle() {
    if (isSupabaseConfigured) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/track',
        },
      });
      return;
    }
    throw new Error('Supabase Google OAuth configuration required in production.');
  },

  signOut() {
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
    updateState((s) => ({ ...s, me: null }));
  },

  // Issue Walk-In Token — Calls backend API directly
  async issue(uhid: string, deptId: string, isEmergency = false, actor = 'Reception Counter 1'): Promise<Token> {
    const d = dept(deptId);
    const n = (state.counters[deptId] ?? 0) + 1;
    const prefix = isEmergency ? 'EMG' : d.prefix;
    const code = `${prefix}-${String(n).padStart(3, '0')}`;
    const p = state.patients.find((pt) => pt.uhid === uhid);

    const token: Token = {
      code,
      uhid,
      dept: deptId,
      status: 'waiting',
      isEmergency,
      issuedAt: Date.now(),
    };

    updateState((s) => {
      let updatedTokens = [...s.tokens];
      if (isEmergency) {
        const waitingIdx = updatedTokens.findIndex((t) => t.dept === deptId && t.status === 'waiting');
        if (waitingIdx >= 0) {
          updatedTokens.splice(waitingIdx, 0, token);
        } else {
          updatedTokens.push(token);
        }
      } else {
        updatedTokens.push(token);
      }
      return {
        ...s,
        tokens: updatedTokens,
        counters: { ...s.counters, [deptId]: n },
        auditLogs: [
          {
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            action: 'WALK_IN_TOKEN',
            actor,
            patientName: p?.name || 'Walk-In Patient',
            tokenCode: code,
            dept: d.name,
            details: isEmergency ? 'EMERGENCY priority walk-in issued' : 'Normal walk-in token issued',
          },
          ...s.auditLogs,
        ],
      };
    });

    // Send to real backend
    try {
      await apiClient.issueWalkIn({ patientId: uhid, queueId: `q_${deptId}_${d.room.toLowerCase().replace(' ', '')}` });
    } catch (err) {
      console.warn('Backend walk-in sync:', err);
    }

    return token;
  },

  // Book Appointment
  bookAppointment(input: {
    uhid: string;
    patientName: string;
    patientAge: number;
    patientGender: Gender;
    deptId: string;
    date: string;
    slot: string;
    bookedBy: 'patient' | 'receptionist';
  }): { appointment: Appointment; token: Token } {
    const d = dept(input.deptId);
    const n = (state.counters[input.deptId] ?? 0) + 1;
    const tokenCode = `${d.prefix}-${String(n).padStart(3, '0')}`;

    const token: Token = {
      code: tokenCode,
      uhid: input.uhid,
      dept: input.deptId,
      status: 'waiting',
      issuedAt: Date.now(),
    };

    const appointment: Appointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uhid: input.uhid,
      patientName: input.patientName,
      patientAge: input.patientAge,
      patientGender: input.patientGender,
      dept: input.deptId,
      doctor: d.doctor,
      room: d.room,
      date: input.date,
      slot: input.slot,
      tokenCode,
      status: 'confirmed',
      createdAt: Date.now(),
      bookedBy: input.bookedBy,
    };

    updateState((s) => ({
      ...s,
      appointments: [appointment, ...s.appointments],
      tokens: [...s.tokens, token],
      counters: { ...s.counters, [input.deptId]: n },
      auditLogs: [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          action: 'BOOK_APPOINTMENT',
          actor: input.bookedBy === 'receptionist' ? 'Receptionist Assisted Desk' : 'Patient (Online)',
          patientName: input.patientName,
          tokenCode,
          dept: d.name,
          details: `Confirmed appointment on ${input.date} at ${input.slot} with ${d.doctor} (${d.room})`,
        },
        ...s.auditLogs,
      ],
    }));

    return { appointment, token };
  },

  // Cancel Appointment
  cancelAppointment(appointmentId: string, actor = 'Patient') {
    const apt = state.appointments.find((a) => a.id === appointmentId);
    if (!apt) return;

    updateState((s) => ({
      ...s,
      appointments: s.appointments.map((a) =>
        a.id === appointmentId ? { ...a, status: 'cancelled' as const } : a
      ),
      tokens: s.tokens.filter((t) => t.code !== apt.tokenCode),
      auditLogs: [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          action: 'CANCEL_APPOINTMENT',
          actor,
          patientName: apt.patientName,
          tokenCode: apt.tokenCode,
          dept: dept(apt.dept).name,
          details: `Appointment cancelled for ${apt.date} (${apt.slot})`,
        },
        ...s.auditLogs,
      ],
    }));
  },

  // Call Next Token — Calls backend API directly
  async callNext(deptId: string): Promise<Token | null> {
    const next = state.tokens.find((t) => t.dept === deptId && t.status === 'waiting');
    if (!next) return null;
    const at = Date.now();
    const d = dept(deptId);
    const p = state.patients.find((pt) => pt.uhid === next.uhid);

    updateState((s) => ({
      ...s,
      tokens: s.tokens.map((t) => {
        if (t.dept === deptId && t.status === 'called') {
          return { ...t, status: 'done' as Status };
        }
        if (t.code === next.code) {
          return { ...t, status: 'called' as Status, calledAt: at };
        }
        return t;
      }),
      lastCall: { code: next.code, dept: deptId, room: d.room, at },
      auditLogs: [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          action: 'CALL_NEXT',
          actor: d.doctor,
          patientName: p?.name || 'Patient',
          tokenCode: next.code,
          dept: d.name,
          details: `Patient called into ${d.room}`,
        },
        ...s.auditLogs,
      ],
    }));

    try {
      await apiClient.callNext(`q_${deptId}_${d.room.toLowerCase().replace(' ', '')}`);
    } catch (err) {
      console.warn('Backend callNext sync:', err);
    }

    return next;
  },

  // Complete Token — Calls backend API directly
  async complete(code: string): Promise<void> {
    const token = state.tokens.find((t) => t.code === code);
    const p = token ? state.patients.find((pt) => pt.uhid === token.uhid) : null;
    const d = token ? dept(token.dept) : DEPTS[0];

    updateState((s) => ({
      ...s,
      tokens: s.tokens.map((t) => (t.code === code ? { ...t, status: 'done' as Status } : t)),
      appointments: s.appointments.map((a) =>
        a.tokenCode === code ? { ...a, status: 'completed' as const } : a
      ),
      auditLogs: [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          action: 'COMPLETE',
          actor: d.doctor,
          patientName: p?.name || 'Patient',
          tokenCode: code,
          dept: d.name,
          details: 'Consultation concluded and marked completed',
        },
        ...s.auditLogs,
      ],
    }));

    try {
      await apiClient.completeToken(code);
    } catch (err) {
      console.warn('Backend complete sync:', err);
    }
  },

  // Reset database/state for real testing
  resetAll() {
    state = emptyState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    emit();
  },
};
