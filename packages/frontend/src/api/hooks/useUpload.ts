import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';

interface UploadResponse {
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export function useUpload() {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<{ success: boolean; data: UploadResponse }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
  });
}
