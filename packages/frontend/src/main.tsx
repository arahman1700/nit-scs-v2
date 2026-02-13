// Sentry must be imported before other app modules
import './config/sentry';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Toaster';
import App from './App';

import './styles/globals.css';
import { setupSyncHandlers } from './lib/offlineSyncHandlers';
import { initAutoSync } from './lib/offlineQueue';

// Register offline sync handlers and start auto-sync
setupSyncHandlers();
initAutoSync();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
