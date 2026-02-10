import type { QueryClient } from '@tanstack/react-query';

/**
 * Creates optimistic update handlers for status transition mutations.
 *
 * Usage:
 * ```
 * const mutation = useMutation({
 *   mutationFn: (id) => api.post(`/grn/${id}/approve`),
 *   ...createOptimisticStatusUpdate(queryClient, ['grn', 'list'], id, 'approved'),
 * });
 * ```
 */
export function createOptimisticStatusUpdate<T extends { id: string; status: string }>(
  queryClient: QueryClient,
  queryKey: unknown[],
  entityId: string,
  newStatus: string,
) {
  return {
    onMutate: async () => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically update
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const oldObj = old as { data?: T[] } | undefined;
        if (!oldObj?.data) return old;
        return {
          ...oldObj,
          data: oldObj.data.map((item: T) => (item.id === entityId ? { ...item, status: newStatus } : item)),
        };
      });

      return { previous };
    },
    onError: (_err: unknown, _vars: unknown, context: { previous: unknown } | undefined) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  };
}
