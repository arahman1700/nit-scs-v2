/**
 * Tool Issue Routes — V2
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { toolIssueCreateSchema, toolIssueReturnSchema } from '../schemas/document.schema.js';
import * as toolIssueService from '../services/tool-issue.service.js';
import type { ToolIssueCreateDto, ToolIssueReturnDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff'];

export default createDocumentRouter({
  docType: 'tool_issue',
  tableName: 'tool_issues',
  scopeMapping: { createdByField: 'issuedById' },

  list: toolIssueService.list,
  getById: toolIssueService.getById,

  createSchema: toolIssueCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => toolIssueService.create(body as ToolIssueCreateDto, userId),

  updateRoles: WRITE_ROLES,
  update: (id, body) => toolIssueService.update(id, body as Record<string, unknown>),

  actions: [
    {
      path: 'return',
      roles: WRITE_ROLES,
      handler: (id, req) => toolIssueService.returnTool(id, req.body as ToolIssueReturnDto, req.user!.userId),
      bodySchema: toolIssueReturnSchema,
      socketEvent: 'tool_issue:returned',
      socketData: () => ({ status: 'returned' }),
    },
  ],
});
