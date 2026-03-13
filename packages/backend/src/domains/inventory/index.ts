import type { Router } from 'express';
import binCardRoutes from './routes/bin-card.routes.js';
import cycleCountRoutes from './routes/cycle-count.routes.js';
import surplusRoutes from './routes/surplus.routes.js';
import scrapRoutes from './routes/scrap.routes.js';
import sscRoutes from './routes/ssc.routes.js';
import expiryAlertRoutes from './routes/expiry-alert.routes.js';
import abcAnalysisRoutes from './routes/abc-analysis.routes.js';
import reorderSuggestionsRoutes from './routes/reorder-suggestions.routes.js';

export function registerInventoryRoutes(router: Router) {
  router.use('/bin-cards', binCardRoutes);
  router.use('/cycle-counts', cycleCountRoutes);
  router.use('/surplus', surplusRoutes);
  router.use('/scrap', scrapRoutes);
  router.use('/ssc', sscRoutes);
  router.use('/inventory', expiryAlertRoutes);
  router.use('/inventory', reorderSuggestionsRoutes);
  router.use('/abc-analysis', abcAnalysisRoutes);
}
