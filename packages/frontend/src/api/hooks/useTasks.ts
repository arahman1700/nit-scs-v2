import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Task, TaskComment } from '@nit-scs-v2/shared/types';
import type { ApiResponse } from '../types';

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  assigneeId?: string;
  projectId?: string;
  search?: string;
}

/** GET /api/tasks — List tasks */
export function useTaskList(params?: TaskListParams) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Task[]>>('/tasks', { params });
      return data;
    },
  });
}

/** GET /api/tasks/:id — Get task with comments */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/** POST /api/tasks — Create */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Task>) => {
      const { data } = await apiClient.post<ApiResponse<Task>>('/tasks', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** PUT /api/tasks/:id — Update metadata */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Task> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<Task>>(`/tasks/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** PUT /api/tasks/:id/assign — Assign */
export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assigneeId }: { id: string; assigneeId: string | null }) => {
      const { data } = await apiClient.put<ApiResponse<Task>>(`/tasks/${id}/assign`, { assigneeId });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** PUT /api/tasks/:id/status — Change status */
export function useChangeTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put<ApiResponse<Task>>(`/tasks/${id}/status`, { status });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** POST /api/tasks/:id/comments — Add comment */
export function useAddTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data } = await apiClient.post<ApiResponse<TaskComment>>(`/tasks/${id}/comments`, { body });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** DELETE /api/tasks/:id */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
