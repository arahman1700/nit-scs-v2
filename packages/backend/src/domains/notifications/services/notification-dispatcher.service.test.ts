import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma, mockEventBus, mockSendPushToRole, mockLog, mockNotificationEvents } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock,
    mockEventBus: { on: vi.fn(), off: vi.fn() },
    mockSendPushToRole: vi.fn().mockResolvedValue(undefined),
    mockLog: vi.fn(),
    mockNotificationEvents: {
      MIRV_APPROVAL_NEEDED: 'mirv_approval',
      LOW_STOCK_ALERT: 'low_stock',
      SHIPMENT_STATUS_CHANGE: 'shipment_status',
      QC_INSPECTION_REQUIRED: 'qc_inspection',
      APPROVAL_SLA_EXCEEDED: 'approval_sla',
      UNAUTHORIZED_GATE_EXIT: 'unauthorized_exit',
      EQUIPMENT_RETURN_DUE: 'equipment_return',
      SHIPMENT_DELAYED: 'shipment_delayed',
      CYCLE_COUNT_SCHEDULED: 'cycle_count',
      RATE_CARD_EXPIRING: 'rate_card_expiry',
      VEHICLE_MAINTENANCE_DUE: 'vehicle_maintenance',
      NCR_DEADLINE_APPROACHING: 'ncr_deadline',
      CONTRACT_RENEWAL_DUE: 'contract_renewal',
      OVERDUE_TOOL_RETURN: 'overdue_tool',
    },
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: mockEventBus }));
vi.mock('./push-notification.service.js', () => ({ sendPushToRole: mockSendPushToRole }));
vi.mock('../../../config/logger.js', () => ({ log: mockLog }));
vi.mock('@nit-scs-v2/shared', () => ({ NOTIFICATION_EVENTS: mockNotificationEvents }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import {
  startNotificationDispatcher,
  stopNotificationDispatcher,
  checkEquipmentReturnDue,
  checkShipmentDelays,
  checkScheduledCycleCounts,
  checkRateCardExpiry,
  checkVehicleMaintenanceDue,
  checkNcrDeadlines,
  checkContractRenewals,
  checkOverdueToolReturns,
} from './notification-dispatcher.service.js';

describe('notification-dispatcher.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    mockSendPushToRole.mockClear();
    mockLog.mockClear();
    mockEventBus.on.mockClear();
  });

  // ---------------------------------------------------------------------------
  // startNotificationDispatcher / stopNotificationDispatcher
  // ---------------------------------------------------------------------------
  describe('startNotificationDispatcher', () => {
    it('should register event listeners on first call', () => {
      // Reset internal state by calling stop first
      stopNotificationDispatcher();

      startNotificationDispatcher();

      // Should register document:status_changed, inventory:low_stock, sla:breached, *
      expect(mockEventBus.on).toHaveBeenCalledWith('document:status_changed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('inventory:low_stock', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('sla:breached', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('*', expect.any(Function));
    });

    it('should not register listeners if already started', () => {
      // Call twice
      stopNotificationDispatcher();
      startNotificationDispatcher();
      const firstCallCount = mockEventBus.on.mock.calls.length;
      startNotificationDispatcher();

      expect(mockEventBus.on.mock.calls.length).toBe(firstCallCount);
    });
  });

  // ---------------------------------------------------------------------------
  // checkEquipmentReturnDue (N-03)
  // ---------------------------------------------------------------------------
  describe('checkEquipmentReturnDue', () => {
    it('should skip when no contracts are due soon', async () => {
      mockPrisma.rentalContract.findMany.mockResolvedValue([]);

      await checkEquipmentReturnDue();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify logistics_coordinator when contracts are due', async () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      mockPrisma.rentalContract.findMany.mockResolvedValue([
        { id: 'rc-1', contractNumber: 'RC-001', endDate: futureDate },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null); // no recent notification
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkEquipmentReturnDue();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientId: 'emp-1',
            title: 'Equipment Return Due',
            notificationType: 'equipment_return',
          }),
        ]),
      });
    });

    it('should skip contracts with recent notifications', async () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      mockPrisma.rentalContract.findMany.mockResolvedValue([
        { id: 'rc-1', contractNumber: 'RC-001', endDate: futureDate },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing' }); // recent exists

      await checkEquipmentReturnDue();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should skip when no recipients found', async () => {
      mockPrisma.rentalContract.findMany.mockResolvedValue([
        { id: 'rc-1', contractNumber: 'RC-001', endDate: new Date(Date.now() + 86400000) },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([]); // no employees

      await checkEquipmentReturnDue();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should handle errors without throwing', async () => {
      mockPrisma.rentalContract.findMany.mockRejectedValue(new Error('DB error'));

      await expect(checkEquipmentReturnDue()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // checkShipmentDelays (N-05)
  // ---------------------------------------------------------------------------
  describe('checkShipmentDelays', () => {
    it('should skip when no delayed shipments found', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);

      await checkShipmentDelays();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify manager and logistics_coordinator for delayed shipments', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockPrisma.shipment.findMany.mockResolvedValue([{ id: 'sh-1', shipmentNumber: 'SH-001', etaPort: pastDate }]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'mgr-1' }, { id: 'lc-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      await checkShipmentDelays();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            notificationType: 'shipment_delayed',
            referenceTable: 'shipment',
          }),
        ]),
      });
    });

    it('should handle errors without throwing', async () => {
      mockPrisma.shipment.findMany.mockRejectedValue(new Error('timeout'));

      await expect(checkShipmentDelays()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // checkScheduledCycleCounts (N-08)
  // ---------------------------------------------------------------------------
  describe('checkScheduledCycleCounts', () => {
    it('should skip when no upcoming cycle counts', async () => {
      (mockPrisma as any).cycleCount = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      await checkScheduledCycleCounts();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify inventory_specialist and warehouse_staff', async () => {
      const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000);
      (mockPrisma as any).cycleCount = {
        findMany: vi.fn().mockResolvedValue([{ id: 'cc-1', countNumber: 'CC-001', scheduledDate: tomorrow }]),
      };
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'inv-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkScheduledCycleCounts();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            notificationType: 'cycle_count',
          }),
        ]),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // checkRateCardExpiry (N-09)
  // ---------------------------------------------------------------------------
  describe('checkRateCardExpiry', () => {
    it('should skip when no expiring rate cards', async () => {
      (mockPrisma as any).supplierEquipmentRate = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      await checkRateCardExpiry();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify finance_user and manager about expiring rate cards', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      (mockPrisma as any).supplierEquipmentRate = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'rc-1',
            validUntil: futureDate,
            supplier: { supplierName: 'Acme' },
            equipmentType: { typeName: 'Crane' },
          },
        ]),
      };
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'fin-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkRateCardExpiry();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            notificationType: 'rate_card_expiry',
            title: 'Rate Card Expiring',
          }),
        ]),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // checkVehicleMaintenanceDue (N-10)
  // ---------------------------------------------------------------------------
  describe('checkVehicleMaintenanceDue', () => {
    it('should skip when no maintenance is due', async () => {
      mockPrisma.generatorMaintenance.findMany.mockResolvedValue([]);

      await checkVehicleMaintenanceDue();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify transport_supervisor for overdue maintenance', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.generatorMaintenance.findMany.mockResolvedValue([
        {
          id: 'gm-1',
          maintenanceType: 'Oil Change',
          scheduledDate: pastDate,
          status: 'overdue',
          generator: { generatorName: 'Gen-001' },
        },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'ts-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkVehicleMaintenanceDue();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Vehicle Maintenance Overdue',
            notificationType: 'vehicle_maintenance',
          }),
        ]),
      });
    });

    it('should use "due" title for scheduled maintenance', async () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      mockPrisma.generatorMaintenance.findMany.mockResolvedValue([
        {
          id: 'gm-2',
          maintenanceType: 'Inspection',
          scheduledDate: futureDate,
          status: 'scheduled',
          generator: { generatorName: 'Gen-002' },
        },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'ts-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkVehicleMaintenanceDue();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Vehicle Maintenance Due',
          }),
        ]),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // checkNcrDeadlines (N-12)
  // ---------------------------------------------------------------------------
  describe('checkNcrDeadlines', () => {
    it('should skip when no approaching DR deadlines', async () => {
      mockPrisma.osdReport.findMany.mockResolvedValue([]);

      await checkNcrDeadlines();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify qc_officer about approaching NCR deadlines', async () => {
      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      mockPrisma.osdReport.findMany.mockResolvedValue([{ id: 'osd-1', osdNumber: 'DR-001', createdAt: oldDate }]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'qc-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkNcrDeadlines();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'NCR Deadline Approaching',
            notificationType: 'ncr_deadline',
          }),
        ]),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // checkContractRenewals (N-13)
  // ---------------------------------------------------------------------------
  describe('checkContractRenewals', () => {
    it('should skip when no contracts expiring', async () => {
      mockPrisma.rentalContract.findMany.mockResolvedValue([]);

      await checkContractRenewals();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify manager and finance_user about contract renewals', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      mockPrisma.rentalContract.findMany.mockResolvedValue([
        { id: 'rc-1', contractNumber: 'RC-001', endDate: futureDate },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'mgr-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      await checkContractRenewals();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Contract Renewal Due',
            notificationType: 'contract_renewal',
          }),
        ]),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // checkOverdueToolReturns (N-14)
  // ---------------------------------------------------------------------------
  describe('checkOverdueToolReturns', () => {
    it('should skip when no overdue tools', async () => {
      mockPrisma.toolIssue.findMany.mockResolvedValue([]);

      await checkOverdueToolReturns();

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should notify warehouse_supervisor about overdue tools', async () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      mockPrisma.toolIssue.findMany.mockResolvedValue([
        {
          id: 'ti-1',
          expectedReturnDate: pastDate,
          tool: { toolName: 'Drill', toolCode: 'T-001' },
        },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'ws-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.toolIssue.updateMany.mockResolvedValue({ count: 1 });

      await checkOverdueToolReturns();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Overdue Tool Return',
            notificationType: 'overdue_tool',
          }),
        ]),
      });
    });

    it('should update issued tools to overdue status', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.toolIssue.findMany.mockResolvedValue([
        {
          id: 'ti-1',
          expectedReturnDate: pastDate,
          tool: { toolName: 'Saw', toolCode: 'T-002' },
        },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'ws-1' }]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.toolIssue.updateMany.mockResolvedValue({ count: 1 });

      await checkOverdueToolReturns();

      expect(mockPrisma.toolIssue.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'issued',
          expectedReturnDate: { lt: expect.any(Date) },
        },
        data: { status: 'overdue' },
      });
    });

    it('should handle errors without throwing', async () => {
      mockPrisma.toolIssue.findMany.mockRejectedValue(new Error('DB error'));

      await expect(checkOverdueToolReturns()).resolves.toBeUndefined();
    });
  });
});
