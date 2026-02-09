import { Router } from 'express';
import jobOrderRoutes from './job-order.routes.js';
import gatePassRoutes from './gate-pass.routes.js';
import stockTransferRoutes from './stock-transfer.routes.js';
import mrfRoutes from './mrf.routes.js';
import shipmentRoutes from './shipment.routes.js';

const router = Router();

router.use('/job-orders', jobOrderRoutes);
router.use('/gate-passes', gatePassRoutes);
router.use('/stock-transfers', stockTransferRoutes);
router.use('/mrf', mrfRoutes);
router.use('/shipments', shipmentRoutes);

export default router;
