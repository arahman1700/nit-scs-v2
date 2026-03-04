import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: [
      // MVP DEFERRED: Tests for routes that are commented out in routes/index.ts
      'src/routes/abc-analysis.routes.test.ts',
      'src/routes/asn.routes.test.ts',
      'src/routes/cross-dock.routes.test.ts',
      'src/routes/custom-data-source.routes.test.ts',
      'src/routes/custom-fields.routes.test.ts',
      'src/routes/cycle-count.routes.test.ts',
      'src/routes/dashboard-builder.routes.test.ts',
      'src/routes/demand-forecast.routes.test.ts',
      'src/routes/dynamic-document-type.routes.test.ts',
      'src/routes/dynamic-document.routes.test.ts',
      'src/routes/intelligence.routes.test.ts',
      'src/routes/packing.routes.test.ts',
      'src/routes/pick-optimizer.routes.test.ts',
      'src/routes/putaway-rules.routes.test.ts',
      'src/routes/roi-calculator.routes.test.ts',
      'src/routes/sensor.routes.test.ts',
      'src/routes/slotting.routes.test.ts',
      'src/routes/staging.routes.test.ts',
      'src/routes/workflow-template.routes.test.ts',
      'src/routes/yard.routes.test.ts',
    ],
  },
});
