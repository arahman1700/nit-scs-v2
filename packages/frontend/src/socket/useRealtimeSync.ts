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
      const { documentType } = payload;
      queryClient.invalidateQueries({ queryKey: [documentType] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    [queryClient],
  );

  const handleApproval = useCallback(
    (payload: { documentType: string }) => {
      queryClient.invalidateQueries({ queryKey: [payload.documentType] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    [queryClient],
  );

  const handleNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const handleInventoryUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'inventory-summary'] });
  }, [queryClient]);

  const handleTaskEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleEntityCreated = useCallback(
    (p: { entity: string }) => {
      queryClient.invalidateQueries({ queryKey: [p.entity] });
    },
    [queryClient],
  );

  const handleEntityUpdated = useCallback(
    (p: { entity: string }) => {
      queryClient.invalidateQueries({ queryKey: [p.entity] });
    },
    [queryClient],
  );

  const handleEntityDeleted = useCallback(
    (p: { entity: string }) => {
      queryClient.invalidateQueries({ queryKey: [p.entity] });
    },
    [queryClient],
  );

  useEffect(() => {
    const socket = getSocket();

    // Re-join document rooms on reconnect
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

    // Broad invalidation for any entity change (catch-all)
    socket.on('entity:created', handleEntityCreated);
    socket.on('entity:updated', handleEntityUpdated);
    socket.on('entity:deleted', handleEntityDeleted);

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
      socket.off('entity:created', handleEntityCreated);
      socket.off('entity:updated', handleEntityUpdated);
      socket.off('entity:deleted', handleEntityDeleted);
    };
  }, [
    queryClient,
    handleDocumentStatus,
    handleApproval,
    handleNotification,
    handleInventoryUpdate,
    handleTaskEvent,
    handleEntityCreated,
    handleEntityUpdated,
    handleEntityDeleted,
  ]);

  /**
   * Join a document room for real-time collaboration.
   * Stores the room so it can be re-joined automatically on reconnect.
   */
  const joinDocumentRoom = useCallback((documentRoom: string) => {
    currentRoomRef.current = documentRoom;
    const socket = getSocket();
    socket.emit('document:join', documentRoom);
  }, []);

  /**
   * Leave the current document room.
   */
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
