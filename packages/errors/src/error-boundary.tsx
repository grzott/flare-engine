import { Component, type ErrorInfo, type ReactNode } from 'react';
import { type CrashPayload, createCrashPayload } from './crash-payload.js';
import type { CrashTransport } from './transport.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered when an error is caught. Receives the payload + a reset callback. */
  fallback: (payload: CrashPayload, reset: () => void) => ReactNode;
  /** Transport invoked once per caught error. */
  transport?: CrashTransport;
  /** Additional context merged into every payload captured by this boundary. */
  context?: Record<string, unknown>;
  /** Called with both the raw error and the payload for custom side effects. */
  onError?: (error: unknown, payload: CrashPayload) => void;
}

interface ErrorBoundaryState {
  payload: CrashPayload | null;
}

/**
 * React error boundary that captures render-phase errors into a structured
 * `CrashPayload`, forwards it to an optional transport, and renders the
 * caller-supplied fallback.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { payload: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { payload: createCrashPayload(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const context = {
      ...this.props.context,
      componentStack: info.componentStack ?? null,
    };
    const payload = createCrashPayload(error, context);
    this.setState({ payload });
    this.props.transport?.report(payload);
    this.props.onError?.(error, payload);
  }

  reset = (): void => {
    this.setState({ payload: null });
  };

  render(): ReactNode {
    if (this.state.payload !== null) {
      return this.props.fallback(this.state.payload, this.reset);
    }
    return this.props.children;
  }
}
