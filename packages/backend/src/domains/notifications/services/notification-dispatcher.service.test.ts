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

  // ---------------------------------------------------------------------------
  // workflow notification triggers (N-01, N-06, N-02, duplicate suppression)
  // ---------------------------------------------------------------------------
  describe('workflow notification triggers', () => {
    /**
     * Start the dispatcher, capture the registered event handlers,
     * then call them directly with mock events to test notification creation.
     *
     * The handlers registered on eventBus.on are fire-and-forget wrappers:
     *   (event) => { handleXxx(event).catch(...) }
     * So we need to flush microtasks after calling them.
     */
    function getRegisteredHandler(eventType: string): ((event: unknown) => void) | undefined {
      const calls = mockEventBus.on.mock.calls;
      for (const call of calls) {
        if (call[0] === eventType) {
          return call[1] as (event: unknown) => void;
        }
      }
      return undefined;
    }

    /** Flush pending microtasks so fire-and-forget async handlers complete */
    async function flushPromises(): Promise<void> {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    beforeEach(() => {
      stopNotificationDispatcher();
      mockEventBus.on.mockClear();
      startNotificationDispatcher();
    });

    it('N-01: MI submitted (mirv pending_approval) creates notifications for approver roles', async () => {
      const handler = getRegisteredHandler('document:status_changed');
      expect(handler).toBeDefined();

      // Mock employees with approver roles
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'mgr-1' }, { id: 'sup-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const event = {
        type: 'document:status_changed',
        entityType: 'mirv',
        entityId: 'mi-001',
        action: 'status_change',
        payload: { to: 'pending_approval', documentNumber: 'MI-2026-001' },
        performedById: 'user-1',
        timestamp: new Date().toISOString(),
      };

      handler!(event);
      await flushPromises();

      // Should create notifications for approver role users
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: { in: ['warehouse_supervisor', 'manager'] },
            isActive: true,
          }),
        }),
      );
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientId: 'mgr-1',
            title: 'MI Requires Approval',
            notificationType: 'mirv_approval',
            referenceTable: 'mirv',
            referenceId: 'mi-001',
          }),
        ]),
      });
    });

    it('N-06: GRN (mrrv) pending_qc creates QC inspection notifications for qc_officer', async () => {
      const handler = getRegisteredHandler('document:status_changed');
      expect(handler).toBeDefined();

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'qc-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const event = {
        type: 'document:status_changed',
        entityType: 'mrrv',
        entityId: 'grn-001',
        action: 'status_change',
        payload: { to: 'pending_qc', documentNumber: 'GRN-2026-001' },
        performedById: 'user-1',
        timestamp: new Date().toISOString(),
      };

      handler!(event);
      await flushPromises();

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: { in: ['qc_officer'] },
            isActive: true,
          }),
        }),
      );
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientId: 'qc-1',
            title: 'QC Inspection Required',
            notificationType: 'qc_inspection',
            referenceTable: 'mrrv',
            referenceId: 'grn-001',
          }),
        ]),
      });
    });

    it('N-02: inventory:low_stock creates notifications for warehouse_supervisor', async () => {
      const handler = getRegisteredHandler('inventory:low_stock');
      expect(handler).toBeDefined();

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'ws-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const event = {
        type: 'inventory:low_stock',
        entityType: 'item',
        entityId: 'item-001',
        action: 'low_stock',
        payload: { title: 'Low Stock: Cement', body: 'Cement bags below minimum level' },
        performedById: 'system',
        timestamp: new Date().toISOString(),
      };

      handler!(event);
      await flushPromises();

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: { in: ['warehouse_supervisor'] },
            isActive: true,
          }),
        }),
      );
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientId: 'ws-1',
            notificationType: 'low_stock_sow',
          }),
        ]),
      });
    });

    it('duplicate suppression: hasRecentNotification prevents duplicate notification', async () => {
      // This tests the scheduler-based checkEquipmentReturnDue
      // which has explicit duplicate suppression via hasRecentNotification
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      mockPrisma.rentalContract.findMany.mockResolvedValue([
        { id: 'rc-1', contractNumber: 'RC-001', endDate: futureDate },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);

      // Return an existing recent notification (duplicate suppression)
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing-notif' });

      await checkEquipmentReturnDue();

      // createMany should NOT be called because recent notification exists
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('notifyRecipients creates batch notifications for all recipient IDs', async () => {
      // Test via N-02 handler which calls notifyRecipients internally
      const handler = getRegisteredHandler('inventory:low_stock');

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      handler!({
        type: 'inventory:low_stock',
        entityType: 'item',
        entityId: 'item-002',
        action: 'low_stock',
        payload: { title: 'Low Stock Alert', body: 'Stock below minimum' },
        timestamp: new Date().toISOString(),
      });
      await flushPromises();

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ recipientId: 'r1' }),
          expect.objectContaining({ recipientId: 'r2' }),
          expect.objectContaining({ recipientId: 'r3' }),
        ]),
      });
      // Should have exactly 3 items in the data array
      const createManyCall = mockPrisma.notification.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(3);
    });
  });
});
