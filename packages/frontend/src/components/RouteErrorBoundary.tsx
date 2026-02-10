import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label shown in the error card (e.g. "Inventory Dashboard") */
  label?: string;
}

/**
 * A compact, route/section-level error boundary.
 *
 * Unlike the root-level `ErrorBoundary` (full-screen), this renders an
 * inline card with a "Try Again" button that resets the error state
 * without reloading the page.
 */
export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack, label: this.props.label },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card rounded-xl p-8 text-center border border-red-500/20 max-w-md mx-auto my-8">
          <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Something went wrong</h2>
          {this.props.label && <p className="text-gray-500 text-xs mb-2">{this.props.label}</p>}
          <p className="text-gray-400 text-sm mb-5">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/10 transition-all text-sm"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
