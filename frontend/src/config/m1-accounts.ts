/**
 * M1 Synthetic Hospital Configuration & Seeded Accounts
 * Directly sourced from M2 handoff: env.m1-all-accounts.json
 */

export interface M1Account {
  role: string;
  email: string;
  password: string;
  uhid?: string;
}

export interface M1HospitalConfig {
  api: string;
  queueId: string;
  queueSlug: string;
  hospitalId: string;
  hospitalName: string;
  accounts: M1Account[];
}

export const M1_CONFIG: M1HospitalConfig = {
  api: 'http://192.168.1.249:3000',
  queueId: '29e67a5a-92f5-42cb-8008-72e49bc1a7b4',
  queueSlug: 'm1-demo-4d1422a8',
  hospitalId: '6c4467c3-053d-4d1c-808c-103948032f4b',
  hospitalName: 'Synthetic M1 Hospital',
  accounts: [
    {
      role: 'platform super admin',
      email: 'build1-admin-4d170225d6@example.com',
      password: 'ioShMdvJTnwHhXNhvvNIFavAmPzZ5QnrCa4Aa!9',
    },
    {
      role: 'hospital admin',
      email: 'build1-hospital-admin-cda2b677ff@example.com',
      password: 'g9G6oq7TjZcaKVIZBj86Zvoaafk9pDuAAa!9',
    },
    {
      role: 'receptionist',
      email: 'build1-receptionist-4d1422a8@example.com',
      password: 'xOe5pFZnBHkOBsHEsrV2mhMvPJu3blP3Aa!9',
    },
    {
      role: 'doctor',
      email: 'build1-doctor-4d1422a8@example.com',
      password: 'oYdgJpVNiHaVqUfl11qOUHwZWQrSGufvAa!9',
    },
    {
      role: 'patient-a',
      email: 'build1-patient-a-4d1422a8@example.com',
      password: 'J3XDO7GHctRf9Y5QtUOh6RqJIKRN7aSGAa!9',
      uhid: 'M1-4d1422a8-1',
    },
    {
      role: 'patient-b',
      email: 'build1-patient-b-4d1422a8@example.com',
      password: 'zijD_xNghQrJVHIzwvB9PzAYep34StDvAa!9',
      uhid: 'M1-4d1422a8-2',
    },
  ],
};

export const M1_DOCTOR = M1_CONFIG.accounts.find((a) => a.role === 'doctor')!;
export const M1_RECEPTIONIST = M1_CONFIG.accounts.find((a) => a.role === 'receptionist')!;
export const M1_PATIENT_A = M1_CONFIG.accounts.find((a) => a.role === 'patient-a')!;
export const M1_PATIENT_B = M1_CONFIG.accounts.find((a) => a.role === 'patient-b')!;
export const M1_HOSPITAL_ADMIN = M1_CONFIG.accounts.find((a) => a.role === 'hospital admin')!;
export const M1_SUPER_ADMIN = M1_CONFIG.accounts.find((a) => a.role === 'platform super admin')!;
