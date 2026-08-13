import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-fc-cream flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-xl shadow-card p-6 border border-fc-cream2">
            <h2 className="text-xl font-semibold text-fc-midnight mb-4">Something went wrong</h2>
            <p className="text-fc-brown mb-4">
              An error occurred while loading this page. Please try refreshing.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="fc-btn-primary w-full justify-center"
            >
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-xs text-fc-brown/70">
                <summary className="cursor-pointer mb-2">Error Details</summary>
                <pre className="overflow-auto bg-fc-cream2 p-2 rounded">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
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

export default ErrorBoundary;

