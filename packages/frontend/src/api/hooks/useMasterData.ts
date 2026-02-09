// ============================================================================
// Master Data React Query Hooks (Generic CRUD Factory)
// Generates hooks for all master data resources using a factory pattern.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  Project,
  Supplier,
  Employee,
  Warehouse,
  Generator,
  EquipmentFleet,
  SupplierRate,
  InventoryItem,
} from '@nit-scs-v2/shared/types';
import type { ListParams, ApiResponse } from '../types';

export type { ListParams, ApiResponse };

// ── Generic Resource Hook Factory ──────────────────────────────────────────

export function createResourceHooks<T extends { id: string }>(resourcePath: string, queryKey: string) {
  function useList(params?: ListParams) {
    return useQuery({
      queryKey: [queryKey, params],
      queryFn: async () => {
        const { data } = await apiClient.get<ApiResponse<T[]>>(resourcePath, { params });
        return data;
      },
    });
  }

  function useOne(id: string | undefined) {
    return useQuery({
      queryKey: [queryKey, id],
      queryFn: async () => {
        const { data } = await apiClient.get<ApiResponse<T>>(`${resourcePath}/${id}`);
        return data;
      },
      enabled: !!id,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (body: Partial<T>) => {
        const { data } = await apiClient.post<ApiResponse<T>>(resourcePath, body);
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, ...body }: Partial<T> & { id: string }) => {
        const { data } = await apiClient.put<ApiResponse<T>>(`${resourcePath}/${id}`, body);
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  function useRemove() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`${resourcePath}/${id}`);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  return { useList, useOne, useCreate, useUpdate, useRemove };
}

// ── Resource Hook Instances ────────────────────────────────────────────────

// Master data lookup tables
export const {
  useList: useRegions,
  useOne: useRegion,
  useCreate: useCreateRegion,
  useUpdate: useUpdateRegion,
  useRemove: useDeleteRegion,
} = createResourceHooks<{ id: string; name: string }>('/regions', 'regions');

export const {
  useList: useCities,
  useOne: useCity,
  useCreate: useCreateCity,
  useUpdate: useUpdateCity,
  useRemove: useDeleteCity,
} = createResourceHooks<{ id: string; name: string; regionId: string }>('/cities', 'cities');

export const {
  useList: usePorts,
  useOne: usePort,
  useCreate: useCreatePort,
  useUpdate: useUpdatePort,
  useRemove: useDeletePort,
} = createResourceHooks<{ id: string; name: string; city: string }>('/ports', 'ports');

export const {
  useList: useUoms,
  useOne: useUom,
  useCreate: useCreateUom,
  useUpdate: useUpdateUom,
  useRemove: useDeleteUom,
} = createResourceHooks<{ id: string; name: string; symbol: string }>('/uoms', 'uoms');

export const {
  useList: useWarehouseTypes,
  useOne: useWarehouseType,
  useCreate: useCreateWarehouseType,
  useUpdate: useUpdateWarehouseType,
  useRemove: useDeleteWarehouseType,
} = createResourceHooks<{ id: string; name: string }>('/warehouse-types', 'warehouse-types');

export const {
  useList: useEquipmentCategories,
  useOne: useEquipmentCategory,
  useCreate: useCreateEquipmentCategory,
  useUpdate: useUpdateEquipmentCategory,
  useRemove: useDeleteEquipmentCategory,
} = createResourceHooks<{ id: string; name: string }>('/equipment-categories', 'equipment-categories');

export const {
  useList: useEquipmentTypes,
  useOne: useEquipmentType,
  useCreate: useCreateEquipmentType,
  useUpdate: useUpdateEquipmentType,
  useRemove: useDeleteEquipmentType,
} = createResourceHooks<{ id: string; name: string; categoryId: string }>('/equipment-types', 'equipment-types');

// Core business entities
export const {
  useList: useProjects,
  useOne: useProject,
  useCreate: useCreateProject,
  useUpdate: useUpdateProject,
  useRemove: useDeleteProject,
} = createResourceHooks<Project>('/projects', 'projects');

export const {
  useList: useEmployees,
  useOne: useEmployee,
  useCreate: useCreateEmployee,
  useUpdate: useUpdateEmployee,
  useRemove: useDeleteEmployee,
} = createResourceHooks<Employee>('/employees', 'employees');

export const {
  useList: useSuppliers,
  useOne: useSupplier,
  useCreate: useCreateSupplier,
  useUpdate: useUpdateSupplier,
  useRemove: useDeleteSupplier,
} = createResourceHooks<Supplier>('/suppliers', 'suppliers');

export const {
  useList: useWarehouses,
  useOne: useWarehouse,
  useCreate: useCreateWarehouse,
  useUpdate: useUpdateWarehouse,
  useRemove: useDeleteWarehouse,
} = createResourceHooks<Warehouse>('/warehouses', 'warehouses');

export const {
  useList: useItems,
  useOne: useItem,
  useCreate: useCreateItem,
  useUpdate: useUpdateItem,
  useRemove: useDeleteItem,
} = createResourceHooks<{ id: string; code: string; name: string; category: string }>('/items', 'items');

export const {
  useList: useGenerators,
  useOne: useGenerator,
  useCreate: useCreateGenerator,
  useUpdate: useUpdateGenerator,
  useRemove: useDeleteGenerator,
} = createResourceHooks<Generator>('/generators', 'generators');

export const {
  useList: useFleet,
  useOne: useFleetItem,
  useCreate: useCreateFleetItem,
  useUpdate: useUpdateFleetItem,
  useRemove: useDeleteFleetItem,
} = createResourceHooks<EquipmentFleet>('/equipment-fleet', 'equipment-fleet');

export const {
  useList: useSupplierRates,
  useOne: useSupplierRate,
  useCreate: useCreateSupplierRate,
  useUpdate: useUpdateSupplierRate,
  useRemove: useDeleteSupplierRate,
} = createResourceHooks<SupplierRate>('/supplier-rates', 'supplier-rates');

export const {
  useList: useInventory,
  useOne: useInventoryItem,
  useCreate: useCreateInventoryItem,
  useUpdate: useUpdateInventoryItem,
  useRemove: useDeleteInventoryItem,
} = createResourceHooks<InventoryItem>('/inventory', 'inventory');

// ── Document Resources (MRRV, MIRV, MRV, RFIM, OSD, JO, etc.) ────────────

export const {
  useList: useMrrvList,
  useOne: useMrrv,
  useCreate: useCreateMrrv,
  useUpdate: useUpdateMrrv,
  useRemove: useDeleteMrrv,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/mrrv', 'mrrv');

export const {
  useList: useMirvList,
  useOne: useMirv,
  useCreate: useCreateMirv,
  useUpdate: useUpdateMirv,
  useRemove: useDeleteMirv,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/mirv', 'mirv');

export const {
  useList: useMrvList,
  useOne: useMrv,
  useCreate: useCreateMrv,
  useUpdate: useUpdateMrv,
  useRemove: useDeleteMrv,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/mrv', 'mrv');

export const {
  useList: useRfimList,
  useOne: useRfim,
  useCreate: useCreateRfim,
  useUpdate: useUpdateRfim,
  useRemove: useDeleteRfim,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/rfim', 'rfim');

export const {
  useList: useOsdList,
  useOne: useOsd,
  useCreate: useCreateOsd,
  useUpdate: useUpdateOsd,
  useRemove: useDeleteOsd,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/osd', 'osd');

export const {
  useList: useJobOrders,
  useOne: useJobOrder,
  useCreate: useCreateJobOrder,
  useUpdate: useUpdateJobOrder,
  useRemove: useDeleteJobOrder,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/job-orders', 'job-orders');

export const {
  useList: useGatePasses,
  useOne: useGatePass,
  useCreate: useCreateGatePass,
  useUpdate: useUpdateGatePass,
  useRemove: useDeleteGatePass,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/gate-passes', 'gate-passes');

export const {
  useList: useStockTransfers,
  useOne: useStockTransfer,
  useCreate: useCreateStockTransfer,
  useUpdate: useUpdateStockTransfer,
  useRemove: useDeleteStockTransfer,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/stock-transfers', 'stock-transfers');

export const {
  useList: useShipments,
  useOne: useShipment,
  useCreate: useCreateShipment,
  useUpdate: useUpdateShipment,
  useRemove: useDeleteShipment,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/shipments', 'shipments');

export const {
  useList: useCustomsClearances,
  useOne: useCustomsClearance,
  useCreate: useCreateCustomsClearance,
  useUpdate: useUpdateCustomsClearance,
  useRemove: useDeleteCustomsClearance,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/customs', 'customs');

export const {
  useList: useMrfList,
  useOne: useMrf,
  useCreate: useCreateMrf,
  useUpdate: useUpdateMrf,
  useRemove: useDeleteMrf,
} = createResourceHooks<{ id: string } & Record<string, unknown>>('/mrf', 'mrf');

// ── Dynamic Hook Map (for AdminResourceList) ──────────────────────────────

/** Returns the correct useList hook given a URL resource parameter */
export function getResourceListHook(resource: string) {
  const hookMap: Record<string, (params?: ListParams) => ReturnType<typeof useQuery>> = {
    mrrv: useMrrvList,
    mirv: useMirvList,
    mrv: useMrvList,
    rfim: useRfimList,
    osd: useOsdList,
    'job-orders': useJobOrders,
    'gate-pass': useGatePasses,
    'stock-transfer': useStockTransfers,
    shipments: useShipments,
    customs: useCustomsClearances,
    inventory: useInventory,
    projects: useProjects,
    employees: useEmployees,
    suppliers: useSuppliers,
    warehouses: useWarehouses,
    fleet: useFleet,
    generators: useGenerators,
    reports: useShipments, // Shipping reports reuse shipments endpoint
  };
  return hookMap[resource] || null;
}
