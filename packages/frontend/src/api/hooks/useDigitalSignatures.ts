import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DigitalSignature {
  id: string;
  documentType: string;
  documentId: string;
  signedById: string;
  signatureData: string;
  signedAt: string;
  ipAddress: string | null;
  purpose: 'approval' | 'delivery_confirmation' | 'receipt' | 'inspection' | 'handover';
  notes: string | null;
  signedBy: {
    id: string;
    fullName: string;
    email: string;
    department: string;
    role: string;
  };
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /signatures?documentType=&documentId= — List signatures for a document */
export function useDocumentSignatures(documentType: string | undefined, documentId: string | undefined) {
  return useQuery({
    queryKey: ['signatures', documentType, documentId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DigitalSignature[]>>('/signatures', {
        params: { documentType, documentId },
      });
      return data;
    },
    enabled: !!documentType && !!documentId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /signatures — Create a new digital signature */
export function useCreateSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      documentType: string;
      documentId: string;
      signatureData: string;
      purpose: 'approval' | 'delivery_confirmation' | 'receipt' | 'inspection' | 'handover';
      notes?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<DigitalSignature>>('/signatures', payload);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['signatures', vars.documentType, vars.documentId] });
    },
  });
}
