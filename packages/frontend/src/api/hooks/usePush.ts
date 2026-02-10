// ============================================================================
// Push Notification React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Query: Fetch VAPID public key ───────────────────────────────────────────

export function useVapidKey() {
  return useQuery({
    queryKey: ['push', 'vapid-key'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ publicKey: string }>>('/push/vapid-key');
      return data;
    },
    staleTime: Infinity, // VAPID key never changes during a session
  });
}

// ── Mutation: Subscribe to push ─────────────────────────────────────────────

export function useSubscribePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { endpoint: string; keys: { p256dh: string; auth: string } }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/push/subscribe', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['push'] });
    },
  });
}

// ── Mutation: Unsubscribe from push ─────────────────────────────────────────

export function useUnsubscribePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (endpoint: string) => {
      await apiClient.delete('/push/unsubscribe', { data: { endpoint } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['push'] });
    },
  });
}

// ── Mutation: Send test push (admin only) ───────────────────────────────────

export function useTestPush() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<{ message: string }>>('/push/test');
      return data;
    },
  });
}
