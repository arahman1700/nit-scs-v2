import { createDocumentRouter } from '../../../utils/document-factory.js';
import {
  supplierEvaluationCreateSchema,
  supplierEvaluationUpdateSchema,
} from '../schemas/supplier-evaluation.schema.js';
import * as supplierEvaluationService from '../services/supplier-evaluation.service.js';

const WRITE_ROLES = ['admin', 'manager', 'logistics_coordinator'];
const COMPLETE_ROLES = ['admin', 'manager'];

export default createDocumentRouter({
  docType: 'supplier-evaluations',
  tableName: 'supplier_evaluations',
  resource: 'supplier_evaluation',
  scopeMapping: { createdByField: 'evaluatorId' },

  list: supplierEvaluationService.list,
  getById: supplierEvaluationService.getById,

  createSchema: supplierEvaluationCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    return supplierEvaluationService.create(
      body as {
        supplierId: string;
        periodStart: string;
        periodEnd: string;
        notes?: string;
        metrics?: Array<{ metricName: string; weight: number; rawScore: number; notes?: string }>;
      },
      userId,
    );
  },

  updateSchema: supplierEvaluationUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) =>
    supplierEvaluationService.update(
      id,
      body as {
        periodStart?: string;
        periodEnd?: string;
        notes?: string;
        metrics?: Array<{ metricName: string; weight: number; rawScore: number; notes?: string }>;
      },
    ),

  actions: [
    {
      path: 'complete',
      roles: COMPLETE_ROLES,
      handler: id => supplierEvaluationService.complete(id),
      socketEvent: 'supplier-evaluation:completed',
      socketData: () => ({ status: 'completed' }),
    },
  ],
});
