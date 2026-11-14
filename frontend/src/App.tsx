import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { WalkInDesk } from './features/receptionist/WalkInDesk';
import { DoctorConsole } from './features/doctor/DoctorConsole';
import { TokenTracker } from './features/patient/TokenTracker';
import { PublicWaitingBoard } from './features/display/PublicWaitingBoard';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { SuperAdminDashboard } from './features/super-admin/SuperAdminDashboard';
import { HospitalAdminDashboard } from './features/hospital-admin/HospitalAdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Main Hospital Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Staff Login Page (Doctor, Receptionist, Admin, Display) */}
            <Route path="/staff-login" element={<StaffLoginPage />} />

            {/* 0A. Platform Super Admin Console (Protected: Super Admin exclusively) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* 0B. Hospital Facility Admin Center (Protected: Hospital Admin exclusively) */}
            <Route
              path="/hospital-admin"
              element={
                <ProtectedRoute requiredRole="hospital_admin">
                  <HospitalAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hospital-admin/*"
              element={
                <ProtectedRoute requiredRole="hospital_admin">
                  <HospitalAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* 0C. Legacy Admin Operations Center (Preserved incrementally) */}
            <Route
              path="/admin-classic"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* 1. Receptionist Intake Terminal (Protected: Receptionist) */}
            <Route
              path="/intake"
              element={
                <ProtectedRoute requiredRole="receptionist">
                  <WalkInDesk />
                </ProtectedRoute>
              }
            />

            {/* 2. Doctor Clinical Workstation (Protected: Doctor) */}
            <Route
              path="/consultation"
              element={
                <ProtectedRoute requiredRole="doctor">
                  <DoctorConsole />
                </ProtectedRoute>
              }
            />

            {/* 3. Patient Mobile Queue Tracker */}
            <Route path="/track" element={<TokenTracker />} />

            {/* 4. Public Waiting Room TV Signage (Public zero-PII) */}
            <Route path="/display" element={<PublicWaitingBoard />} />
            <Route path="/display/:roomId" element={<PublicWaitingBoard />} />

            {/* Catch-all redirect to landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
