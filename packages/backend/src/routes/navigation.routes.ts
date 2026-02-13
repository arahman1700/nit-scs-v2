import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as navigationService from '../services/navigation.service.js';

const router = Router();
router.use(authenticate);

// GET /navigation — returns nav for authenticated user's role
router.get('/', async (req, res, next) => {
  try {
    const role = req.user?.systemRole || 'warehouse_staff';
    const nav = await navigationService.getNavigationForRole(role);
    res.json({ data: nav });
  } catch (err) {
    next(err);
  }
});

// PUT /navigation/order — admin-only: reorder items for a role
router.put('/order', requireRole('admin'), async (req, res, next) => {
  try {
    const { role, overrides } = req.body;
    await navigationService.updateNavigationOrder(role, overrides);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /navigation/visibility — admin-only: toggle item visibility
router.put('/visibility', requireRole('admin'), async (req, res, next) => {
  try {
    const { role, path, hidden } = req.body;
    if (hidden) {
      await navigationService.hideNavigationItem(role, path);
    } else {
      await navigationService.showNavigationItem(role, path);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
