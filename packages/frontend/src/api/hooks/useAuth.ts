// ============================================================================
// Auth React Query Hooks
// Login, logout, current user
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { User } from '@nit-scs-v2/shared/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
  message?: string;
}

interface MeUser {
  id: string;
  employeeIdNumber: string;
  fullName: string;
  fullNameAr: string | null;
  email: string;
  phone: string | null;
  department: string;
  role: string;
  systemRole: string;
  isActive: boolean;
}

interface MeResponse {
  success: boolean;
  data: MeUser;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** POST /api/auth/login */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: result => {
      localStorage.setItem('nit_scs_token', result.data.accessToken);
      localStorage.setItem('nit_scs_refresh_token', result.data.refreshToken);
      qc.setQueryData(['auth', 'me'], { success: true, data: result.data.user });
    },
  });
}

/** POST /api/auth/logout */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSettled: () => {
      localStorage.removeItem('nit_scs_token');
      localStorage.removeItem('nit_scs_refresh_token');
      qc.clear();
    },
  });
}

/** POST /api/auth/forgot-password */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post('/auth/forgot-password', { email });
      return data;
    },
  });
}

/** POST /api/auth/reset-password */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (body: { email: string; code: string; newPassword: string }) => {
      const { data } = await apiClient.post('/auth/reset-password', body);
      return data;
    },
  });
}

/** GET /api/auth/me */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<MeResponse>('/auth/me');
      return data;
    },
    enabled: !!localStorage.getItem('nit_scs_token'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
