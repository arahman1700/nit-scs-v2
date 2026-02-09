import type { ApprovalAction } from './enums.js';

export interface ApprovalLevel {
  level: number;
  label: string;
  roleName: string;
  minAmount: number;
  maxAmount: number;
  slaHours: number;
}

export interface ApprovalStep {
  id: string;
  level: number;
  label: string;
  approverId?: string;
  approverName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'current';
  action?: ApprovalAction;
  comments?: string;
  timestamp?: string;
  slaDeadline?: string;
  slaStatus?: 'on_track' | 'at_risk' | 'overdue';
}

export interface ApprovalChain {
  documentId: string;
  documentType: string;
  currentLevel: number;
  totalLevels: number;
  steps: ApprovalStep[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
