import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './client';

/**
 * Listens for Socket.IO events from the backend and invalidates
 * the corresponding React Query caches so data stays fresh in real-time.
 *
 * Mount this once near the app root (e.g., in the Layout component).
 *
 * Also handles reconnection: re-joins any previously joined document rooms
 * when the socket reconnects after a disconnect.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  /** Tracks the current document room so we can re-join on reconnect */
  const currentRoomRef = useRef<string | null>(null);

  const handleDocumentStatus = useCallback(
    (payload: { documentType: string; documentId: string; status: string }) => {
      const { documentType, documentId } = payload;
      // Invalidate the specific document and its list queries
      queryClient.invalidateQueries({ queryKey: [documentType, documentId] });
      queryClient.invalidateQueries({ queryKey: [documentType, { type: 'list' }], exact: false });
      // Dashboards showing this document type need a refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    [queryClient],
  );

  const handleApproval = useCallback(
    (payload: { documentType: string; documentId?: string }) => {
      if (payload.documentId) {
        queryClient.invalidateQueries({ queryKey: [payload.documentType, payload.documentId] });
      }
      queryClient.invalidateQueries({ queryKey: [payload.documentType, { type: 'list' }], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    [queryClient],
  );

  const handleNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const handleInventoryUpdate = useCallback(
    (payload?: { warehouseId?: string; itemCode?: string }) => {
      if (payload?.warehouseId) {
        // Targeted: only invalidate inventory for this warehouse
        queryClient.invalidateQueries({
          queryKey: ['inventory'],
          predicate: query => {
            const params = query.queryKey[1] as Record<string, unknown> | undefined;
            return !params || params.warehouseId === payload.warehouseId || params.warehouseId === undefined;
          },
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'inventory-summary'] });
    },
    [queryClient],
  );

  const handleTaskEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleEntityEvent = useCallback(
    (p: { entity: string; id?: string }) => {
      if (p.id) {
        // Targeted: invalidate specific record + list
        queryClient.invalidateQueries({ queryKey: [p.entity, p.id] });
      }
      // Always invalidate lists for this entity type
      queryClient.invalidateQueries({
        queryKey: [p.entity],
        predicate: query => query.queryKey.length > 1 && typeof query.queryKey[1] === 'object',
      });
    },
    [queryClient],
  );

  useEffect(() => {
    const socket = getSocket();

    const handleReconnect = () => {
      const room = currentRoomRef.current;
      if (room) {
        socket.emit('document:join', room);
      }
    };

    socket.on('connect', handleReconnect);

    // Document lifecycle events
    socket.on('document:status', handleDocumentStatus);
    socket.on('approval:requested', handleApproval);
    socket.on('approval:approved', handleApproval);
    socket.on('approval:rejected', handleApproval);
    socket.on('approval:level_approved', handleApproval);

    // Notifications
    socket.on('notification:new', handleNotification);

    // Inventory changes
    socket.on('inventory:updated', handleInventoryUpdate);

    // Task events
    socket.on('task:assigned', handleTaskEvent);
    socket.on('task:completed', handleTaskEvent);

    // Entity events — unified handler
    socket.on('entity:created', handleEntityEvent);
    socket.on('entity:updated', handleEntityEvent);
    socket.on('entity:deleted', handleEntityEvent);

    return () => {
      socket.off('connect', handleReconnect);
      socket.off('document:status', handleDocumentStatus);
      socket.off('approval:requested', handleApproval);
      socket.off('approval:approved', handleApproval);
      socket.off('approval:rejected', handleApproval);
      socket.off('approval:level_approved', handleApproval);
      socket.off('notification:new', handleNotification);
      socket.off('inventory:updated', handleInventoryUpdate);
      socket.off('task:assigned', handleTaskEvent);
      socket.off('task:completed', handleTaskEvent);
      socket.off('entity:created', handleEntityEvent);
      socket.off('entity:updated', handleEntityEvent);
      socket.off('entity:deleted', handleEntityEvent);
    };
  }, [
    queryClient,
    handleDocumentStatus,
    handleApproval,
    handleNotification,
    handleInventoryUpdate,
    handleTaskEvent,
    handleEntityEvent,
  ]);

  /** Join a document room for real-time collaboration. */
  const joinDocumentRoom = useCallback((documentRoom: string) => {
    currentRoomRef.current = documentRoom;
    const socket = getSocket();
    socket.emit('document:join', documentRoom);
  }, []);

  /** Leave the current document room. */
  const leaveDocumentRoom = useCallback(() => {
    const room = currentRoomRef.current;
    if (room) {
      const socket = getSocket();
      socket.emit('document:leave', room);
      currentRoomRef.current = null;
    }
  }, []);

  return { joinDocumentRoom, leaveDocumentRoom };
}
