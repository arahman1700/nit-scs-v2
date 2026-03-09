/**
 * @deprecated Use mi.service.ts directly.
 * This file re-exports all functions from the V2 MI service
 * for backward compatibility during the migration period.
 */
export { list, getById, create, update, submit, approve, signQc, issue, cancel } from './mi.service.js';
