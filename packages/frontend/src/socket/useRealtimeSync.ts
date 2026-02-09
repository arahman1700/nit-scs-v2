import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './client';

/**
 * Listens for Socket.IO events from the backend and invalidates
 * the corresponding React Query caches so data stays fresh in real-time.
 *
 * Mount this once near the app root (e.g., in the Layout component).
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

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

  useEffect(() => {
    const socket = getSocket();

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
    socket.on('entity:created', (p: { entity: string }) => {
      queryClient.invalidateQueries({ queryKey: [p.entity] });
    });
    socket.on('entity:updated', (p: { entity: string }) => {
      queryClient.invalidateQueries({ queryKey: [p.entity] });
    });
    socket.on('entity:deleted', (p: { entity: string }) => {
      queryClient.invalidateQueries({ queryKey: [p.entity] });
    });

    return () => {
      socket.off('document:status', handleDocumentStatus);
      socket.off('approval:requested', handleApproval);
      socket.off('approval:approved', handleApproval);
      socket.off('approval:rejected', handleApproval);
      socket.off('approval:level_approved', handleApproval);
      socket.off('notification:new', handleNotification);
      socket.off('inventory:updated', handleInventoryUpdate);
      socket.off('task:assigned', handleTaskEvent);
      socket.off('task:completed', handleTaskEvent);
      socket.off('entity:created');
      socket.off('entity:updated');
      socket.off('entity:deleted');
    };
  }, [queryClient, handleDocumentStatus, handleApproval, handleNotification, handleInventoryUpdate, handleTaskEvent]);
}
