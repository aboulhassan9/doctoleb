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
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 p-8">
          <span className="material-symbols-outlined text-6xl text-critical mb-4">error</span>
          <h1 className="text-3xl font-black mb-2">Something went wrong.</h1>
          <p className="text-slate-500 mb-8 max-w-md text-center">
            An unexpected error occurred in the application. Our team has been notified.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Refresh Page
          </button>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 p-4 bg-red-50 text-red-900 rounded-lg w-full max-w-2xl overflow-auto text-xs font-mono border border-red-100">
              <p className="font-bold">{this.state.error.toString()}</p>
              <pre className="mt-2">{this.state.errorInfo?.componentStack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
