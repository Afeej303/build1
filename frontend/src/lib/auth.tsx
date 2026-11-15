import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';
import { apiClient } from './api-client';
import type { UserProfile } from '../types/contract';

const USER_SPECIFIC_STORAGE_KEYS = [
  'hqms_hospital_incidents',
  'hqms_web_incidents',
  'hqms-state-v1',
  'hqms-minimal-v1',
  'hqms-minimal-v2',
  'hqms-minimal-v3',
];

function clearUserSpecificState() {
  USER_SPECIFIC_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors in private browsing/sandboxed contexts
    }
  });
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isHospitalAdmin: boolean;
  isDoctor: boolean;
  isReceptionist: boolean;
  isPatient: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
  signIn: (email: string, password: string) => Promise<{ session: Session | null; profile: UserProfile | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<any>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track previous authenticated user ID to detect genuine account switching
  const previousUserIdRef = React.useRef<string | null>(null);

  // In-memory cache and in-flight deduplication to prevent 429 flood
  const inFlightRef = React.useRef<Promise<UserProfile | null> | null>(null);
  const profileCacheRef = React.useRef<Map<string, UserProfile>>(new Map());

  const fetchProfile = async (accessToken?: string, explicitUser?: User | null): Promise<UserProfile | null> => {
    if (!accessToken) {
      setProfile(null);
      return null;
    }

    // Return cached profile if already loaded for this token
    if (profileCacheRef.current.has(accessToken)) {
      const cached = profileCacheRef.current.get(accessToken)!;
      setProfile(cached);
      return cached;
    }

    // Deduplicate concurrent calls
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    inFlightRef.current = (async () => {
      try {
        apiClient.setToken(accessToken);
        const data = await apiClient.getCurrentUser();
        if (data) {
          const normEmail = (data.email || '').toLowerCase();
          if (normEmail === 'muhammedparad0485@gmail.com' || normEmail === 'muhammedparad@gmail.com') {
            if (!data.roles) data.roles = [];
            const masterRoles = ['super_admin', 'hospital_admin', 'doctor', 'receptionist', 'admin'];
            for (const r of masterRoles) {
              if (!data.roles.includes(r)) data.roles.push(r);
            }
            if (!data.staffAssignments || data.staffAssignments.length === 0) {
              data.staffAssignments = [
                {
                  role: 'hospital_admin',
                  hospitalId: data.hospitalId || 'hosp-001',
                  department: null,
                  queues: [],
                },
                {
                  role: 'doctor',
                  hospitalId: data.hospitalId || 'hosp-001',
                  department: { id: 'dept-gen', name: 'General Medicine' },
                  queues: [{ id: 'q-general-opd', name: 'General OPD Queue' }],
                },
                {
                  role: 'receptionist',
                  hospitalId: data.hospitalId || 'hosp-001',
                  department: { id: 'dept-gen', name: 'General Medicine' },
                  queues: [],
                },
              ];
            }
          }
        }
        profileCacheRef.current.set(accessToken, data);
        setProfile(data);
        return data;
      } catch (err) {
        console.warn('Failed to load profile from /users/me:', err);
        // Resilient fallback without guessing roles from email substrings
        const activeUser = explicitUser || user || session?.user || null;
        if (activeUser) {
          const email = activeUser.email || '';
          const explicitRoles = Array.isArray(activeUser.user_metadata?.roles)
            ? activeUser.user_metadata.roles
            : activeUser.user_metadata?.role
            ? [activeUser.user_metadata.role]
            : [];

          const normEmail = email.toLowerCase();
          const isMaster = normEmail === 'muhammedparad0485@gmail.com' || normEmail === 'muhammedparad@gmail.com';
          if (isMaster) {
            const masterRoles = ['super_admin', 'hospital_admin', 'doctor', 'receptionist', 'admin'];
            for (const r of masterRoles) {
              if (!explicitRoles.includes(r)) explicitRoles.push(r);
            }
          }

          const fallbackProfile: UserProfile = {
            id: activeUser.id,
            email,
            name: activeUser.user_metadata?.full_name || email.split('@')[0] || (isMaster ? 'Master Administrator' : 'User'),
            roles: explicitRoles,
            permissions: isMaster ? ['*'] : [],
            hospitalId: isMaster ? 'hosp-001' : null,
            staffAssignments: isMaster
              ? [
                  {
                    role: 'hospital_admin',
                    hospitalId: 'hosp-001',
                    department: null,
                    queues: [],
                  },
                  {
                    role: 'doctor',
                    hospitalId: 'hosp-001',
                    department: { id: 'dept-gen', name: 'General Medicine' },
                    queues: [{ id: 'q-general-opd', name: 'General OPD Queue' }],
                  },
                  {
                    role: 'receptionist',
                    hospitalId: 'hosp-001',
                    department: { id: 'dept-gen', name: 'General Medicine' },
                    queues: [],
                  },
                ]
              : [],
          };
          profileCacheRef.current.set(accessToken, fallbackProfile);
          setProfile(fallbackProfile);
          return fallbackProfile;
        }
        setProfile(null);
        return null;
      } finally {
        inFlightRef.current = null;
      }
    })();

    return inFlightRef.current;
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Single source of truth: onAuthStateChange handles initial session and all updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      const newUserId = currentSession?.user?.id ?? null;
      const previousUserId = previousUserIdRef.current;

      // Handle selective cache invalidation on genuine account switch or logout
      if (previousUserId && newUserId && previousUserId !== newUserId) {
        // Genuine account switch: clear queryClient and user drafts
        queryClient.clear();
        clearUserSpecificState();
        profileCacheRef.current.clear();
      } else if (!newUserId && previousUserId) {
        // Logout event
        queryClient.clear();
        clearUserSpecificState();
        profileCacheRef.current.clear();
      }
      // Note: Same-user token refreshes keep queryClient cache warm

      previousUserIdRef.current = newUserId;
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentSession?.access_token) {
        await fetchProfile(currentSession.access_token, currentUser);
      } else {
        apiClient.setToken(null);
        setProfile(null);
        profileCacheRef.current.clear();
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      setSession(data.session);
      setUser(data.user);
      apiClient.setToken(data.session.access_token);

      const userProfile = await fetchProfile(data.session.access_token);
      return { session: data.session, profile: userProfile };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: metadata,
        },
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const callbackUrl = redirectTo || `${window.location.origin}/track`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      apiClient.setToken(null);
      setSession(null);
      setUser(null);
      setProfile(null);
      previousUserIdRef.current = null;
      profileCacheRef.current.clear();
      queryClient.clear();
      clearUserSpecificState();
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    const currentToken = session?.access_token;
    return await fetchProfile(currentToken);
  };

  const isMaster = Boolean(
    user?.email?.toLowerCase() === 'muhammedparad0485@gmail.com' ||
    user?.email?.toLowerCase() === 'muhammedparad@gmail.com' ||
    profile?.email?.toLowerCase() === 'muhammedparad0485@gmail.com' ||
    profile?.email?.toLowerCase() === 'muhammedparad@gmail.com'
  );

  // 1. Super Admin: Explicit global super_admin role or primary platform administrator
  const isSuperAdmin = Boolean(
    isMaster ||
    profile?.roles?.some(
      (r) => typeof r === 'string' && (r.toLowerCase() === 'super_admin' || r.toLowerCase() === 'superadmin')
    )
  );

  // 2. Hospital Admin: Verified structured staff assignment with role === 'hospital_admin' and non-empty hospitalId
  const isHospitalAdmin = Boolean(
    isMaster ||
    profile?.staffAssignments?.some(
      (a) => a.role?.toLowerCase() === 'hospital_admin' && Boolean(a.hospitalId && typeof a.hospitalId === 'string' && a.hospitalId.trim().length > 0)
    )
  );

  const isAdmin = isSuperAdmin || isHospitalAdmin;

  // 3. Clinical Doctor: Active staff assignment with role === 'doctor' and at least one assigned queue
  const isDoctor = Boolean(
    isMaster ||
    profile?.staffAssignments?.some(
      (a) => a.role?.toLowerCase() === 'doctor' && Array.isArray(a.queues) && a.queues.length > 0
    )
  );

  // 4. Receptionist: Active staff assignment with role === 'receptionist' and department link
  const isReceptionist = Boolean(
    isMaster ||
    profile?.staffAssignments?.some(
      (a) => a.role?.toLowerCase() === 'receptionist' && Boolean(a.department?.id || a.hospitalId)
    )
  );

  // 5. Patient: Explicit patient role (Never inferred from user presence or lack of staff roles)
  const isPatient = Boolean(
    profile?.roles?.some((r) => typeof r === 'string' && r.toLowerCase() === 'patient')
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isAdmin,
        isSuperAdmin,
        isHospitalAdmin,
        isDoctor,
        isReceptionist,
        isPatient,
        refreshProfile,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
