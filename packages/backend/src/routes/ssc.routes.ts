/**
 * SSC (Scrap Selling Committee) Bid Routes — V2
 * Simple CRUD using crud-factory — no state machine.
 */
import { createCrudRouter } from '../utils/crud-factory.js';
import { sscBidCreateSchema, sscBidUpdateSchema } from '../schemas/document.schema.js';

export default createCrudRouter({
  modelName: 'sscBid',
  tableName: 'ssc_bids',
  createSchema: sscBidCreateSchema,
  updateSchema: sscBidUpdateSchema,
  searchFields: ['bidderName'],
  includes: {
    scrapItem: {
      select: { id: true, scrapNumber: true, materialType: true, description: true },
    },
  },
  detailIncludes: {
    scrapItem: true,
  },
  allowedRoles: ['admin', 'scrap_committee_member'],
  allowedFilters: ['scrapItemId', 'status'],
  softDelete: false,
});
