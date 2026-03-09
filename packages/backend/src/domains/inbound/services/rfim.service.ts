/**
 * @deprecated Use qci.service.ts directly.
 * This file re-exports all functions from the V2 QCI service
 * for backward compatibility during the migration period.
 */
export { list, getById, update, start, complete, completeConditional, pmApprove } from './qci.service.js';
