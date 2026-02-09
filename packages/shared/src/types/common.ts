// ── Auth ─────────────────────────────────────────────────────────────────
import type { UserRole } from './enums.js';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  warehouseId?: string;
  department?: string;
}

// ── API / Table ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  success: boolean;
  message?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TableFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  warehouse?: string;
  project?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  format?: (value: unknown, row?: unknown) => string;
  hidden?: boolean;
}

export interface TableConfig {
  title: string;
  code: string;
  columns: ColumnConfig[];
  formLink?: string;
  canCreate?: boolean;
  canExport?: boolean;
}

export interface FormField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'date'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'file'
    | 'email'
    | 'tel'
    | 'time'
    | 'readonly';
  required?: boolean;
  options?: string[];
  defaultValue?: unknown;
  readOnly?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  colSpan?: number;
  helpText?: string;
}

export interface FormSection {
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormConfig {
  title: string;
  titleEn: string;
  code: string;
  subtitle: string;
  sections: FormSection[];
  hasLineItems?: boolean;
  hasApproval?: boolean;
  statusFlow?: string[];
}

// ── API Request/Response ─────────────────────────────────────────────────

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: unknown;
}

// ── Status Tracking ──────────────────────────────────────────────────────

export interface StatusHistoryEntry {
  id: string;
  status: string;
  timestamp: string;
  userId: string;
  userName: string;
  notes?: string;
  action?: string;
}
