import { Router } from 'express';
import jobOrderRoutes from '../../job-orders/routes/job-order.routes.js';
import gatePassRoutes from './gate-pass.routes.js';
import stockTransferRoutes from '../../transfers/routes/stock-transfer.routes.js';
import mrfRoutes from '../../outbound/routes/mrf.routes.js';
import shipmentRoutes from './shipment.routes.js';
import transportOrderRoutes from './transport-order.routes.js';

const router = Router();

router.use('/job-orders', jobOrderRoutes);
router.use('/gate-passes', gatePassRoutes);
router.use('/stock-transfers', stockTransferRoutes);
router.use('/mrf', mrfRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/transport-orders', transportOrderRoutes);

export default router;
