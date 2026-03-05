// ── Visitor Pass (SOW M5-F03) ───────────────────────────────────────────

export interface VisitorPass {
  id: string;
  passNumber: string;
  visitorName: string;
  visitorCompany?: string;
  visitorIdNumber: string;
  visitorPhone?: string;
  visitorEmail?: string;
  hostEmployeeId: string;
  warehouseId: string;
  purpose: string;
  visitDate: string;
  expectedDuration: number;
  checkInTime?: string;
  checkOutTime?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  badgeNumber?: string;
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'overstay' | 'cancelled';
  registeredById: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  hostEmployee?: { id: string; fullName: string; email?: string; phone?: string; department?: string };
  warehouse?: { id: string; warehouseName: string; warehouseCode?: string; address?: string };
  registeredBy?: { id: string; fullName: string; email?: string };
}
