import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/api/types';

// ── Types ──────────────────────────────────────────────────────────────

export interface AiSuggestion {
  id: string;
  suggestionType: string;
  priority: number;
  title: string;
  titleAr?: string;
  description?: string;
  actionPayload?: { type: string; params: Record<string, unknown> };
  status: string;
  expiresAt?: string;
  createdAt: string;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useAiSuggestions(status?: string) {
  return useQuery({
    queryKey: ['ai', 'suggestions', status],
    queryFn: async () => {
      const params = status ? { status } : undefined;
      const { data } = await apiClient.get<ApiResponse<AiSuggestion[]>>('/ai/suggestions', { params });
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<ApiResponse<AiSuggestion>>(`/ai/suggestions/${id}/dismiss`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'suggestions'] });
    },
  });
}

export function useApplySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<ApiResponse<AiSuggestion>>(`/ai/suggestions/${id}/apply`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'suggestions'] });
    },
  });
}

export function useTriggerAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<{ created: number }>>('/ai/suggestions/analyze');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'suggestions'] });
    },
  });
}
