import type { Router } from 'express';
import reportsRoutes from './routes/reports.routes.js';
import savedReportRoutes from './routes/saved-report.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import dashboardBuilderRoutes from './routes/dashboard-builder.routes.js';
import widgetDataRoutes from './routes/widget-data.routes.js';
import kpiRoutes from './routes/kpi.routes.js';
import semanticRoutes from './routes/semantic.routes.js';
import costAllocationRoutes from './routes/cost-allocation.routes.js';
import demandRoutes from './routes/demand.routes.js';
import consumptionTrendRoutes from './routes/consumption-trend.routes.js';
import demandForecastRoutes from './routes/demand-forecast.routes.js';
import roiCalculatorRoutes from './routes/roi-calculator.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import customDataSourceRoutes from './routes/custom-data-source.routes.js';

export function registerReportingRoutes(router: Router) {
  // Mount /saved BEFORE generic /reports to avoid shadowing
  router.use('/reports/saved', savedReportRoutes);
  router.use('/reports', reportsRoutes);
  router.use('/dashboard', dashboardRoutes);
  router.use('/dashboards', dashboardBuilderRoutes);
  router.use('/widget-data', widgetDataRoutes);
  router.use('/kpis', kpiRoutes);
  router.use('/semantic', semanticRoutes);
  router.use('/cost-allocation', costAllocationRoutes);
  router.use('/demand', demandRoutes);
  router.use('/consumption-trends', consumptionTrendRoutes);
  router.use('/demand-forecast', demandForecastRoutes);
  router.use('/roi-calculator', roiCalculatorRoutes);
  router.use('/intelligence', intelligenceRoutes);
  router.use('/custom-data-sources', customDataSourceRoutes);
}
