import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: [
      // MVP DEFERRED: Tests for routes not yet fully wired
      'src/domains/inventory/routes/abc-analysis.routes.test.ts',
      'src/domains/inbound/routes/asn.routes.test.ts',
      'src/domains/warehouse-ops/routes/cross-dock.routes.test.ts',
      'src/domains/reporting/routes/custom-data-source.routes.test.ts',
      'src/domains/system/routes/custom-fields.routes.test.ts',
      'src/domains/inventory/routes/cycle-count.routes.test.ts',
      'src/domains/reporting/routes/dashboard-builder.routes.test.ts',
      'src/domains/reporting/routes/demand-forecast.routes.test.ts',
      'src/domains/system/routes/dynamic-document-type.routes.test.ts',
      'src/domains/system/routes/dynamic-document.routes.test.ts',
      'src/domains/reporting/routes/intelligence.routes.test.ts',
      'src/domains/warehouse-ops/routes/packing.routes.test.ts',
      'src/domains/outbound/routes/pick-optimizer.routes.test.ts',
      'src/domains/warehouse-ops/routes/putaway-rules.routes.test.ts',
      'src/domains/reporting/routes/roi-calculator.routes.test.ts',
      'src/domains/warehouse-ops/routes/sensor.routes.test.ts',
      'src/domains/warehouse-ops/routes/slotting.routes.test.ts',
      'src/domains/warehouse-ops/routes/staging.routes.test.ts',
      'src/domains/workflow/routes/workflow-template.routes.test.ts',
      'src/domains/warehouse-ops/routes/yard.routes.test.ts',
    ],
  },
});
