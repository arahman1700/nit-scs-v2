import type { Router } from 'express';
import attachmentRoutes from './routes/attachment.routes.js';
import uploadRoutes from './routes/upload.routes.js';

export function registerUploadRoutes(router: Router) {
  router.use('/attachments', attachmentRoutes);
  router.use('/upload', uploadRoutes);
}
