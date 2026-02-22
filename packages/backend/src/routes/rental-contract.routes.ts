/**
 * Rental Contract Routes — V2
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { rentalContractCreateSchema, rentalContractUpdateSchema } from '../schemas/document.schema.js';
import * as rentalContractService from '../services/rental-contract.service.js';
import type { RentalContractCreateDto, RentalContractUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'logistics_coordinator'];
const APPROVE_ROLES = ['admin', 'manager'];

export default createDocumentRouter({
  docType: 'rental_contract',
  tableName: 'rental_contracts',
  resource: 'rental_contract',
  scopeMapping: { createdByField: 'createdById' },

  list: rentalContractService.list,
  getById: rentalContractService.getById,

  createSchema: rentalContractCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as RentalContractCreateDto;
    return rentalContractService.create(headerData, lines, userId);
  },

  updateSchema: rentalContractUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => rentalContractService.update(id, body as RentalContractUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => rentalContractService.submit(id),
      socketEvent: 'rental_contract:submitted',
      socketData: () => ({ status: 'pending_approval' }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: id => rentalContractService.approve(id),
      socketEvent: 'rental_contract:approved',
      socketData: () => ({ status: 'active' }),
    },
    {
      path: 'activate',
      roles: APPROVE_ROLES,
      handler: id => rentalContractService.activate(id),
      socketEvent: 'rental_contract:activated',
      socketData: () => ({ status: 'active' }),
    },
    {
      path: 'extend',
      roles: APPROVE_ROLES,
      handler: (id, req) => {
        const { newEndDate } = req.body as { newEndDate: string };
        return rentalContractService.extend(id, newEndDate);
      },
      socketEvent: 'rental_contract:extended',
      socketData: () => ({ status: 'extended' }),
    },
    {
      path: 'terminate',
      roles: APPROVE_ROLES,
      handler: id => rentalContractService.terminate(id),
      socketEvent: 'rental_contract:terminated',
      socketData: () => ({ status: 'terminated' }),
    },
  ],
});
