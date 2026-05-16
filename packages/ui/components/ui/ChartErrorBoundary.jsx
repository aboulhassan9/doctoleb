/**
 * ChartErrorBoundary — catches Recharts (or any chart-library) render errors
 * so a broken chart doesn't crash the entire page.
 *
 * Shows a friendly fallback message and a "Retry" button that resets the
 * error boundary so the user can try again after the data changes.
 *
 * Usage:
 *   <ChartErrorBoundary>
 *     <ChartRenderer definition={def} rows={rows} onDrillDown={fn} />
 *   </ChartErrorBoundary>
 */

import { Component } from 'react';

export default class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console for developer visibility; no PHI in chart errors.
    console.error('[ChartErrorBoundary] chart render failed:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3"
        >
          <p className="text-sm font-semibold text-red-700">
            Chart could not be rendered
          </p>
          <p className="text-xs text-red-600">
            {this.state.error?.message || 'An unexpected error occurred while drawing the chart.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            aria-label="Retry rendering the chart"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}