/**
 * Data Transfer Objects (DTOs) inferred from Zod schemas.
 * Single source of truth: Zod schemas define shape AND validation,
 * these types are used in service function signatures for type safety.
 */
import type { z } from 'zod';

// ── Document schemas ────────────────────────────────────────────────────
import type {
  mrrvCreateSchema,
  mrrvUpdateSchema,
  mirvCreateSchema,
  mirvUpdateSchema,
  mrvCreateSchema,
  mrvUpdateSchema,
  rfimUpdateSchema,
  osdCreateSchema,
  osdUpdateSchema,
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
// Document DTOs
// ═══════════════════════════════════════════════════════════════════════

// MRRV
export type MrrvCreateDto = z.infer<typeof mrrvCreateSchema>;
export type MrrvUpdateDto = z.infer<typeof mrrvUpdateSchema>;
export type MrrvLineDto = MrrvCreateDto['lines'][number];

// MIRV
export type MirvCreateDto = z.infer<typeof mirvCreateSchema>;
export type MirvUpdateDto = z.infer<typeof mirvUpdateSchema>;
export type MirvLineDto = MirvCreateDto['lines'][number];

// MRV
export type MrvCreateDto = z.infer<typeof mrvCreateSchema>;
export type MrvUpdateDto = z.infer<typeof mrvUpdateSchema>;
export type MrvLineDto = MrvCreateDto['lines'][number];

// RFIM
export type RfimUpdateDto = z.infer<typeof rfimUpdateSchema>;

// OSD
export type OsdCreateDto = z.infer<typeof osdCreateSchema>;
export type OsdUpdateDto = z.infer<typeof osdUpdateSchema>;
export type OsdLineDto = OsdCreateDto['lines'][number];

// Approval
export type ApprovalActionDto = z.infer<typeof approvalActionSchema>;

// ═══════════════════════════════════════════════════════════════════════
// Logistics DTOs
// ═══════════════════════════════════════════════════════════════════════

// Gate Pass
export type GatePassCreateDto = z.infer<typeof gatePassCreateSchema>;
export type GatePassUpdateDto = z.infer<typeof gatePassUpdateSchema>;
export type GatePassItemDto = GatePassCreateDto['items'][number];

// MRF
export type MrfCreateDto = z.infer<typeof mrfCreateSchema>;
export type MrfUpdateDto = z.infer<typeof mrfUpdateSchema>;
export type MrfLineDto = MrfCreateDto['lines'][number];

// Stock Transfer
export type StockTransferCreateDto = z.infer<typeof stockTransferCreateSchema>;
export type StockTransferUpdateDto = z.infer<typeof stockTransferUpdateSchema>;
export type StockTransferLineDto = StockTransferCreateDto['lines'][number];

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
