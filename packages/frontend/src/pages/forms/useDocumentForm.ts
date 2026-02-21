import { useEffect, useMemo, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
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
import type { VoucherLineItem, ApiResponse } from '@nit-scs-v2/shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDetailQuery = UseQueryResult<ApiResponse<any>, Error>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCreateMutation = UseMutationResult<ApiResponse<any>, Error, any, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyUpdateMutation = UseMutationResult<ApiResponse<any>, Error, any, unknown>;
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
  detailQuery: AnyDetailQuery | undefined;
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

  const detailQueryMap: Record<string, AnyDetailQuery> = {
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

  const createMutationMap: Record<string, AnyCreateMutation> = {
    mrrv: createMrrv,
    mirv: createMirv,
    mrv: createMrv,
    jo: createJo,
    rfim: createRfim,
    osd: createOsd,
  };

  const updateMutationMap: Record<string, AnyUpdateMutation> = {
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

  // Extract option arrays from API data (API returns legacy Prisma field names, not shared type names)
  const projectsRaw = (projectsQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const warehousesRaw = (warehousesQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const suppliersRaw = (suppliersQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const employeesRaw = (employeesQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;

  const projectOptions = projectsRaw.map(p => (p.projectName as string) || (p.name as string) || '');
  const warehouseOptions = warehousesRaw.map(w => (w.warehouseName as string) || (w.name as string) || '');
  const supplierOptions = suppliersRaw.map(s => (s.supplierName as string) || (s.name as string) || '');
  const mrrvOptions = ((mrrvListQuery.data?.data as unknown as Array<Record<string, unknown>>) ?? []).map(m => {
    const sup = m.supplier as Record<string, unknown> | string | undefined;
    const supName = typeof sup === 'string' ? sup : (sup?.supplierName as string) || (sup?.name as string) || '';
    const num = (m.mrrvNumber as string) || (m.id as string);
    return supName ? `${num} - ${supName}` : String(num);
  });
  const inspectorOptions = employeesRaw
    .filter(
      e =>
        String(e.department || '').toLowerCase() === 'warehouse' ||
        String(e.department || '').toLowerCase() === 'logistics',
    )
    .map(e => (e.fullName as string) || (e.name as string) || '');

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

    // Map display names → IDs for the backend API
    const supplierId = suppliersRaw.find(s => s.supplierName === formData.supplier)?.id as string | undefined;

    const projectId = projectsRaw.find(p => p.projectName === formData.project)?.id as string | undefined;

    const warehouseId = warehousesRaw.find(w => w.warehouseName === formData.warehouse)?.id as string | undefined;

    // Convert date fields to ISO 8601 datetime (fall back to DOM input if React state wasn't updated)
    const formDate = (formData.date as string) || (formData.receiveDate as string) || '';
    const rawDate = formDate || (document.querySelector('input[type="date"]') as HTMLInputElement | null)?.value || '';
    const receiveDate = rawDate && !rawDate.includes('T') ? `${rawDate}T00:00:00.000Z` : rawDate;
    const rawRequestDate = (formData.requestDate as string) || '';
    const requestDate =
      rawRequestDate && !rawRequestDate.includes('T') ? `${rawRequestDate}T00:00:00.000Z` : rawRequestDate;

    // Additional warehouse/project lookups for multi-ref forms (MRN, WT, IMSF)
    const fromWarehouseId = formData.fromWarehouse
      ? (warehousesRaw.find(w => w.warehouseName === formData.fromWarehouse)?.id as string | undefined)
      : undefined;
    const sourceWarehouseId = formData.sourceWarehouse
      ? (warehousesRaw.find(w => w.warehouseName === formData.sourceWarehouse)?.id as string | undefined)
      : undefined;
    const destWarehouseId = formData.destinationWarehouse
      ? (warehousesRaw.find(w => w.warehouseName === formData.destinationWarehouse)?.id as string | undefined)
      : undefined;
    const senderProjectId = formData.senderProject
      ? (projectsRaw.find(p => p.projectName === formData.senderProject)?.id as string | undefined)
      : undefined;
    const receiverProjectId = formData.receiverProject
      ? (projectsRaw.find(p => p.projectName === formData.receiverProject)?.id as string | undefined)
      : undefined;

    // Map form field names to API field names
    const payload: Record<string, unknown> = {
      ...formData,
      supplierId: supplierId || formData.supplierId || formData.supplier,
      projectId: projectId || formData.projectId || formData.project,
      warehouseId: warehouseId || formData.warehouseId || formData.warehouse,
      receiveDate: receiveDate || undefined,
      requestDate: requestDate || undefined,
      qciRequired: Boolean(formData.rfimRequired || formData.qciRequired),
      totalValue,
      type: joType || undefined,
      // MRN: fromWarehouse → fromWarehouseId
      ...(fromWarehouseId ? { fromWarehouseId } : {}),
      // WT: sourceWarehouse/destinationWarehouse → fromWarehouseId/toWarehouseId
      ...(sourceWarehouseId ? { fromWarehouseId: sourceWarehouseId } : {}),
      ...(destWarehouseId ? { toWarehouseId: destWarehouseId } : {}),
      // IMSF: senderProject/receiverProject → senderProjectId/receiverProjectId
      ...(senderProjectId ? { senderProjectId } : {}),
      ...(receiverProjectId ? { receiverProjectId } : {}),
    };

    // Map frontend condition values to backend enum
    const conditionMap: Record<string, string> = {
      New: 'good',
      Good: 'good',
      Fair: 'good',
      Damaged: 'damaged',
    };

    // ── Form-type-specific field mappings ──

    // MI: Prisma Mirv has no `purpose` field — merge into `notes`
    if (formType === 'mirv' && formData.purpose) {
      const purposeText = String(formData.purpose);
      const notesText = formData.notes ? String(formData.notes) : '';
      payload.notes = notesText ? `${purposeText}\n\n${notesText}` : purposeText;
      delete payload.purpose;
    }

    // DR: Prisma OsdReport expects `reportTypes` (String[]), not `reportType` (String)
    if (formType === 'osd' && formData.reportType) {
      payload.reportTypes = [String(formData.reportType)];
      delete payload.reportType;
    }

    // MRN: map display returnType → snake_case Prisma enum
    if (formType === 'mrv' && payload.returnType) {
      const returnTypeMap: Record<string, string> = {
        'Return to Warehouse': 'return_to_warehouse',
        'Return to Supplier': 'return_to_supplier',
        Scrap: 'scrap',
        'Transfer to Project': 'transfer_to_project',
      };
      payload.returnType =
        returnTypeMap[String(payload.returnType)] || String(payload.returnType).toLowerCase().replace(/ /g, '_');
    }

    // WT: map display transferType → snake_case Prisma enum
    if (formType === 'wt' && payload.transferType) {
      const transferTypeMap: Record<string, string> = {
        'Warehouse to Warehouse': 'warehouse_to_warehouse',
        'Project to Project': 'project_to_project',
        'Warehouse to Project': 'warehouse_to_project',
        'Project to Warehouse': 'project_to_warehouse',
      };
      payload.transferType =
        transferTypeMap[String(payload.transferType)] || String(payload.transferType).toLowerCase().replace(/ /g, '_');
    }

    // IMSF: map display materialType → lowercase Prisma enum
    if (formType === 'imsf' && payload.materialType) {
      payload.materialType = String(payload.materialType).toLowerCase();
    }

    // Scrap: map display materialType → lowercase Prisma enum
    if (formType === 'scrap' && payload.materialType) {
      payload.materialType = String(payload.materialType).toLowerCase().replace(/ /g, '_');
    }

    // Surplus: map display condition → lowercase + disposition → lowercase
    if (formType === 'surplus') {
      if (payload.condition) {
        payload.condition = conditionMap[String(payload.condition)] || String(payload.condition).toLowerCase();
      }
      if (payload.disposition) {
        payload.disposition = String(payload.disposition).toLowerCase();
      }
    }

    // Map lineItems to the `lines` array format the backend expects
    const mappedLines = lineItems.map(li => ({
      itemId: li.itemId,
      qtyOrdered: li.qtyExpected || li.quantity,
      qtyReceived: li.quantity,
      uomId: li.uomId,
      unitCost: li.unitPrice,
      condition: conditionMap[li.condition || 'New'] || 'good',
      notes: li.notes,
    }));
    payload.lines = mappedLines;

    // Remove display-only field names that aren't real Prisma columns
    const displayOnlyFields = [
      'supplier',
      'project',
      'warehouse',
      'requester',
      'receivedBy',
      'returnedBy',
      'fromWarehouse',
      'sourceWarehouse',
      'destinationWarehouse',
      'senderProject',
      'receiverProject',
      'requestedBy',
    ];
    for (const key of displayOnlyFields) {
      if (payload[key] && typeof payload[key] === 'string') {
        delete payload[key];
      }
    }

    submit(payload, lineItems);
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
