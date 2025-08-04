import React, { Component, ErrorInfo, ReactNode } from 'react';
import { eventBuilders, analytics } from '@/lib/analytics';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that tracks UI errors to analytics
 */
export class AnalyticsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Track UI error to analytics
    const event = eventBuilders.uiError({
      component_name: errorInfo.componentStack?.split('\n')[0] || 'Unknown',
      error_type: error.name || 'UnknownError',
      user_action: undefined, // Could be enhanced with context
    });
    
    analytics.track(event.event, event.properties);
    
    // Log to console for debugging
    console.error('UI Error caught by boundary:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      
      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error.message}
          </p>
          <button
            onClick={this.reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to wrap components with analytics error tracking
 */
export function withAnalyticsErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, reset: () => void) => ReactNode
) {
  return (props: P) => (
    <AnalyticsErrorBoundary fallback={fallback}>
      <Component {...props} />
    </AnalyticsErrorBoundary>
  );
}