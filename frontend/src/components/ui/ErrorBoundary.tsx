import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  /** Render a compact inline error instead of the full-page card */
  inline?: boolean;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.inline) {
      return (
        <div className="eb-inline">
          <AlertTriangle size={14} />
          <span className="eb-inline-msg">
            {this.props.fallbackMessage ?? "Something went wrong rendering this component."}
          </span>
          <button className="eb-inline-retry" onClick={this.handleRetry}>
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      );
    }

    return (
      <div className="eb-card">
        <AlertTriangle size={28} className="eb-icon" />
        <h3 className="eb-title">Something went wrong</h3>
        <p className="eb-message">
          {this.props.fallbackMessage ?? "An unexpected error occurred. You can retry or go back."}
        </p>
        <pre className="eb-detail">{this.state.error.message}</pre>
        <button className="eb-retry" onClick={this.handleRetry}>
          <RotateCcw size={14} /> Try Again
        </button>
      </div>
    );
  }
}
