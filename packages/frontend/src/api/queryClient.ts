import { QueryClient, type Mutation } from '@tanstack/react-query';
import { toast } from '@/components/Toaster';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds — data stays fresh
      gcTime: 5 * 60_000, // 5 minutes — garbage collection time
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
      onError: (error: unknown) => {
        const msg =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (error as Error)?.message ||
          'An unexpected error occurred';
        toast.error('Operation failed', msg);
      },
    },
  },
});
