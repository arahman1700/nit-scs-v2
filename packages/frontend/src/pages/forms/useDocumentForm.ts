import { useEffect, useMemo, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  useProjects,
  useWarehouses,
  useSuppliers,
  useGrnList,
  useEmployees,
  useUpload,
  useCurrentUser,
} from '@/api/hooks';
import { useCreateGrn, useCreateMi, useCreateMrn, useCreateJobOrder, useCreateQci, useCreateDr } from '@/api/hooks';
import { useUpdateGrn, useUpdateMi, useUpdateMrn, useUpdateJobOrder, useUpdateQci, useUpdateDr } from '@/api/hooks';
import { useGrn, useMi, useMrn, useJobOrder, useQci, useDr } from '@/api/hooks';
import type { VoucherLineItem, ApiResponse } from '@nit-scs-v2/shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDetailQuery = UseQueryResult<ApiResponse<any>, Error>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCreateMutation = UseMutationResult<ApiResponse<any>, Error, any, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyUpdateMutation = UseMutationResult<ApiResponse<any>, Error, any, unknown>;
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { previewNextNumber } from '@/utils/autoNumber';
import { extractRows } from '@/utils/type-helpers';
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

// V2 display names → V1 internal model names used by formConfigs and API hooks
const V2_TO_V1: Record<string, string> = {
  grn: 'mrrv',
  mi: 'mirv',
  mrn: 'mrv',
  qci: 'rfim',
  dr: 'osd',
  mr: 'mrf',
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDocumentForm(rawFormType: string | undefined, id: string | undefined): UseDocumentFormReturn {
  // Normalize V2 route names to V1 internal names
  const formType = rawFormType ? (V2_TO_V1[rawFormType] ?? rawFormType) : rawFormType;
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
  const mrrvQuery = useGrn(formType === 'mrrv' ? id : undefined);
  const mirvQuery = useMi(formType === 'mirv' ? id : undefined);
  const mrvQuery = useMrn(formType === 'mrv' ? id : undefined);
  const joQuery = useJobOrder(formType === 'jo' ? id : undefined);
  const rfimQuery = useQci(formType === 'rfim' ? id : undefined);
  const osdQuery = useDr(formType === 'osd' ? id : undefined);

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
  const isEditable = !isEditMode || editableStatuses.some(s => s.toLowerCase() === docStatus.toLowerCase());

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
  const mrrvListQuery = useGrnList({ pageSize: 200 });
  const employeesQuery = useEmployees({ pageSize: 200 });

  // Smart defaults removed (deferred feature — Intelligence module)

  // Create mutations
  const createMrrv = useCreateGrn();
  const createMirv = useCreateMi();
  const createMrv = useCreateMrn();
  const createJo = useCreateJobOrder();
  const createRfim = useCreateQci();
  const createOsd = useCreateDr();

  // Update mutations
  const updateMrrv = useUpdateGrn();
  const updateMirv = useUpdateMi();
  const updateMrv = useUpdateMrn();
  const updateJo = useUpdateJobOrder();
  const updateRfim = useUpdateQci();
  const updateOsd = useUpdateDr();

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
  const projectsRaw = extractRows(projectsQuery.data);
  const warehousesRaw = extractRows(warehousesQuery.data);
  const suppliersRaw = extractRows(suppliersQuery.data);
  const employeesRaw = extractRows(employeesQuery.data);

  const projectOptions = projectsRaw.map(p => (p.projectName as string) || (p.name as string) || '');
  const warehouseOptions = warehousesRaw.map(w => (w.warehouseName as string) || (w.name as string) || '');
  const supplierOptions = suppliersRaw.map(s => (s.supplierName as string) || (s.name as string) || '');
  const mrrvOptions = extractRows(mrrvListQuery.data).map(m => {
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

  // Seed formData with default values from formConfig for new documents
  useEffect(() => {
    if (isEditMode || !formConfig.sections.length) return;
    const defaults: Record<string, unknown> = {};
    for (const section of formConfig.sections) {
      for (const field of section.fields) {
        if (field.defaultValue && formData[field.key] === undefined) {
          defaults[field.key] = field.defaultValue;
        }
      }
    }
    if (Object.keys(defaults).length > 0) {
      setFormData(prev => ({ ...defaults, ...prev }));
    }
  }, [formConfig.sections, isEditMode]);

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

  // Dynamic wizard steps for JO forms — wire type-specific sections into Steps 2 & 3
  const effectiveFormConfig = useMemo(() => {
    if (formType !== 'jo' || joTypeSections.length === 0 || !formConfig.wizardSteps) return formConfig;

    const baseSectionCount = formConfig.sections.length; // 2 (Request Info + Service Type)
    const typeSectionCount = joTypeSections.length;

    // Detail sections → Step 2 (Service Type & Details), Budget section (last) → Step 3
    const detailIndices: number[] = [];
    for (let i = baseSectionCount; i < baseSectionCount + typeSectionCount - 1; i++) {
      detailIndices.push(i);
    }
    const budgetIndex = baseSectionCount + typeSectionCount - 1;

    return {
      ...formConfig,
      wizardSteps: [
        formConfig.wizardSteps[0], // Step 1: Request Information → [0]
        { ...formConfig.wizardSteps[1], sectionIndices: [1, ...detailIndices] }, // Step 2 + type details
        { ...formConfig.wizardSteps[2], sectionIndices: [budgetIndex] }, // Step 3: Budget
        formConfig.wizardSteps[3], // Step 4: Review → []
      ],
    };
  }, [formConfig, formType, joTypeSections]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Map display names → IDs for the backend API
    const supplierId = suppliersRaw.find(s => s.supplierName === formData.supplier)?.id as string | undefined;

    const projectId = projectsRaw.find(p => p.projectName === formData.project)?.id as string | undefined;

    const warehouseId = warehousesRaw.find(w => w.warehouseName === formData.warehouse)?.id as string | undefined;

    // Convert date fields to ISO 8601 datetime
    const formDate =
      (formData.date as string) || (formData.receiveDate as string) || (formData.returnDate as string) || '';
    const rawDate = formDate;
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
      type: joType ? joType.toLowerCase() : undefined,
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

    // DR: Prisma OsdReport expects `reportTypes` (String[]).
    // formConfigs uses key `reportTypes` as a single-select, so wrap in array if it's a string.
    if (formType === 'osd') {
      const rt = formData.reportTypes ?? formData.reportType;
      if (rt && !Array.isArray(rt)) {
        payload.reportTypes = [String(rt)];
      }
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

    // JO: map flat form fields → backend nested objects + fix field names
    if (formType === 'jo' && joType) {
      payload.joType = joType;
      delete payload.type; // remove incorrect `type` field

      if (joType === 'transport') {
        payload.transportDetails = {
          pickupLocation: formData.pickupLocation || '',
          deliveryLocation: formData.deliveryLocation || '',
          cargoType: formData.cargoType || '',
          cargoWeightTons: formData.cargoWeight ? Number(formData.cargoWeight) : undefined,
          numberOfTrailers: formData.numberOfTrailers ? Number(formData.numberOfTrailers) : undefined,
          materialPriceSar: formData.materialPrice ? Number(formData.materialPrice) : undefined,
          insuranceRequired: Boolean(formData.insuranceRequired),
        };
        // Convert shiftStartTime to ISO if needed
        const rawShift = formData.shiftStartTime as string;
        if (rawShift && !rawShift.includes('Z')) {
          payload.shiftStartTime = `${rawShift}:00.000Z`;
        }
        // Clean up flat transport fields from payload
        for (const k of [
          'pickupLocation',
          'deliveryLocation',
          'cargoType',
          'cargoWeight',
          'numberOfTrailers',
          'materialPrice',
          'entryPermit',
        ]) {
          delete payload[k];
        }
      }

      if (joType === 'equipment') {
        // Store equipment info in notes/description since equipmentLines needs UUID refs
        const equipType = formData.equipmentType as string;
        if (equipType) {
          payload.notes = [
            payload.notes || '',
            `Equipment: ${equipType}`,
            formData.quantity ? `Qty: ${formData.quantity}` : '',
            formData.durationDays ? `Duration: ${formData.durationDays} days` : '',
            formData.projectSite ? `Site: ${formData.projectSite}` : '',
            formData.withOperator ? 'With operator' : '',
          ]
            .filter(Boolean)
            .join(' | ');
        }
        for (const k of ['equipmentType', 'quantity', 'durationDays', 'projectSite', 'withOperator']) {
          delete payload[k];
        }
      }

      if (joType === 'generator_rental') {
        const startDate = formData.rentalStart || formData.startDate;
        const endDate = formData.rentalEnd || formData.endDate;
        payload.generatorDetails = {
          capacityKva: formData.capacityKva ? Number(formData.capacityKva) : undefined,
          shiftStartTime: (formData.shiftStartTime as string) || undefined,
        };
        payload.rentalDetails = {
          rentalStartDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          rentalEndDate: endDate ? `${endDate}T00:00:00.000Z` : undefined,
          withOperator: false,
        };
        for (const k of [
          'capacityKva',
          'rentalStart',
          'rentalEnd',
          'startDate',
          'endDate',
          'siteLocation',
          'fuelIncluded',
          'shiftStartTime',
        ]) {
          delete payload[k];
        }
      }

      if (joType === 'generator_maintenance') {
        // generatorId must be a valid UUID — if it's a text label, store in notes instead
        const genId = formData.generatorId as string;
        const isUuid = genId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(genId);
        payload.generatorDetails = {
          generatorId: isUuid ? genId : undefined,
          capacityKva: formData.capacityKva ? Number(formData.capacityKva) : undefined,
          maintenanceType: formData.maintenanceType
            ? (String(formData.maintenanceType).toLowerCase() as 'preventive' | 'corrective' | 'emergency')
            : undefined,
          issueDescription: (formData.issueDescription as string) || undefined,
        };
        if (genId && !isUuid) {
          payload.notes = `Generator: ${genId}${payload.notes ? ' | ' + payload.notes : ''}`;
        }
        for (const k of ['generatorId', 'capacityKva', 'maintenanceType', 'issueDescription', 'fuelIncluded']) {
          delete payload[k];
        }
      }

      if (joType === 'rental_daily' || joType === 'rental_monthly') {
        const startDate = formData.startDate || formData.rentalStart;
        const endDate = formData.endDate || formData.rentalEnd;
        payload.rentalDetails = {
          rentalStartDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          rentalEndDate: endDate ? `${endDate}T00:00:00.000Z` : undefined,
          dailyRate: formData.dailyRate ? Number(formData.dailyRate) : undefined,
          monthlyRate: formData.monthlyRate ? Number(formData.monthlyRate) : undefined,
          withOperator: Boolean(formData.withOperator),
        };
        // For monthly with duration, calculate end date
        if (joType === 'rental_monthly' && startDate && formData.durationMonths && !endDate) {
          const start = new Date(`${startDate}T00:00:00.000Z`);
          start.setMonth(start.getMonth() + Number(formData.durationMonths));
          (payload.rentalDetails as Record<string, unknown>).rentalEndDate = start.toISOString();
        }
        for (const k of [
          'startDate',
          'endDate',
          'rentalStart',
          'rentalEnd',
          'dailyRate',
          'monthlyRate',
          'withOperator',
          'equipmentType',
          'durationMonths',
          'coaApprovalRequired',
        ]) {
          delete payload[k];
        }
        if (formData.coaApprovalRequired) {
          payload.coaApprovalRequired = Boolean(formData.coaApprovalRequired);
        }
      }

      if (joType === 'scrap') {
        payload.scrapDetails = {
          scrapType: (formData.scrapType as string) || '',
          scrapWeightTons: formData.weightTons ? Number(formData.weightTons) : 0,
          scrapDescription: (formData.issueDescription as string) || (formData.scrapDescription as string) || undefined,
          scrapDestination: (formData.destination as string) || undefined,
        };
        for (const k of ['scrapType', 'weightTons', 'destination', 'photos', 'scrapDescription']) {
          delete payload[k];
        }
      }

      // Convert header-level numeric fields from string → number
      if (payload.vehicleYear) payload.vehicleYear = Number(payload.vehicleYear);
      if (payload.insuranceValue) payload.insuranceValue = Number(payload.insuranceValue);

      // Remove fields not in the JO Zod schema
      for (const k of [
        'qciRequired',
        'totalValue',
        'lines',
        'lineItems',
        'requester',
        'insuranceValueSar',
        'entryPermit',
        'type',
      ]) {
        delete payload[k];
      }
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

    // Map lineItems to the `lines` array format each backend schema expects
    const mappedLines = lineItems.map(li => {
      const base = { itemId: li.itemId };
      switch (formType) {
        case 'mirv': // MI — qtyRequested only
          return { ...base, qtyRequested: li.quantity, notes: li.notes };
        case 'mrv': // MRN — qtyReturned + uomId + condition
          return {
            ...base,
            qtyReturned: li.quantity,
            uomId: li.uomId,
            condition: conditionMap[li.condition || 'New'] || 'good',
            notes: li.notes,
          };
        case 'mrf': // MR — qtyRequested + uomId + itemDescription
          return {
            ...base,
            qtyRequested: li.quantity,
            uomId: li.uomId,
            itemDescription: li.itemName,
            notes: li.notes,
          };
        case 'imsf': // IMSF — qty + uomId + description
          return {
            ...base,
            qty: li.quantity,
            uomId: li.uomId,
            description: li.itemName,
          };
        case 'wt': // WT — quantity + uomId + condition
          return {
            ...base,
            quantity: li.quantity,
            uomId: li.uomId,
            condition: conditionMap[li.condition || 'New'] || 'good',
          };
        case 'osd': // DR — qtyInvoice + qtyReceived + uomId
          return {
            ...base,
            qtyInvoice: li.qtyExpected || li.quantity,
            qtyReceived: li.quantity,
            uomId: li.uomId,
            unitCost: li.unitPrice,
            notes: li.notes,
          };
        case 'shipment': // Shipment — quantity + description
          return {
            ...base,
            quantity: li.quantity,
            uomId: li.uomId,
            description: li.itemName || '',
            unitValue: li.unitPrice,
          };
        case 'gate-pass': // Gate Pass — quantity + uomId
          return {
            ...base,
            quantity: li.quantity,
            uomId: li.uomId,
            description: li.itemName,
          };
        default: // GRN (mrrv) and any others — qtyOrdered + qtyReceived
          return {
            ...base,
            qtyOrdered: li.qtyExpected || li.quantity,
            qtyReceived: li.quantity,
            uomId: li.uomId,
            unitCost: li.unitPrice,
            condition: conditionMap[li.condition || 'New'] || 'good',
            notes: li.notes,
          };
      }
    });
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
      'lineItems', // raw lineItems array — we send `lines` instead
      'date', // raw date field — mapped to receiveDate/requestDate/etc.
    ];
    for (const key of displayOnlyFields) {
      if (payload[key] !== undefined) {
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
    formConfig: effectiveFormConfig,
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
