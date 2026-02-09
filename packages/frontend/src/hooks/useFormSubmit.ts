// ============================================================================
// Form Submission Hook
// Handles validation and submission — document numbers are server-generated
// ============================================================================

import { useState, useCallback } from 'react';
import type { VoucherLineItem } from '@nit-scs/shared/types';

interface UseFormSubmitOptions {
  documentType: string;
  onSuccess?: (data: Record<string, unknown>) => void;
  validator?: (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  };
  service?: {
    create: (data: Record<string, unknown>) => Promise<{ data: unknown; success: boolean; message?: string }>;
  };
}

interface UseFormSubmitReturn {
  submitting: boolean;
  submitted: boolean;
  errors: { field: string; rule: string; message: string }[];
  warnings: { field: string; rule: string; message: string }[];
  documentNumber: string | null;
  submit: (formData: Record<string, unknown>, lineItems?: VoucherLineItem[]) => Promise<boolean>;
  reset: () => void;
}

export function useFormSubmit({
  documentType,
  onSuccess,
  validator,
  service,
}: UseFormSubmitOptions): UseFormSubmitReturn {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ field: string; rule: string; message: string }[]>([]);
  const [warnings, setWarnings] = useState<{ field: string; rule: string; message: string }[]>([]);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const submit = useCallback(
    async (formData: Record<string, unknown>, lineItems: VoucherLineItem[] = []) => {
      setErrors([]);
      setWarnings([]);

      if (validator) {
        const result = validator(formData, lineItems);
        setWarnings(result.warnings);
        if (!result.valid) {
          setErrors(result.errors);
          return false;
        }
      }

      setSubmitting(true);
      try {
        // Send only the payload — the server generates id, formNumber, status, createdAt
        const payload = {
          ...formData,
          lineItems,
          totalValue: lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
        };

        if (service) {
          const result = await service.create(payload);
          if (!result.success) {
            setErrors([{ field: 'form', rule: 'API', message: result.message || 'Submission failed' }]);
            return false;
          }
          // Extract document number from server response
          const responseData = result.data as Record<string, unknown> | undefined;
          const serverNumber = (responseData?.formNumber ?? responseData?.id ?? null) as string | null;
          setDocumentNumber(serverNumber);
        } else {
          // No service — offline/demo mode fallback
          setDocumentNumber(null);
        }

        setSubmitted(true);
        onSuccess?.(payload);
        return true;
      } catch {
        setErrors([{ field: 'form', rule: 'ERROR', message: 'An unexpected error occurred' }]);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [documentType, validator, service, onSuccess],
  );

  const reset = useCallback(() => {
    setSubmitted(false);
    setSubmitting(false);
    setErrors([]);
    setWarnings([]);
    setDocumentNumber(null);
  }, []);

  return { submitting, submitted, errors, warnings, documentNumber, submit, reset };
}
