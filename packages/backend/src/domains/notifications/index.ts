import type { Router } from 'express';
import notificationRoutes from './routes/notification.routes.js';
import pushRoutes from './routes/push.routes.js';

export function registerNotificationRoutes(router: Router) {
  router.use('/notifications', notificationRoutes);
  router.use('/push', pushRoutes);
}
