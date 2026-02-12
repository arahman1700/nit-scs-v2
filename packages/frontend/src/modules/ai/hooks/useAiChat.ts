import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/api/types';

// ── Types ──────────────────────────────────────────────────────────────

export interface AiConversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedQuery?: string;
  resultData?: unknown;
  createdAt: string;
}

export interface ChatResult {
  conversationId: string;
  message: AiMessage;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useAiConversations() {
  return useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AiConversation[]>>('/ai/conversations');
      return data;
    },
  });
}

export function useAiConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['ai', 'conversation', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AiConversation & { messages: AiMessage[] }>>(
        `/ai/conversations/${id}`,
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useAiChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId?: string; message: string }) => {
      const { data } = await apiClient.post<ApiResponse<ChatResult>>('/ai/chat', { conversationId, message });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai'] });
    },
  });
}

export function useDeleteAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/ai/conversations/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });
}
