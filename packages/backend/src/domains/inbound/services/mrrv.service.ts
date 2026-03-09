/**
 * @deprecated Use grn.service.ts directly.
 * This file re-exports all functions from the V2 GRN service
 * for backward compatibility during the migration period.
 */
export { list, getById, create, update, submit, approveQc, receive, store } from './grn.service.js';
