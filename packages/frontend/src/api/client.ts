import axios from 'axios';
import { toast } from '@/components/Toaster';
import { queryClient } from '@/api/queryClient';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
});

// Request interceptor: attach JWT token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('nit_scs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh token queue to prevent concurrent refresh race conditions ────
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let refreshFailSubscribers: Array<(err: unknown) => void> = [];

function subscribeToRefresh(onRefreshed: (token: string) => void, onFailed: (err: unknown) => void) {
  refreshSubscribers.push(onRefreshed);
  refreshFailSubscribers.push(onFailed);
}

function onRefreshSuccess(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
  refreshFailSubscribers = [];
}

function onRefreshFailure(err: unknown) {
  refreshFailSubscribers.forEach(cb => cb(err));
  refreshSubscribers = [];
  refreshFailSubscribers = [];
}

// Response interceptor: handle 401 (expired token) with refresh queue
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // 409 Conflict: optimistic locking version mismatch
    if (error.response?.status === 409) {
      toast.error(
        'Version Conflict',
        'This record was modified by another user. The page will reload with the latest data.',
      );
      // Invalidate all cached queries so the user sees fresh state before retrying
      void queryClient.invalidateQueries();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh(
            (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            (err: unknown) => reject(err),
          );
        });
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });

        const newToken = data.data.accessToken;
        localStorage.setItem('nit_scs_token', newToken);

        isRefreshing = false;
        onRefreshSuccess(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailure(refreshError);

        localStorage.removeItem('nit_scs_token');
        // Use soft navigation instead of full page reload
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
