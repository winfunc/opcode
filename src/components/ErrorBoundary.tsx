import React, { Component, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and display React rendering errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Capture detailed error information
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // Log detailed error to console
    console.error("Error caught by boundary:", errorDetails);
    
    // Save error to localStorage for debugging
    this.saveErrorToLocalStorage(errorDetails);
  }
  
  private saveErrorToLocalStorage(error: any) {
    try {
      const errors = JSON.parse(localStorage.getItem('claudia_errors') || '[]');
      errors.push(error);
      // Keep only last 10 errors
      if (errors.length > 10) errors.shift();
      localStorage.setItem('claudia_errors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to save error to localStorage:', e);
    }
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

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[200px] p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-semibold">Something went wrong</h3>
                  <p className="text-sm text-muted-foreground">
                    An error occurred while rendering this component.
                  </p>
                  {this.state.error.message && (
                    <details className="mt-2">
                      <summary className="text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                        Error details
                      </summary>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {this.state.error.message}
                        {this.state.error.stack && (
                          <>
                            {"\n\nStack trace:\n"}
                            {this.state.error.stack}
                          </>
                        )}
                      </pre>
                    </details>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={this.reset}
                      size="sm"
                    >
                      Try again
                    </Button>
                    <Button
                      onClick={() => {
                        const errorData = {
                          message: this.state.error?.message,
                          stack: this.state.error?.stack,
                          timestamp: new Date().toISOString(),
                        };
                        navigator.clipboard.writeText(JSON.stringify(errorData, null, 2));
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Copy error details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
} 