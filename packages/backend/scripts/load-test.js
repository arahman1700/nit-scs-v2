/**
 * NIT Supply Chain V2 — Load Test Script (k6)
 *
 * Install:  brew install k6   (or: https://k6.io/docs/getting-started/installation/)
 * Run:      k6 run scripts/load-test.js
 * Options:  k6 run --vus 50 --duration 2m scripts/load-test.js
 *           BASE_URL=https://api.example.com k6 run scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom Metrics ──
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const apiDuration = new Trend('api_duration', true);
const writeDuration = new Trend('write_duration', true);

// ── Configuration ──
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@nit.com.sa';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'admin123';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 25 }, // Ramp up to 25 users
    { duration: '2m', target: 25 }, // Sustain 25 users
    { duration: '30s', target: 50 }, // Spike to 50 users
    { duration: '1m', target: 50 }, // Sustain spike
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95th < 500ms, 99th < 1s
    errors: ['rate<0.05'], // Error rate < 5%
    login_duration: ['p(95)<1000'], // Login < 1s at p95
    api_duration: ['p(95)<300'], // API calls < 300ms at p95
    write_duration: ['p(95)<500'], // Write ops < 500ms at p95
  },
};

// ── Helpers ──
function apiCall(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const params = { headers, tags: { name: path } };
  let res;
  if (method === 'GET') {
    res = http.get(`${BASE_URL}${path}`, params);
  } else if (method === 'POST') {
    res = http.post(`${BASE_URL}${path}`, JSON.stringify(body), params);
  } else if (method === 'PUT') {
    res = http.put(`${BASE_URL}${path}`, JSON.stringify(body), params);
  } else if (method === 'DELETE') {
    res = http.del(`${BASE_URL}${path}`, params);
  }
  return res;
}

// ── Per-VU Setup — Authenticate once per virtual user ──
export function setup() {
  const res = apiCall('POST', '/api/v1/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const success = check(res, {
    'setup: login status 200': r => r.status === 200,
    'setup: has token': r => {
      try {
        return !!JSON.parse(r.body).data.accessToken;
      } catch {
        return false;
      }
    },
  });

  if (!success || res.status !== 200) {
    throw new Error(`Setup failed: could not authenticate (status ${res.status})`);
  }

  const token = JSON.parse(res.body).data.accessToken;
  return { token };
}

// ── Test Scenarios ──
export default function (data) {
  const token = data.token;

  group('Health Check', () => {
    const res = apiCall('GET', '/api/v1/health');
    check(res, { 'health: status 200': r => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  group('Readiness Probe', () => {
    const res = apiCall('GET', '/api/v1/ready');
    check(res, { 'ready: status 200': r => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  group('Dashboard Data', () => {
    const start = Date.now();
    const res = apiCall('GET', '/api/v1/reporting/dashboard', null, token);
    apiDuration.add(Date.now() - start);
    check(res, { 'dashboard: status 200': r => r.status === 200 });
    errorRate.add(res.status >= 400);
  });

  group('List Items', () => {
    const start = Date.now();
    const res = apiCall('GET', '/api/v1/master-data/items?page=1&pageSize=20', null, token);
    apiDuration.add(Date.now() - start);
    check(res, { 'items: status 200': r => r.status === 200 });
    errorRate.add(res.status >= 400);
  });

  group('List GRNs', () => {
    const start = Date.now();
    const res = apiCall('GET', '/api/v1/inbound/grn?page=1&pageSize=10', null, token);
    apiDuration.add(Date.now() - start);
    check(res, { 'grns: status 200': r => r.status === 200 });
    errorRate.add(res.status >= 400);
  });

  group('List MIs', () => {
    const start = Date.now();
    const res = apiCall('GET', '/api/v1/outbound/mi?page=1&pageSize=10', null, token);
    apiDuration.add(Date.now() - start);
    check(res, { 'mis: status 200': r => r.status === 200 });
    errorRate.add(res.status >= 400);
  });

  group('Inventory Summary', () => {
    const start = Date.now();
    const res = apiCall('GET', '/api/v1/inventory/bin-cards?page=1&pageSize=20', null, token);
    apiDuration.add(Date.now() - start);
    check(res, { 'inventory: status 200': r => r.status === 200 });
    errorRate.add(res.status >= 400);
  });

  // ── Write-Path Tests ──
  group('Create Item (Write)', () => {
    const start = Date.now();
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = apiCall(
      'POST',
      '/api/v1/master-data/items',
      {
        name: `Load Test Item ${uniqueSuffix}`,
        code: `LT-${uniqueSuffix}`,
        description: 'Auto-generated by k6 load test — safe to delete',
        categoryId: null,
      },
      token,
    );
    writeDuration.add(Date.now() - start);

    const created = check(res, {
      'create item: status 200 or 201': r => r.status === 200 || r.status === 201,
    });
    errorRate.add(!created);

    // Cleanup: delete the created item to avoid polluting the database
    if (res.status === 200 || res.status === 201) {
      try {
        const itemId = JSON.parse(res.body).data?.id;
        if (itemId) {
          apiCall('DELETE', `/api/v1/master-data/items/${itemId}`, null, token);
        }
      } catch {
        /* best-effort cleanup */
      }
    }
  });

  // Randomized think-time to simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5);
}
