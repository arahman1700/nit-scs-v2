/**
 * Rate Card Routes — V2 (SOW M2-F06)
 *
 * Supplier × Equipment Type rate cards as standalone master data.
 * CRUD via createCrudRouter + custom /lookup endpoint for auto-pull.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { createCrudRouter } from '../utils/crud-factory.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { rateCardCreateSchema, rateCardUpdateSchema } from '../schemas/document.schema.js';
import * as rateCardService from '../services/rate-card.service.js';

const ALLOWED_ROLES = ['admin', 'manager', 'logistics_coordinator', 'finance_user'];

const rateCardCrud = createCrudRouter({
  modelName: 'supplierEquipmentRate',
  tableName: 'supplier_equipment_rates',
  resource: 'rate_card',
  createSchema: rateCardCreateSchema,
  updateSchema: rateCardUpdateSchema,
  searchFields: ['capacity', 'notes'],
  includes: {
    supplier: { select: { id: true, supplierName: true, supplierCode: true } },
    equipmentType: { select: { id: true, typeName: true } },
  },
  detailIncludes: {
    supplier: { select: { id: true, supplierName: true, supplierCode: true, phone: true, email: true } },
    equipmentType: { select: { id: true, typeName: true, categoryId: true } },
  },
  allowedRoles: ALLOWED_ROLES,
  allowedFilters: ['supplierId', 'equipmentTypeId', 'status'],
  defaultSort: 'updatedAt',
  softDelete: false,
});

const router = Router();

/**
 * GET /rate-cards/lookup?supplierId=...&equipmentTypeId=...
 *
 * Auto-pull endpoint: finds the active rate card for a given supplier
 * and equipment type combination. Used by Job Order forms to auto-populate
 * rate fields.
 */
router.get(
  '/lookup',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplierId, equipmentTypeId } = req.query as Record<string, string>;

      if (!supplierId || !equipmentTypeId) {
        res.status(400).json({
          success: false,
          error: 'Both supplierId and equipmentTypeId query parameters are required',
        });
        return;
      }

      const rateCard = await rateCardService.getActiveRateForEquipment(supplierId, equipmentTypeId);

      if (!rateCard) {
        res.json({ success: true, data: null });
        return;
      }

      res.json({ success: true, data: rateCard });
    } catch (err) {
      next(err);
    }
  },
);

router.use('/', rateCardCrud);

export default router;
