/**
 * Error Boundary Component
 * Catches React errors and prevents information disclosure
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/security/logging";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Error boundary that catches React errors and displays safe error messages
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "An unexpected error occurred. Please try again.",
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorMessage: process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred. Please try again.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details internally
    logger.error("React Error Boundary caught an error", {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      componentStack: process.env.NODE_ENV === "development" ? errorInfo.componentStack : undefined,
    });

    // In production, send to monitoring service
    if (process.env.NODE_ENV === "production") {
      this.sendToMonitoring({
        message: error.message,
        stack: error.stack ?? undefined,
        componentStack: errorInfo.componentStack ?? undefined,
      });
    }
  }

  private sendToMonitoring(errorData: {
    message: string;
    stack?: string;
    componentStack?: string;
  }): void {
    // TODO: Send to error monitoring service (Sentry, LogRocket, etc.)
    console.error("Error sent to monitoring:", errorData.message);
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg
                className="w-6 h-6 text-red-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Something went wrong
              </h2>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                  {this.state.errorMessage}
                </p>
              </div>
            )}

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {process.env.NODE_ENV === "production"
                ? "We're sorry for the inconvenience. Please try refreshing the page or contact support if the problem persists."
                : this.state.errorMessage}
            </p>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Go Home
              </button>
            </div>

            {process.env.NODE_ENV === "production" && (
              <div className="mt-4 text-center">
                <a
                  href="/support"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Contact Support
                </a>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to use error boundary programmatically
 */
export function useErrorHandler(): (error: Error) => void {
  const [, setError] = React.useState<Error>();

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}
