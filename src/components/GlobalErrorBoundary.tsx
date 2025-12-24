import React, { Component, ErrorInfo, ReactNode } from 'react';
import { spaNavigate } from '@/lib/spaNavigation';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary - Catches all unhandled errors and prevents app crashes
 * On Android release builds, this prevents the dreaded white screen of death
 * and instead shows a user-friendly error screen with retry option.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging (safe to do in production)
    console.error('[GlobalErrorBoundary] Caught error:', error);
    console.error('[GlobalErrorBoundary] Error info:', errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // No hard reload (safer for WebView). Re-dispatch current route.
    spaNavigate(window.location.pathname + window.location.search, { replace: true });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    // SPA navigation (no page reload)
    spaNavigate('/', { replace: true });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI or default error screen
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6 z-[9999]">
          <div className="max-w-sm w-full text-center">
            {/* Error icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-destructive" 
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
            </div>

            <h1 className="text-xl font-semibold text-foreground mb-2">
              Algo deu errado
            </h1>
            
            <p className="text-muted-foreground mb-6">
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Tentar novamente
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full py-3 px-4 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                Voltar ao início
              </button>
            </div>

            {/* Error details for debugging (only in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-muted-foreground cursor-pointer">
                  Detalhes do erro
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
