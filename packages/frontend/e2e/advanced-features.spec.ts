import { test, expect } from '@playwright/test';
import { gotoAuth } from './helpers';

const adminPages = [
  { name: 'Settings', path: '/admin/settings' },
  { name: 'Dashboard Builder', path: '/admin/settings/dashboards' },
  { name: 'Report Builder', path: '/admin/settings/reports' },
  { name: 'Documents', path: '/admin/documents' },
  { name: 'Tasks', path: '/admin/tasks' },
  { name: 'Intelligence', path: '/admin/intelligence' },
  { name: 'Map', path: '/admin/map' },
  { name: 'Features Showcase', path: '/admin/features' },
  { name: 'ROI Calculator', path: '/admin/roi-calculator' },
  { name: 'Pending Approvals', path: '/admin/parallel-approvals' },
];

test.describe('Admin Pages', () => {
  for (const pg of adminPages) {
    test(`${pg.name} loads without crash`, async ({ page }) => {
      await gotoAuth(page, pg.path);
      await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
    });
  }
});

const warehouseOps = [
  { name: 'Cycle Counts', path: '/admin/warehouse/cycle-counts' },
  { name: 'Wave Picking', path: '/admin/warehouse/wave-picking' },
  { name: 'ASN', path: '/admin/warehouse/asn' },
  { name: 'Slotting', path: '/admin/warehouse/slotting' },
  { name: 'Cross-docking', path: '/admin/warehouse/cross-docking' },
  { name: 'Sensors', path: '/admin/warehouse/sensors' },
  { name: 'Yard', path: '/admin/warehouse/yard' },
  { name: 'Packing', path: '/admin/warehouse/packing' },
  { name: 'Staging', path: '/admin/warehouse/staging' },
  { name: 'Put-away Rules', path: '/admin/warehouse/putaway-rules' },
];

test.describe('Warehouse Advanced Operations', () => {
  for (const op of warehouseOps) {
    test(`${op.name} loads without crash`, async ({ page }) => {
      await gotoAuth(page, op.path);
      await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
    });
  }
});

const dashboards = [
  { name: 'Assets', path: '/admin/dashboards/assets' },
  { name: 'Labor', path: '/admin/dashboards/labor' },
  { name: 'ABC Analysis', path: '/admin/dashboards/abc-analysis' },
  { name: 'Forecast', path: '/admin/dashboards/forecast' },
  { name: 'Operations', path: '/admin/dashboards/operations' },
  { name: 'Exceptions', path: '/admin/dashboards/exceptions' },
  { name: 'Depreciation', path: '/admin/dashboards/depreciation' },
];

test.describe('Analytics Dashboards', () => {
  for (const dash of dashboards) {
    test(`${dash.name} dashboard loads without crash`, async ({ page }) => {
      await gotoAuth(page, dash.path);
      await expect(page.getByText(/Something went wrong|Application error/i)).not.toBeVisible();
    });
  }
});
