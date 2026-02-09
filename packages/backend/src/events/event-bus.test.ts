vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { eventBus, type SystemEvent } from './event-bus.js';

beforeEach(() => {
  eventBus.removeAllListeners();
});

describe('eventBus', () => {
  it('is a singleton (same reference on re-import)', async () => {
    // eventBus is exported as a module-level singleton
    const { eventBus: bus2 } = await import('./event-bus.js');
    expect(bus2).toBe(eventBus);
  });

  it('publish emits event type-specific listener', () => {
    const listener = vi.fn();
    eventBus.on('document:created', listener);

    const event: SystemEvent = {
      type: 'document:created',
      entityType: 'mrrv',
      entityId: 'mrrv-1',
      action: 'create',
      payload: { status: 'draft' },
      performedById: 'user-1',
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('publish also emits wildcard "*" listener', () => {
    const wildcardListener = vi.fn();
    eventBus.on('*', wildcardListener);

    const event: SystemEvent = {
      type: 'inventory:updated',
      entityType: 'inventory',
      entityId: 'inv-1',
      action: 'update',
      payload: { quantity: 100 },
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(event);

    expect(wildcardListener).toHaveBeenCalledOnce();
    expect(wildcardListener).toHaveBeenCalledWith(event);
  });

  it('both type-specific and wildcard listeners are called', () => {
    const specificListener = vi.fn();
    const wildcardListener = vi.fn();

    eventBus.on('document:approved', specificListener);
    eventBus.on('*', wildcardListener);

    const event: SystemEvent = {
      type: 'document:approved',
      entityType: 'mirv',
      entityId: 'mirv-5',
      action: 'approve',
      payload: { level: 1 },
      performedById: 'approver-1',
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(event);

    expect(specificListener).toHaveBeenCalledOnce();
    expect(wildcardListener).toHaveBeenCalledOnce();
  });

  it('multiple listeners on same event type all get called', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    eventBus.on('stock:transferred', listener1);
    eventBus.on('stock:transferred', listener2);
    eventBus.on('stock:transferred', listener3);

    const event: SystemEvent = {
      type: 'stock:transferred',
      entityType: 'stock-transfer',
      entityId: 'st-1',
      action: 'create',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(event);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener3).toHaveBeenCalledOnce();
  });

  it('listeners for unrelated event types are not called', () => {
    const unrelatedListener = vi.fn();
    eventBus.on('something:else', unrelatedListener);

    const event: SystemEvent = {
      type: 'document:created',
      entityType: 'mrrv',
      entityId: 'mrrv-1',
      action: 'create',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(event);

    expect(unrelatedListener).not.toHaveBeenCalled();
  });

  it('SystemEvent has correct required fields', () => {
    const event: SystemEvent = {
      type: 'test:event',
      entityType: 'test',
      entityId: 'test-1',
      action: 'create',
      payload: { key: 'value' },
      performedById: 'user-1',
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    // Verify the shape — TypeScript ensures compile-time correctness,
    // but we verify runtime values too
    expect(event.type).toBe('test:event');
    expect(event.entityType).toBe('test');
    expect(event.entityId).toBe('test-1');
    expect(event.action).toBe('create');
    expect(event.payload).toEqual({ key: 'value' });
    expect(event.performedById).toBe('user-1');
    expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });

  it('SystemEvent performedById is optional', () => {
    const event: SystemEvent = {
      type: 'system:generated',
      entityType: 'system',
      entityId: 'sys-1',
      action: 'auto',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    expect(event.performedById).toBeUndefined();
  });
});
