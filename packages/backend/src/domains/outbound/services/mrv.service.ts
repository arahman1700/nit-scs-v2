/**
 * @deprecated Use mrn.service.ts directly.
 * This file re-exports all functions from the V2 MRN service
 * for backward compatibility during the migration period.
 */
export { list, getById, create, update, submit, receive, complete } from './mrn.service.js';
