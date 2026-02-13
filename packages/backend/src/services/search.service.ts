// ---------------------------------------------------------------------------
// Global Search Service — V2
// ---------------------------------------------------------------------------
// Searches across 15 document types using case-insensitive partial matching
// on document number fields and other searchable text columns.
// ---------------------------------------------------------------------------

import { prisma } from '../utils/prisma.js';

interface SearchResult {
  type: string;
  id: string;
  number: string;
  status: string;
  summary: string;
  createdAt: Date;
}

interface SearchFilters {
  types?: string[];
  limit?: number;
}

interface SearchDefinition {
  type: string;
  model: string;
  numberField: string | null;
  searchFields: string[];
  statusField: string;
}

const SEARCH_DEFINITIONS: SearchDefinition[] = [
  { type: 'grn', model: 'mrrv', numberField: 'mrrvNumber', searchFields: ['mrrvNumber'], statusField: 'status' },
  { type: 'mi', model: 'mirv', numberField: 'mirvNumber', searchFields: ['mirvNumber'], statusField: 'status' },
  { type: 'mrn', model: 'mrv', numberField: 'mrvNumber', searchFields: ['mrvNumber'], statusField: 'status' },
  {
    type: 'mr',
    model: 'materialRequisition',
    numberField: 'mrfNumber',
    searchFields: ['mrfNumber'],
    statusField: 'status',
  },
  { type: 'qci', model: 'rfim', numberField: 'rfimNumber', searchFields: ['rfimNumber'], statusField: 'status' },
  { type: 'dr', model: 'osdReport', numberField: 'osdNumber', searchFields: ['osdNumber'], statusField: 'status' },
  {
    type: 'jo',
    model: 'jobOrder',
    numberField: 'joNumber',
    searchFields: ['joNumber', 'description'],
    statusField: 'status',
  },
  {
    type: 'gate-pass',
    model: 'gatePass',
    numberField: 'gatePassNumber',
    searchFields: ['gatePassNumber'],
    statusField: 'status',
  },
  {
    type: 'shipment',
    model: 'shipment',
    numberField: 'shipmentNumber',
    searchFields: ['shipmentNumber', 'poNumber'],
    statusField: 'status',
  },
  { type: 'imsf', model: 'imsf', numberField: 'imsfNumber', searchFields: ['imsfNumber'], statusField: 'status' },
  {
    type: 'wt',
    model: 'stockTransfer',
    numberField: 'transferNumber',
    searchFields: ['transferNumber'],
    statusField: 'status',
  },
  {
    type: 'scrap',
    model: 'scrapItem',
    numberField: 'scrapNumber',
    searchFields: ['scrapNumber'],
    statusField: 'status',
  },
  {
    type: 'surplus',
    model: 'surplusItem',
    numberField: 'surplusNumber',
    searchFields: ['surplusNumber'],
    statusField: 'status',
  },
  { type: 'handover', model: 'storekeeperHandover', numberField: null, searchFields: [], statusField: 'status' },
  { type: 'tool-issue', model: 'toolIssue', numberField: null, searchFields: [], statusField: 'status' },
];

const TYPE_LABELS: Record<string, string> = {
  grn: 'GRN',
  mi: 'Material Issue',
  mrn: 'MRN',
  mr: 'Material Requisition',
  qci: 'QCI',
  dr: 'Discrepancy Report',
  jo: 'Job Order',
  'gate-pass': 'Gate Pass',
  shipment: 'Shipment',
  imsf: 'IMSF',
  wt: 'Warehouse Transfer',
  scrap: 'Scrap',
  surplus: 'Surplus',
  handover: 'Handover',
  'tool-issue': 'Tool Issue',
};

export async function globalSearch(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
  const maxPerType = 5;
  const totalLimit = filters?.limit || 50;

  const definitions = filters?.types?.length
    ? SEARCH_DEFINITIONS.filter(d => filters.types!.includes(d.type))
    : SEARCH_DEFINITIONS;

  // Skip types that have no searchable fields (handover, tool-issue) unless searching by UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

  const queries = definitions
    .filter(def => def.searchFields.length > 0 || isUuid)
    .map(async def => {
      const orConditions: Record<string, unknown>[] = [];

      for (const field of def.searchFields) {
        orConditions.push({ [field]: { contains: query, mode: 'insensitive' } });
      }

      if (isUuid) {
        orConditions.push({ id: query });
      }

      if (orConditions.length === 0) return [];

      const delegate = (prisma as Record<string, any>)[def.model];
      if (!delegate) return [];

      try {
        const records = await delegate.findMany({
          where: { OR: orConditions },
          take: maxPerType,
          orderBy: { createdAt: 'desc' },
        });

        return (records as Record<string, any>[]).map(
          (record): SearchResult => ({
            type: def.type,
            id: record.id,
            number: def.numberField ? (record[def.numberField] ?? record.id.slice(0, 8)) : record.id.slice(0, 8),
            status: record[def.statusField] ?? 'unknown',
            summary: `${TYPE_LABELS[def.type] ?? def.type} ${def.numberField ? record[def.numberField] : record.id.slice(0, 8)}`,
            createdAt: record.createdAt,
          }),
        );
      } catch {
        // Silently skip models that fail (e.g. table doesn't exist yet)
        return [];
      }
    });

  const resultArrays = await Promise.all(queries);
  const allResults = resultArrays.flat();

  // Sort by createdAt descending, then limit
  allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allResults.slice(0, totalLimit);
}
