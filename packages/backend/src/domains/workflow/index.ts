import type { Router } from 'express';
import workflowRoutes from './routes/workflow.routes.js';
import workflowRuleRoutes from './routes/workflow-rule.routes.js';
import workflowTemplateRoutes from './routes/workflow-template.routes.js';
import approvalRoutes from './routes/approval.routes.js';
import parallelApprovalRoutes from './routes/parallel-approval.routes.js';
import delegationRoutes from './routes/delegation.routes.js';
import commentRoutes from './routes/comment.routes.js';
import signatureRoutes from './routes/digital-signature.routes.js';

export function registerWorkflowRoutes(router: Router) {
  router.use('/workflows', workflowRoutes);
  router.use('/workflows/:workflowId/rules', workflowRuleRoutes);
  router.use('/workflow-templates', workflowTemplateRoutes);
  router.use('/approvals', approvalRoutes);
  router.use('/parallel-approvals', parallelApprovalRoutes);
  router.use('/delegations', delegationRoutes);
  router.use('/comments', commentRoutes);
  router.use('/signatures', signatureRoutes);
}
