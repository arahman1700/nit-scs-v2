/**
 * Data Transfer Objects (DTOs) inferred from Zod schemas.
 * Single source of truth: Zod schemas define shape AND validation,
 * these types are used in service function signatures for type safety.
 *
 * V2 naming convention: GRN, QCI, DR, MI, MRN, MR, WT
 * V1 aliases kept for backward compatibility during migration.
 */
import type { z } from 'zod';

// ── Document schemas (V2 names) ──────────────────────────────────────────
import type {
  grnCreateSchema,
  grnUpdateSchema,
  miCreateSchema,
  miUpdateSchema,
  mrnCreateSchema,
  mrnUpdateSchema,
  qciUpdateSchema,
  drCreateSchema,
  drUpdateSchema,
  imsfCreateSchema,
  imsfUpdateSchema,
  surplusCreateSchema,
  surplusUpdateSchema,
  scrapCreateSchema,
  scrapUpdateSchema,
  sscBidCreateSchema,
  sscBidUpdateSchema,
  rentalContractCreateSchema,
  rentalContractUpdateSchema,
  toolCreateSchema,
  toolUpdateSchema,
  toolIssueCreateSchema,
  toolIssueReturnSchema,
  generatorFuelLogCreateSchema,
  generatorMaintenanceCreateSchema,
  generatorMaintenanceUpdateSchema,
  warehouseZoneCreateSchema,
  warehouseZoneUpdateSchema,
  approvalActionSchema,
} from '../schemas/document.schema.js';

// ── Logistics schemas ───────────────────────────────────────────────────
import type {
  gatePassCreateSchema,
  gatePassUpdateSchema,
  mrfCreateSchema,
  mrfUpdateSchema,
  stockTransferCreateSchema,
  stockTransferUpdateSchema,
  shipmentCreateSchema,
  shipmentUpdateSchema,
  shipmentStatusSchema,
  customsStageSchema,
} from '../schemas/logistics.schema.js';

// ── Job order schemas ───────────────────────────────────────────────────
import type { joCreateSchema, joUpdateSchema, joApprovalSchema, joPaymentSchema } from '../schemas/job-order.schema.js';

// ── Auth schemas ────────────────────────────────────────────────────────
import type {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';

// ═══════════════════════════════════════════════════════════════════════
// Document DTOs — V2 Names
// ═══════════════════════════════════════════════════════════════════════

// GRN (was MRRV)
export type GrnCreateDto = z.infer<typeof grnCreateSchema>;
export type GrnUpdateDto = z.infer<typeof grnUpdateSchema>;
export type GrnLineDto = GrnCreateDto['lines'][number];

// MI (was MIRV)
export type MiCreateDto = z.infer<typeof miCreateSchema>;
export type MiUpdateDto = z.infer<typeof miUpdateSchema>;
export type MiLineDto = MiCreateDto['lines'][number];

// MRN (was MRV)
export type MrnCreateDto = z.infer<typeof mrnCreateSchema>;
export type MrnUpdateDto = z.infer<typeof mrnUpdateSchema>;
export type MrnLineDto = MrnCreateDto['lines'][number];

// QCI (was RFIM)
export type QciUpdateDto = z.infer<typeof qciUpdateSchema>;

// DR (was OSD)
export type DrCreateDto = z.infer<typeof drCreateSchema>;
export type DrUpdateDto = z.infer<typeof drUpdateSchema>;
export type DrLineDto = DrCreateDto['lines'][number];

// Approval
export type ApprovalActionDto = z.infer<typeof approvalActionSchema>;

// ═══════════════════════════════════════════════════════════════════════
// V1 Compatibility Aliases — will be removed in future
// ═══════════════════════════════════════════════════════════════════════

/** @deprecated Use GrnCreateDto */
export type MrrvCreateDto = GrnCreateDto;
/** @deprecated Use GrnUpdateDto */
export type MrrvUpdateDto = GrnUpdateDto;
/** @deprecated Use GrnLineDto */
export type MrrvLineDto = GrnLineDto;

/** @deprecated Use MiCreateDto */
export type MirvCreateDto = MiCreateDto;
/** @deprecated Use MiUpdateDto */
export type MirvUpdateDto = MiUpdateDto;
/** @deprecated Use MiLineDto */
export type MirvLineDto = MiLineDto;

/** @deprecated Use MrnCreateDto */
export type MrvCreateDto = MrnCreateDto;
/** @deprecated Use MrnUpdateDto */
export type MrvUpdateDto = MrnUpdateDto;
/** @deprecated Use MrnLineDto */
export type MrvLineDto = MrnLineDto;

/** @deprecated Use QciUpdateDto */
export type RfimUpdateDto = QciUpdateDto;

/** @deprecated Use DrCreateDto */
export type OsdCreateDto = DrCreateDto;
/** @deprecated Use DrUpdateDto */
export type OsdUpdateDto = DrUpdateDto;
/** @deprecated Use DrLineDto */
export type OsdLineDto = DrLineDto;

// ═══════════════════════════════════════════════════════════════════════
// New V2 Module DTOs
// ═══════════════════════════════════════════════════════════════════════

// IMSF (Internal Material Shifting Form)
export type ImsfCreateDto = z.infer<typeof imsfCreateSchema>;
export type ImsfUpdateDto = z.infer<typeof imsfUpdateSchema>;
export type ImsfLineDto = ImsfCreateDto['lines'][number];

// Surplus
export type SurplusCreateDto = z.infer<typeof surplusCreateSchema>;
export type SurplusUpdateDto = z.infer<typeof surplusUpdateSchema>;

// Scrap
export type ScrapCreateDto = z.infer<typeof scrapCreateSchema>;
export type ScrapUpdateDto = z.infer<typeof scrapUpdateSchema>;

// SSC Bid
export type SscBidCreateDto = z.infer<typeof sscBidCreateSchema>;
export type SscBidUpdateDto = z.infer<typeof sscBidUpdateSchema>;

// Rental Contract
export type RentalContractCreateDto = z.infer<typeof rentalContractCreateSchema>;
export type RentalContractUpdateDto = z.infer<typeof rentalContractUpdateSchema>;
export type RentalContractLineDto = RentalContractCreateDto['lines'][number];

// Tool
export type ToolCreateDto = z.infer<typeof toolCreateSchema>;
export type ToolUpdateDto = z.infer<typeof toolUpdateSchema>;

// Tool Issue
export type ToolIssueCreateDto = z.infer<typeof toolIssueCreateSchema>;
export type ToolIssueReturnDto = z.infer<typeof toolIssueReturnSchema>;

// Generator Fuel Log
export type GeneratorFuelLogCreateDto = z.infer<typeof generatorFuelLogCreateSchema>;

// Generator Maintenance
export type GeneratorMaintenanceCreateDto = z.infer<typeof generatorMaintenanceCreateSchema>;
export type GeneratorMaintenanceUpdateDto = z.infer<typeof generatorMaintenanceUpdateSchema>;

// Warehouse Zone
export type WarehouseZoneCreateDto = z.infer<typeof warehouseZoneCreateSchema>;
export type WarehouseZoneUpdateDto = z.infer<typeof warehouseZoneUpdateSchema>;

// ═══════════════════════════════════════════════════════════════════════
// Logistics DTOs
// ═══════════════════════════════════════════════════════════════════════

// Gate Pass
export type GatePassCreateDto = z.infer<typeof gatePassCreateSchema>;
export type GatePassUpdateDto = z.infer<typeof gatePassUpdateSchema>;
export type GatePassItemDto = GatePassCreateDto['items'][number];

// MR (was MRF) — V2 alias
export type MrCreateDto = z.infer<typeof mrfCreateSchema>;
export type MrUpdateDto = z.infer<typeof mrfUpdateSchema>;
export type MrLineDto = MrCreateDto['lines'][number];

/** @deprecated Use MrCreateDto */
export type MrfCreateDto = MrCreateDto;
/** @deprecated Use MrUpdateDto */
export type MrfUpdateDto = MrUpdateDto;
/** @deprecated Use MrLineDto */
export type MrfLineDto = MrLineDto;

// WT (was StockTransfer) — V2 alias
export type WtCreateDto = z.infer<typeof stockTransferCreateSchema>;
export type WtUpdateDto = z.infer<typeof stockTransferUpdateSchema>;
export type WtLineDto = WtCreateDto['lines'][number];

/** @deprecated Use WtCreateDto */
export type StockTransferCreateDto = WtCreateDto;
/** @deprecated Use WtUpdateDto */
export type StockTransferUpdateDto = WtUpdateDto;
/** @deprecated Use WtLineDto */
export type StockTransferLineDto = WtLineDto;

// Shipment
export type ShipmentCreateDto = z.infer<typeof shipmentCreateSchema>;
export type ShipmentUpdateDto = z.infer<typeof shipmentUpdateSchema>;
export type ShipmentStatusDto = z.infer<typeof shipmentStatusSchema>;
export type CustomsStageDto = z.infer<typeof customsStageSchema>;

// ═══════════════════════════════════════════════════════════════════════
// Job Order DTOs
// ═══════════════════════════════════════════════════════════════════════

export type JoCreateDto = z.infer<typeof joCreateSchema>;
export type JoUpdateDto = z.infer<typeof joUpdateSchema>;
export type JoApprovalDto = z.infer<typeof joApprovalSchema>;
export type JoPaymentDto = z.infer<typeof joPaymentSchema>;

// ═══════════════════════════════════════════════════════════════════════
// Auth DTOs
// ═══════════════════════════════════════════════════════════════════════

export type LoginDto = z.infer<typeof loginSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

// ═══════════════════════════════════════════════════════════════════════
// Common Service Parameter Types
// ═══════════════════════════════════════════════════════════════════════

/** Standard pagination + search + sort params passed to list() functions */
export interface ListParams {
  skip: number;
  pageSize: number;
  sortBy: string;
  sortDir: string;
  search?: string;
  status?: string;
  /** Index signature for row-level security scope filters and extra query params */
  [key: string]: unknown;
}

/** Standard paginated response from list() functions */
export interface ListResult<T> {
  data: T[];
  total: number;
}
