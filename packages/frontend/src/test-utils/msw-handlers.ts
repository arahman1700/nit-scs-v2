import { http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

// Default mock data
const mockUser = {
  id: 'user-1',
  employeeIdNumber: 'EMP-001',
  fullName: 'Ahmed Admin',
  fullNameAr: '\u0623\u062d\u0645\u062f \u0623\u062f\u0645\u0646',
  email: 'admin@nit.sa',
  phone: '+966501234567',
  department: 'admin',
  role: 'System Administrator',
  systemRole: 'admin',
  isActive: true,
};

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

// Paginated list response factory
function listResponse<T>(data: T[], total?: number) {
  const t = total ?? data.length;
  return {
    success: true,
    data,
    meta: { page: 1, limit: 20, total: t, totalPages: Math.ceil(t / 20) },
  };
}

function successResponse<T>(data: T) {
  return { success: true, data };
}

// -- Generic CRUD handler factory for master data resources
const masterDataResources = [
  'projects',
  'suppliers',
  'warehouses',
  'employees',
  'items',
  'generators',
  'equipment-fleet',
  'supplier-rates',
  'inventory',
  'regions',
  'cities',
  'ports',
  'uoms',
  'warehouse-types',
  'equipment-categories',
  'equipment-types',
] as const;

function createMasterDataHandlers() {
  return masterDataResources.flatMap(resource => {
    const key = resource.replace(/-/g, '_');
    return [
      http.get(`${API_BASE}/${resource}`, () => {
        return HttpResponse.json(listResponse([{ id: `${key}-1`, name: 'Sample' }]));
      }),
      http.get(`${API_BASE}/${resource}/:id`, ({ params }) => {
        return HttpResponse.json(successResponse({ id: params.id, name: 'Sample' }));
      }),
      http.post(`${API_BASE}/${resource}`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(successResponse({ id: `${key}-new`, ...(body as object) }));
      }),
      http.put(`${API_BASE}/${resource}/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
      }),
      http.delete(`${API_BASE}/${resource}/:id`, () => {
        return new HttpResponse(null, { status: 204 });
      }),
    ];
  });
}

export const handlers = [
  // -- Auth
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password === 'wrong') {
      return HttpResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json(successResponse({ ...mockTokens, user: mockUser }));
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json(successResponse(null));
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json(successResponse(mockUser));
  }),

  http.post(`${API_BASE}/auth/refresh`, () => {
    return HttpResponse.json(successResponse(mockTokens));
  }),

  // -- GRN (MRRV) endpoints
  http.get(`${API_BASE}/grn`, () => {
    return HttpResponse.json(
      listResponse([
        { id: 'grn-1', formNumber: 'GRN-2026-00001', status: 'draft', createdAt: '2026-01-15T10:00:00Z' },
        { id: 'grn-2', formNumber: 'GRN-2026-00002', status: 'submitted', createdAt: '2026-01-16T10:00:00Z' },
      ]),
    );
  }),

  http.get(`${API_BASE}/grn/:id`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, formNumber: 'GRN-2026-00001', status: 'draft' }));
  }),

  http.post(`${API_BASE}/grn`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'grn-new', ...(body as object), status: 'draft' }));
  }),

  http.put(`${API_BASE}/grn/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/grn/:id/submit`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'submitted' }));
  }),

  http.post(`${API_BASE}/grn/:id/approve-qc`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'qc_approved' }));
  }),

  http.post(`${API_BASE}/grn/:id/receive`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'received' }));
  }),

  http.post(`${API_BASE}/grn/:id/store`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'stored' }));
  }),

  // -- MI (MIRV) endpoints
  http.get(`${API_BASE}/mi`, () => {
    return HttpResponse.json(listResponse([{ id: 'mi-1', formNumber: 'MI-2026-00001', status: 'draft' }]));
  }),

  http.get(`${API_BASE}/mi/:id`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, formNumber: 'MI-2026-00001', status: 'draft' }));
  }),

  http.post(`${API_BASE}/mi`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'mi-new', ...(body as object), status: 'draft' }));
  }),

  http.put(`${API_BASE}/mi/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/mi/:id/submit`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'submitted' }));
  }),

  http.post(`${API_BASE}/mi/:id/approve`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'approved' }));
  }),

  http.post(`${API_BASE}/mi/:id/issue`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'issued' }));
  }),

  http.post(`${API_BASE}/mi/:id/cancel`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'cancelled' }));
  }),

  // -- MR (Material Requisition) endpoints
  http.get(`${API_BASE}/mr`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'mr-1',
          formNumber: 'MR-2026-00001',
          status: 'draft',
          projectId: 'proj-1',
          createdAt: '2026-01-20T10:00:00Z',
        },
        {
          id: 'mr-2',
          formNumber: 'MR-2026-00002',
          status: 'submitted',
          projectId: 'proj-2',
          createdAt: '2026-01-21T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/mr/:id`, ({ params }) => {
    return HttpResponse.json(
      successResponse({ id: params.id, formNumber: 'MR-2026-00001', status: 'draft', projectId: 'proj-1' }),
    );
  }),

  http.post(`${API_BASE}/mr`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'mr-new', ...(body as object), status: 'draft' }));
  }),

  http.put(`${API_BASE}/mr/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/mr/:id/submit`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'submitted' }));
  }),

  http.post(`${API_BASE}/mr/:id/review`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'reviewed' }));
  }),

  http.post(`${API_BASE}/mr/:id/approve`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'approved' }));
  }),

  http.post(`${API_BASE}/mr/:id/check-stock`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'stock_checked' }));
  }),

  http.post(`${API_BASE}/mr/:id/convert-mi`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'converted_mi' }));
  }),

  http.post(`${API_BASE}/mr/:id/convert-to-imsf`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'converted_imsf' }));
  }),

  http.post(`${API_BASE}/mr/:id/fulfill`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'fulfilled' }));
  }),

  http.post(`${API_BASE}/mr/:id/reject`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'rejected' }));
  }),

  http.post(`${API_BASE}/mr/:id/cancel`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'cancelled' }));
  }),

  // -- Job Order endpoints
  http.get(`${API_BASE}/job-orders`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'jo-1',
          formNumber: 'JO-2026-00001',
          status: 'draft',
          projectId: 'proj-1',
          createdAt: '2026-01-22T10:00:00Z',
        },
        {
          id: 'jo-2',
          formNumber: 'JO-2026-00002',
          status: 'submitted',
          projectId: 'proj-2',
          createdAt: '2026-01-23T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/job-orders/:id`, ({ params }) => {
    return HttpResponse.json(
      successResponse({ id: params.id, formNumber: 'JO-2026-00001', status: 'draft', projectId: 'proj-1' }),
    );
  }),

  http.post(`${API_BASE}/job-orders`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'jo-new', ...(body as object), status: 'draft' }));
  }),

  http.put(`${API_BASE}/job-orders/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/job-orders/:id/submit`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'submitted' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/approve`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'approved' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/reject`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'rejected' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/assign`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'assigned' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/start`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'in_progress' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/hold`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'on_hold' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/resume`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'in_progress' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/complete`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'completed' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/invoice`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'invoiced' }));
  }),

  http.post(`${API_BASE}/job-orders/:id/cancel`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'cancelled' }));
  }),

  // -- Generic resource lists (mrrv, mirv, mrv, etc.)
  http.get(`${API_BASE}/mrrv`, () => {
    return HttpResponse.json(
      listResponse([
        { id: 'mrrv-1', formNumber: 'MRRV-2026-00001', status: 'draft', createdAt: '2026-01-15T10:00:00Z' },
      ]),
    );
  }),

  http.get(`${API_BASE}/mirv`, () => {
    return HttpResponse.json(
      listResponse([
        { id: 'mirv-1', formNumber: 'MIRV-2026-00001', status: 'draft', createdAt: '2026-01-15T10:00:00Z' },
      ]),
    );
  }),

  // -- Notifications
  http.get(`${API_BASE}/notifications`, () => {
    return HttpResponse.json(listResponse([]));
  }),

  http.get(`${API_BASE}/notifications/unread-count`, () => {
    return HttpResponse.json(successResponse(5));
  }),

  http.put(`${API_BASE}/notifications/read-all`, () => {
    return HttpResponse.json(successResponse(null));
  }),

  http.put(`${API_BASE}/notifications/:id/read`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, read: true }));
  }),

  http.delete(`${API_BASE}/notifications/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // -- Dashboard
  http.get(`${API_BASE}/dashboard/stats`, () => {
    return HttpResponse.json(successResponse({ totalMrrv: 10, totalMirv: 5, totalMrv: 3, pendingApprovals: 2 }));
  }),

  http.get(`${API_BASE}/dashboard/recent-activity`, () => {
    return HttpResponse.json(
      successResponse([
        {
          id: 'a1',
          time: '2026-01-15T10:00:00Z',
          action: 'Created GRN',
          user: 'Admin',
          details: 'GRN-2026-00001',
          type: 'success',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/dashboard/inventory-summary`, () => {
    return HttpResponse.json(
      successResponse({
        totalItems: 100,
        totalQty: 5000,
        lowStock: 5,
        outOfStock: 2,
        totalValue: 250000,
        byCategory: [{ name: 'Electrical', value: 50000 }],
      }),
    );
  }),

  http.get(`${API_BASE}/dashboard/document-counts`, () => {
    return HttpResponse.json(
      successResponse({
        mrrv: { total: 10, pending: 3 },
        mirv: { total: 5, pending: 2 },
        jo: { total: 8, inProgress: 4 },
        shipments: { total: 6, inTransit: 2 },
      }),
    );
  }),

  http.get(`${API_BASE}/dashboard/sla-compliance`, () => {
    return HttpResponse.json(
      successResponse({
        mirv: { total: 100, onTime: 85, breached: 10, pending: 5 },
        jo: { total: 50, onTime: 40, breached: 5, pending: 5 },
      }),
    );
  }),

  http.get(`${API_BASE}/dashboard/top-projects`, () => {
    return HttpResponse.json(
      successResponse([{ id: 'p1', name: 'Project Alpha', client: 'Client A', activeJobs: 5, pendingMirv: 2 }]),
    );
  }),

  http.get(`${API_BASE}/dashboard/cross-department`, () => {
    return HttpResponse.json(
      successResponse({
        inventory: { totalInventoryValue: 500000, lowStockAlerts: 3, blockedLots: 1, warehouses: [] },
        documentPipeline: {},
        recentActivity: [],
      }),
    );
  }),

  http.get(`${API_BASE}/dashboard/exceptions`, () => {
    return HttpResponse.json(
      successResponse({
        overdueApprovals: { count: 0, items: [] },
        slaBreaches: { count: 0, items: [] },
        lowStock: { count: 0, items: [] },
        stalledDocuments: { count: 0, items: [] },
        expiringInventory: { count: 0, items: [] },
        totalExceptions: 0,
      }),
    );
  }),

  // -- QCI (RFIM) endpoints
  http.get(`${API_BASE}/qci`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'qci-1',
          formNumber: 'QCI-2026-00001',
          status: 'pending',
          grnId: 'grn-1',
          createdAt: '2026-01-20T10:00:00Z',
        },
        {
          id: 'qci-2',
          formNumber: 'QCI-2026-00002',
          status: 'in_progress',
          grnId: 'grn-2',
          createdAt: '2026-01-21T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/qci/:id`, ({ params }) => {
    return HttpResponse.json(
      successResponse({ id: params.id, formNumber: 'QCI-2026-00001', status: 'pending', grnId: 'grn-1' }),
    );
  }),

  http.put(`${API_BASE}/qci/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/qci/:id/start`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'in_progress' }));
  }),

  http.post(`${API_BASE}/qci/:id/complete`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, status: 'completed', ...(body as object) }));
  }),

  // -- DR (OSD Report) endpoints
  http.get(`${API_BASE}/dr`, () => {
    return HttpResponse.json(
      listResponse([
        { id: 'dr-1', formNumber: 'DR-2026-00001', status: 'draft', grnId: 'grn-1', createdAt: '2026-01-22T10:00:00Z' },
        {
          id: 'dr-2',
          formNumber: 'DR-2026-00002',
          status: 'claim_sent',
          grnId: 'grn-2',
          createdAt: '2026-01-23T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/dr/:id`, ({ params }) => {
    return HttpResponse.json(
      successResponse({ id: params.id, formNumber: 'DR-2026-00001', status: 'draft', grnId: 'grn-1' }),
    );
  }),

  http.post(`${API_BASE}/dr`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'dr-new', ...(body as object), status: 'draft' }));
  }),

  http.put(`${API_BASE}/dr/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/dr/:id/send-claim`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'claim_sent' }));
  }),

  http.post(`${API_BASE}/dr/:id/resolve`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, status: 'resolved', ...(body as object) }));
  }),

  // -- MRN (MRV) endpoints
  http.get(`${API_BASE}/mrn`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'mrn-1',
          formNumber: 'MRN-2026-00001',
          status: 'draft',
          warehouseId: 'wh-1',
          createdAt: '2026-01-24T10:00:00Z',
        },
        {
          id: 'mrn-2',
          formNumber: 'MRN-2026-00002',
          status: 'submitted',
          warehouseId: 'wh-2',
          createdAt: '2026-01-25T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/mrn/:id`, ({ params }) => {
    return HttpResponse.json(
      successResponse({ id: params.id, formNumber: 'MRN-2026-00001', status: 'draft', warehouseId: 'wh-1' }),
    );
  }),

  http.post(`${API_BASE}/mrn`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'mrn-new', ...(body as object), status: 'draft' }));
  }),

  http.put(`${API_BASE}/mrn/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/mrn/:id/submit`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'submitted' }));
  }),

  http.post(`${API_BASE}/mrn/:id/receive`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'received' }));
  }),

  http.post(`${API_BASE}/mrn/:id/complete`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'completed' }));
  }),

  // -- Generator Maintenance endpoints
  http.get(`${API_BASE}/generator-maintenance`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'gm-1',
          generatorId: 'gen-1',
          type: 'preventive',
          status: 'scheduled',
          createdAt: '2026-02-01T10:00:00Z',
        },
        {
          id: 'gm-2',
          generatorId: 'gen-2',
          type: 'corrective',
          status: 'in_progress',
          createdAt: '2026-02-02T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/generator-maintenance/:id`, ({ params }) => {
    return HttpResponse.json(
      successResponse({ id: params.id, generatorId: 'gen-1', type: 'preventive', status: 'scheduled' }),
    );
  }),

  http.post(`${API_BASE}/generator-maintenance`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: 'gm-new', ...(body as object), status: 'scheduled' }));
  }),

  http.put(`${API_BASE}/generator-maintenance/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json(successResponse({ id: params.id, ...(body as object) }));
  }),

  http.post(`${API_BASE}/generator-maintenance/:id/start`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'in_progress' }));
  }),

  http.post(`${API_BASE}/generator-maintenance/:id/complete`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'completed' }));
  }),

  http.post(`${API_BASE}/generator-maintenance/:id/mark-overdue`, ({ params }) => {
    return HttpResponse.json(successResponse({ id: params.id, status: 'overdue' }));
  }),

  // -- Master Data CRUD (generated)
  ...createMasterDataHandlers(),
];
