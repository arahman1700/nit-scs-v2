// ============================================================================
// Notifications React Query Hooks
// CRUD operations for user notifications
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Notification } from '@nit-scs/shared/types';
import type { ApiResponse } from '../types';

// ── Hooks ──────────────────────────────────────────────────────────────────

/** GET /api/notifications */
export function useNotifications(params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Notification[]>>('/notifications', { params });
      return data;
    },
    staleTime: 15_000,
  });
}

/** GET /api/notifications/unread-count */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<number>>('/notifications/unread-count');
      return data;
    },
    staleTime: 10_000,
    refetchInterval: 30_000, // Poll every 30s
  });
}

/** PUT /api/notifications/read-all */
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put<ApiResponse<null>>('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** PUT /api/notifications/:id/read */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<ApiResponse<Notification>>(`/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** DELETE /api/notifications/:id */
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
