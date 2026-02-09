import type { UserRole } from './enums.js';
import type { FormField, ColumnConfig } from './common.js';

// ── Notifications ────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'approval_request' | 'approval_result' | 'sla_warning' | 'sla_breach' | 'stock_alert' | 'status_change' | 'system';
  title: string;
  message: string;
  documentId?: string;
  documentType?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ── Audit Log ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'export' | 'status_change';
  entityType: string;
  entityId: string;
  entityName?: string;
  changes?: { field: string; oldValue: unknown; newValue: unknown }[];
  ipAddress?: string;
}

// ── Master Data ──────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  client: string;
  manager: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  region?: string;
  budget?: number;
  budgetUsed?: number;
  startDate?: string;
  endDate?: string;
  contractValue?: number;
  completionPct?: number;
}

export interface Supplier {
  id: string;
  name: string;
  city: string;
  type: string;
  status: 'Active' | 'Inactive' | 'Blacklisted';
  crNumber?: string;
  vatNumber?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;
  rating?: number;
}

export interface Employee {
  id: string;
  name: string;
  employeeId?: string;
  department: string;
  title: string;
  site: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  warehouseId?: string;
  status?: 'Active' | 'Inactive';
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  type?: string;
  projectId?: string;
  lat?: number;
  lng?: number;
  manager?: string;
  capacity?: number;
  usedCapacity?: number;
  status?: 'Active' | 'Inactive';
}

export interface Generator {
  id: string;
  assetId: string;
  capacityKva: number;
  manufacturer: string;
  model?: string;
  projectId?: string;
  projectName?: string;
  warehouseId?: string;
  status: 'Active' | 'Maintenance' | 'Idle' | 'Decommissioned';
  lastMaintenance?: string;
  nextMaintenance?: string;
  totalRunHours?: number;
  fuelConsumption?: number;
}

export interface EquipmentFleet {
  id: string;
  plateNumber: string;
  type: string;
  category: 'Vehicle' | 'Heavy Equipment' | 'Generator' | 'Tool';
  projectId?: string;
  projectName?: string;
  status: 'Active' | 'Maintenance' | 'Available' | 'Decommissioned';
  driver?: string;
  currentJob?: string;
  lastMileage?: number;
  insuranceExpiry?: string;
}

export interface SupplierRate {
  id: string;
  supplierId: string;
  supplierName: string;
  serviceType: string;
  equipmentType?: string;
  dailyRate?: number;
  monthlyRate?: number;
  tripRate?: number;
  currency: string;
  validFrom: string;
  validTo: string;
  status: 'Active' | 'Expired';
}

// ── UI / Dashboard ───────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  time: string;
  action: string;
  user: string;
  details: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

export interface StatMetric {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
}

export interface NavItem {
  label: string;
  path?: string;
  children?: NavItem[];
  type?: 'link' | 'dropdown' | 'divider';
  badge?: number;
}

// ── Reports & SLA ────────────────────────────────────────────────────────

export interface ReportConfig {
  id: string;
  title: string;
  description: string;
  category: 'inventory' | 'job_orders' | 'sla' | 'financial';
  filters: FormField[];
}

export interface ReportData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  summary?: { label: string; value: string | number }[];
}

export interface SLAConfig {
  documentType: string;
  levels: {
    level: number;
    slaHours: number;
    atRiskHours: number;
  }[];
}

export interface SLAMetrics {
  total: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  compliancePct: number;
  avgResolutionHours: number;
}

// ── Settings ─────────────────────────────────────────────────────────────

export interface SystemSettings {
  vatRate: number;
  currency: string;
  timezone: string;
  dateFormat: string;
  overDeliveryTolerance: number;
  backdateLimit: number;
  autoNumberPrefix: Record<string, string>;
}

export interface EntityConfig {
  name: string;
  namePlural: string;
  fields: FormField[];
  listColumns: ColumnConfig[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ── Tasks ───────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  assigneeId?: string;
  assignee?: { id: string; fullName: string; email: string };
  creatorId: string;
  creator?: { id: string; fullName: string; email: string };
  projectId?: string;
  project?: { id: string; projectName: string; projectCode: string };
  tags: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  comments?: TaskComment[];
  _count?: { comments: number };
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  author?: { id: string; fullName: string };
  body: string;
  createdAt: string;
}

// ── Company Documents ───────────────────────────────────────────────────

export interface CompanyDocument {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  category: 'policy' | 'procedure' | 'contract' | 'certificate' | 'template' | 'sop' | 'other';
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  version: number;
  tags: string[];
  uploadedById: string;
  uploadedBy?: { id: string; fullName: string };
  visibility: 'all' | 'admin_only' | 'management';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
