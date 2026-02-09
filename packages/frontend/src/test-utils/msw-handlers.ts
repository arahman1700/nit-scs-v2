import { http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

// Default mock data
const mockUser = {
  id: 'user-1',
  employeeIdNumber: 'EMP-001',
  fullName: 'Ahmed Admin',
  fullNameAr: 'أحمد أدمن',
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

export const handlers = [
  // ── Auth ─────────────────────────────────────────────────────────────
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

  // ── Generic resource lists (mrrv, mirv, mrv, etc.) ───────────────────
  http.get(`${API_BASE}/mrrv`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'mrrv-1',
          formNumber: 'MRRV-2026-00001',
          status: 'draft',
          createdAt: '2026-01-15T10:00:00Z',
        },
      ]),
    );
  }),

  http.get(`${API_BASE}/mirv`, () => {
    return HttpResponse.json(
      listResponse([
        {
          id: 'mirv-1',
          formNumber: 'MIRV-2026-00001',
          status: 'draft',
          createdAt: '2026-01-15T10:00:00Z',
        },
      ]),
    );
  }),

  // ── Notifications ──────────────────────────────────────────────────
  http.get(`${API_BASE}/notifications`, () => {
    return HttpResponse.json(listResponse([]));
  }),

  // ── Dashboard ──────────────────────────────────────────────────────
  http.get(`${API_BASE}/dashboard/stats`, () => {
    return HttpResponse.json(
      successResponse({
        totalMrrv: 10,
        totalMirv: 5,
        totalMrv: 3,
        pendingApprovals: 2,
      }),
    );
  }),
];
