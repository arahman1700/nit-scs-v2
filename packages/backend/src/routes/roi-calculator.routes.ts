/**
 * ROI Calculator Routes
 *
 * POST /roi-calculator/calculate — Compute ROI estimates based on operational inputs
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

router.use(authenticate);

// ── Industry benchmark multipliers ──────────────────────────────────────

/** Slotting + wave picking reduces pick time by 25-40%; we use 30% */
const PICK_TIME_REDUCTION = 0.3;

/** Barcode verification typically improves accuracy by 2-4pp; we use 3pp */
const ACCURACY_IMPROVEMENT_PP = 3;

/** Target accuracy after WMS implementation */
const TARGET_ACCURACY = 99.5;

/** Cycle counting + tracking reduces shrinkage by 30-50%; we use 40% */
const SHRINKAGE_REDUCTION = 0.4;

/** Route optimization reduces shipping costs by 15-20%; we use 17% */
const SHIPPING_COST_REDUCTION = 0.17;

/** Average hourly labor cost (USD) */
const AVG_HOURLY_LABOR_COST = 25;

/** Estimated annual platform cost for ROI payback calculation */
const ANNUAL_PLATFORM_COST = 48_000;

// ── POST /roi-calculator/calculate ──────────────────────────────────────

interface RoiInput {
  monthlyOrders?: number;
  warehouseWorkers?: number;
  avgPickTimeMinutes?: number;
  currentAccuracyPercent?: number;
  avgShippingCostPerOrder?: number;
  avgInventoryValue?: number;
  currentShrinkagePercent?: number;
}

router.post('/calculate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      monthlyOrders = 5000,
      warehouseWorkers = 20,
      avgPickTimeMinutes = 3.5,
      currentAccuracyPercent = 95,
      avgShippingCostPerOrder = 12,
      avgInventoryValue = 500_000,
      currentShrinkagePercent = 2,
    } = req.body as RoiInput;

    // Validate ranges
    if (monthlyOrders < 0 || warehouseWorkers < 0 || avgPickTimeMinutes < 0) {
      return sendError(res, 400, 'Input values must be non-negative');
    }

    // 1. Labor savings from pick time reduction (slotting + wave picking)
    const currentPickHoursMonthly = (monthlyOrders * avgPickTimeMinutes) / 60;
    const savedPickHoursMonthly = currentPickHoursMonthly * PICK_TIME_REDUCTION;
    const laborSavingsMonthly = Math.round(savedPickHoursMonthly * AVG_HOURLY_LABOR_COST * 100) / 100;

    // 2. Accuracy improvement
    const accuracyImprovement = Math.min(TARGET_ACCURACY - currentAccuracyPercent, ACCURACY_IMPROVEMENT_PP);
    const actualAccuracyImprovement = Math.max(0, Math.round(accuracyImprovement * 100) / 100);

    // 3. Time savings (hours/month)
    const timeSavingsHoursMonthly = Math.round(savedPickHoursMonthly * 100) / 100;

    // 4. Shipping cost reduction from route optimization
    const totalShippingCostMonthly = monthlyOrders * avgShippingCostPerOrder;
    const shippingCostReduction = Math.round(totalShippingCostMonthly * SHIPPING_COST_REDUCTION * 100) / 100;

    // 5. Shrinkage reduction from better tracking
    const currentShrinkageCostMonthly = (avgInventoryValue * (currentShrinkagePercent / 100)) / 12;
    const shrinkageReduction = Math.round(currentShrinkageCostMonthly * SHRINKAGE_REDUCTION * 100) / 100;

    // 6. Totals
    const totalMonthlySavings =
      Math.round((laborSavingsMonthly + shippingCostReduction + shrinkageReduction) * 100) / 100;
    const annualSavings = Math.round(totalMonthlySavings * 12 * 100) / 100;

    // 7. ROI payback period (months)
    const roiMonths = totalMonthlySavings > 0 ? Math.round((ANNUAL_PLATFORM_COST / totalMonthlySavings) * 10) / 10 : 0;

    sendSuccess(res, {
      laborSavingsMonthly,
      accuracyImprovement: actualAccuracyImprovement,
      timeSavingsHoursMonthly,
      shippingCostReduction,
      shrinkageReduction,
      totalMonthlySavings,
      annualSavings,
      roiMonths,
      // Detailed breakdown for charts
      breakdown: {
        laborPercent: totalMonthlySavings > 0 ? Math.round((laborSavingsMonthly / totalMonthlySavings) * 100) : 0,
        shippingPercent: totalMonthlySavings > 0 ? Math.round((shippingCostReduction / totalMonthlySavings) * 100) : 0,
        shrinkagePercent: totalMonthlySavings > 0 ? Math.round((shrinkageReduction / totalMonthlySavings) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
