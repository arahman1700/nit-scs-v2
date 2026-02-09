import { useEffect, useMemo, useState } from 'react';
import {
  useProjects,
  useWarehouses,
  useSuppliers,
  useMrrvList,
  useEmployees,
  useUpload,
  useCurrentUser,
} from '@/api/hooks';
import {
  useCreateMrrv,
  useCreateMirv,
  useCreateMrv,
  useCreateJobOrder,
  useCreateRfim,
  useCreateOsd,
} from '@/api/hooks';
import {
  useUpdateMrrv,
  useUpdateMirv,
  useUpdateMrv,
  useUpdateJobOrder,
  useUpdateRfim,
  useUpdateOsd,
} from '@/api/hooks';
import { useMrrv, useMirv, useMrv, useJobOrder, useRfim, useOsd } from '@/api/hooks';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { previewNextNumber } from '@/utils/autoNumber';
import {
  getFormConfig,
  getJoTypeSections,
  getApprovalInfo,
  VALIDATOR_MAP,
  STATUS_FLOWS,
  EDITABLE_STATUSES,
  type FormConfig,
  type FormSectionConfig,
} from './formConfigs';

// ── Return type ────────────────────────────────────────────────────────────

interface UseDocumentFormReturn {
  formData: Record<string, unknown>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  lineItems: VoucherLineItem[];
  setLineItems: React.Dispatch<React.SetStateAction<VoucherLineItem[]>>;
  joType: string;
  setJoType: React.Dispatch<React.SetStateAction<string>>;
  isEditMode: boolean;
  isEditable: boolean;
  isLoadingDoc: boolean;
  existingDoc: Record<string, unknown> | undefined;
  docStatus: string;
  submitted: boolean;
  submitting: boolean;
  errors: { field: string; rule: string; message: string }[];
  warnings: { field: string; rule: string; message: string }[];
  documentNumber: string | null;
  submit: (formData: Record<string, unknown>, lineItems?: VoucherLineItem[]) => Promise<boolean>;
  reset: () => void;
  projectOptions: string[];
  warehouseOptions: string[];
  supplierOptions: string[];
  mrrvOptions: string[];
  inspectorOptions: string[];
  totalValue: number;
  approvalInfo: { level: string; color: string };
  hasLineItems: boolean;
  nextNumber: string;
  statusFlow: string[];
  uploadedFiles: Record<string, { url: string; name: string; size: number }>;
  handleFileUpload: (fieldKey: string, file: File) => Promise<void>;
  handleRemoveFile: (fieldKey: string) => void;
  handleInputChange: (key: string, value: unknown) => void;
  meQuery: ReturnType<typeof useCurrentUser>;
  formConfig: FormConfig;
  allSections: FormSectionConfig[];
  editableStatuses: string[];
  initialized: boolean;
  detailQuery: ReturnType<typeof useMrrv> | undefined;
  uploadPending: boolean;
  uploadError: Error | null;
  handleSubmit: (e: React.FormEvent) => void;
  getFieldValue: (field: { key: string; defaultValue?: string }) => string;
  getCheckboxValue: (key: string) => boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDocumentForm(formType: string | undefined, id: string | undefined): UseDocumentFormReturn {
  const isEditMode = !!id;
  const meQuery = useCurrentUser();
  const currentUserName = meQuery.data?.data?.fullName ?? '';

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [lineItems, setLineItems] = useState<VoucherLineItem[]>([]);
  const [joType, setJoType] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { url: string; name: string; size: number }>>({});
  const uploadMutation = useUpload();

  // Fetch existing document for edit mode
  const mrrvQuery = useMrrv(formType === 'mrrv' ? id : undefined);
  const mirvQuery = useMirv(formType === 'mirv' ? id : undefined);
  const mrvQuery = useMrv(formType === 'mrv' ? id : undefined);
  const joQuery = useJobOrder(formType === 'jo' ? id : undefined);
  const rfimQuery = useRfim(formType === 'rfim' ? id : undefined);
  const osdQuery = useOsd(formType === 'osd' ? id : undefined);

  const detailQueryMap: Record<string, typeof mrrvQuery> = {
    mrrv: mrrvQuery,
    mirv: mirvQuery,
    mrv: mrvQuery,
    jo: joQuery,
    rfim: rfimQuery,
    osd: osdQuery,
  };
  const detailQuery = detailQueryMap[formType || ''];
  const existingDoc = (detailQuery?.data as { data?: Record<string, unknown> } | undefined)?.data;
  const isLoadingDoc = isEditMode && (detailQuery?.isLoading ?? false);

  // Check if document is editable based on status
  const docStatus = (existingDoc?.status as string) || '';
  const editableStatuses = EDITABLE_STATUSES[formType || ''] || [];
  const isEditable = !isEditMode || editableStatuses.includes(docStatus);

  // Pre-populate form data from existing document
  useEffect(() => {
    if (isEditMode && existingDoc && !initialized) {
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(existingDoc)) {
        if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
          data[key] = value;
        }
      }
      setFormData(data);
      if (existingDoc.lineItems && Array.isArray(existingDoc.lineItems)) {
        setLineItems(existingDoc.lineItems as VoucherLineItem[]);
      }
      if (existingDoc.type) {
        setJoType(existingDoc.type as string);
      }
      if (existingDoc.joType) {
        setJoType(existingDoc.joType as string);
      }
      setInitialized(true);
    }
  }, [isEditMode, existingDoc, initialized]);

  // Fetch dropdown options from API
  const projectsQuery = useProjects({ pageSize: 200 });
  const warehousesQuery = useWarehouses({ pageSize: 200 });
  const suppliersQuery = useSuppliers({ pageSize: 200 });
  const mrrvListQuery = useMrrvList({ pageSize: 200 });
  const employeesQuery = useEmployees({ pageSize: 200 });

  // Create mutations
  const createMrrv = useCreateMrrv();
  const createMirv = useCreateMirv();
  const createMrv = useCreateMrv();
  const createJo = useCreateJobOrder();
  const createRfim = useCreateRfim();
  const createOsd = useCreateOsd();

  // Update mutations
  const updateMrrv = useUpdateMrrv();
  const updateMirv = useUpdateMirv();
  const updateMrv = useUpdateMrv();
  const updateJo = useUpdateJobOrder();
  const updateRfim = useUpdateRfim();
  const updateOsd = useUpdateOsd();

  const createMutationMap: Record<string, typeof createMrrv> = {
    mrrv: createMrrv,
    mirv: createMirv,
    mrv: createMrv,
    jo: createJo,
    rfim: createRfim,
    osd: createOsd,
  };

  const updateMutationMap: Record<string, typeof updateMrrv> = {
    mrrv: updateMrrv,
    mirv: updateMirv,
    mrv: updateMrv,
    jo: updateJo,
    rfim: updateRfim,
    osd: updateOsd,
  };

  const activeMutation = isEditMode ? updateMutationMap[formType || ''] : createMutationMap[formType || ''];

  const nextNumber = useMemo(() => previewNextNumber(formType || 'gen'), [formType]);
  const validator = VALIDATOR_MAP[formType || ''];
  const statusFlow = STATUS_FLOWS[formType || ''] || [];

  // Build a service adapter that wraps the React Query mutation for useFormSubmit
  const serviceAdapter = useMemo(() => {
    if (!activeMutation) return undefined;
    if (isEditMode) {
      return {
        create: async (data: Record<string, unknown>) => {
          const result = await activeMutation.mutateAsync({ ...data, id: id! } as Record<string, unknown> & {
            id: string;
          });
          return { data: result.data, success: result.success, message: result.message };
        },
      };
    }
    return {
      create: async (data: Record<string, unknown>) => {
        const result = await activeMutation.mutateAsync(data as Record<string, unknown> & { id: string });
        return { data: result.data, success: result.success, message: result.message };
      },
    };
  }, [activeMutation, isEditMode, id]);

  const { submitting, submitted, errors, warnings, documentNumber, submit, reset } = useFormSubmit({
    documentType: formType || 'gen',
    validator,
    service: serviceAdapter,
  });

  // Extract option arrays from API data
  const projectOptions = (projectsQuery.data?.data ?? []).map((p: { name: string }) => p.name);
  const warehouseOptions = (warehousesQuery.data?.data ?? []).map((w: { name: string }) => w.name);
  const supplierOptions = (suppliersQuery.data?.data ?? []).map((s: { name: string }) => s.name);
  const mrrvOptions = (mrrvListQuery.data?.data ?? []).map(
    (m: { id: string; supplier?: string }) => `${m.id}${m.supplier ? ` - ${m.supplier}` : ''}`,
  );
  const inspectorOptions = (employeesQuery.data?.data ?? [])
    .filter((e: { department: string }) => e.department === 'Warehouse' || e.department === 'Logistics')
    .map((e: { name: string }) => e.name);

  // Auto-calculate total from line items
  const totalValue = useMemo(() => lineItems.reduce((sum, item) => sum + item.totalPrice, 0), [lineItems]);
  const approvalInfo = useMemo(() => getApprovalInfo(totalValue), [totalValue]);
  const hasLineItems = ['mirv', 'mrrv', 'mrv'].includes(formType || '');

  const formConfig = useMemo(
    () =>
      getFormConfig(formType, {
        projectOptions,
        warehouseOptions,
        supplierOptions,
        mrrvOptions,
        inspectorOptions,
        isEditMode,
        currentUserName,
      }),
    [
      formType,
      projectOptions,
      warehouseOptions,
      supplierOptions,
      mrrvOptions,
      inspectorOptions,
      isEditMode,
      currentUserName,
    ],
  );

  // Dynamic JO sections based on selected type
  const joTypeSections = useMemo(() => {
    if (formType !== 'jo') return [];
    return getJoTypeSections(joType);
  }, [formType, joType]);

  // Combine base sections with dynamic JO sections
  const allSections = useMemo(() => {
    if (formType === 'jo') {
      return [...formConfig.sections, ...joTypeSections];
    }
    return formConfig.sections;
  }, [formConfig.sections, joTypeSections, formType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, lineItems, totalValue, type: joType || undefined };
    submit(payload);
  };

  const handleInputChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (key === 'joType') {
      setJoType(value as string);
    }
  };

  const handleFileUpload = async (fieldKey: string, file: File) => {
    try {
      const result = await uploadMutation.mutateAsync(file);
      setUploadedFiles(prev => ({
        ...prev,
        [fieldKey]: { url: result.url, name: result.originalName, size: result.size },
      }));
      setFormData(prev => ({ ...prev, [fieldKey]: result.url }));
    } catch {
      // Error is handled by mutation state
    }
  };

  const handleRemoveFile = (fieldKey: string) => {
    setUploadedFiles(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    setFormData(prev => ({ ...prev, [fieldKey]: '' }));
  };

  // Get value from formData for pre-populating fields
  const getFieldValue = (field: { key: string; defaultValue?: string }): string => {
    const val = formData[field.key];
    if (val === undefined || val === null) return field.defaultValue || '';
    if (typeof val === 'boolean') return '';
    return String(val);
  };

  const getCheckboxValue = (key: string): boolean => {
    return Boolean(formData[key]);
  };

  return {
    formData,
    setFormData,
    lineItems,
    setLineItems,
    joType,
    setJoType,
    isEditMode,
    isEditable,
    isLoadingDoc,
    existingDoc,
    docStatus,
    submitted,
    submitting,
    errors,
    warnings,
    documentNumber,
    submit,
    reset,
    projectOptions,
    warehouseOptions,
    supplierOptions,
    mrrvOptions,
    inspectorOptions,
    totalValue,
    approvalInfo,
    hasLineItems,
    nextNumber,
    statusFlow,
    uploadedFiles,
    handleFileUpload,
    handleRemoveFile,
    handleInputChange,
    meQuery,
    formConfig,
    allSections,
    editableStatuses,
    initialized,
    detailQuery,
    uploadPending: uploadMutation.isPending,
    uploadError: uploadMutation.isError
      ? uploadMutation.error instanceof Error
        ? uploadMutation.error
        : new Error('Upload failed')
      : null,
    handleSubmit,
    getFieldValue,
    getCheckboxValue,
  };
}
