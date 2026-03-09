/**
 * @deprecated Use mr.service.ts directly.
 * This file re-exports all functions from the V2 MR service
 * for backward compatibility during the migration period.
 */
export {
  list,
  getById,
  create,
  update,
  submit,
  review,
  approve,
  checkStock,
  convertToImsf,
  convertToMirv,
  fulfill,
  reject,
  cancel,
  convertToJo,
} from './mr.service.js';
