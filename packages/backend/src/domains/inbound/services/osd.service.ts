/**
 * @deprecated Use dr.service.ts directly.
 * This file re-exports all functions from the V2 DR service
 * for backward compatibility during the migration period.
 */
export { list, getById, create, update, sendClaim, resolve } from './dr.service.js';
