import type { Router } from 'express';
import settingsRoutes from './routes/settings.routes.js';
import importRoutes from './routes/import.routes.js';
import bulkRoutes from './routes/bulk.routes.js';
import emailTemplateRoutes from './routes/email-template.routes.js';
import emailLogRoutes from './routes/email-log.routes.js';
import emailWebhookRoutes from './routes/email-webhook.routes.js';
import barcodeRoutes from './routes/barcode.routes.js';
import searchRoutes from './routes/search.routes.js';
import userViewRoutes from './routes/user-view.routes.js';
import companyDocumentRoutes from './routes/company-document.routes.js';
import navigationRoutes from './routes/navigation.routes.js';
import taskRoutes from './routes/task.routes.js';
import rateCardRoutes from './routes/rate-card.routes.js';
import customFieldsRoutes from './routes/custom-fields.routes.js';
import dynamicDocumentRoutes from './routes/dynamic-document.routes.js';
import dynamicDocumentTypeRoutes from './routes/dynamic-document-type.routes.js';
import eventbusMonitorRoutes from './routes/eventbus-monitor.routes.js';

export function registerSystemRoutes(router: Router) {
  router.use('/settings', settingsRoutes);
  router.use('/import', importRoutes);
  router.use('/bulk', bulkRoutes);
  router.use('/email-templates', emailTemplateRoutes);
  router.use('/email-logs', emailLogRoutes);
  router.use('/webhooks', emailWebhookRoutes);
  router.use('/barcodes', barcodeRoutes);
  router.use('/search', searchRoutes);
  router.use('/views', userViewRoutes);
  router.use('/documents', companyDocumentRoutes);
  router.use('/navigation', navigationRoutes);
  router.use('/tasks', taskRoutes);
  router.use('/rate-cards', rateCardRoutes);
  router.use('/custom-fields', customFieldsRoutes);
  router.use('/dynamic', dynamicDocumentRoutes);
  router.use('/dynamic-types', dynamicDocumentTypeRoutes);
  router.use('/monitor', eventbusMonitorRoutes);
}
