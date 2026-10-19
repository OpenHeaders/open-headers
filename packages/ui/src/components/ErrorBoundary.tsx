/**
 * ErrorBoundary — the containment ring (the crash-and-error-reports
 * plan §3). A thrown render is caught by the innermost boundary and
 * replaced by a fallback; the tree outside it keeps running.
 *
 * Two placements, one component:
 *   - at a document root ABOVE the providers (no `fallback` prop): the
 *     full-page `RootErrorFallback` — reload, copy details, open logs;
 *   - around a unit (a tab, a tool window, a dock pane) with a
 *     `fallback` render prop: the unit's own area shows the fallback
 *     and the rest of the surface stays interactive. `reset` remounts
 *     the children; a boundary only ever resets on an explicit click,
 *     never on a timer.
 *
 * Logging is not this component's job: every root passes the error
 * funnel's `onCaughtError`, which records the error and its component
 * stack the moment it is caught.
 */

import React from 'react';
import RootErrorFallback from './RootErrorFallback';

export interface ErrorFallbackProps {
  error: Error;
  /** Clear the error and render the children again. */
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Renders in place of the crashed subtree; omitted = the full-page root fallback. */
  fallback?: (props: ErrorFallbackProps) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function asError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  const error = new Error(typeof thrown === 'string' ? thrown : String(thrown));
  error.name = 'NonErrorThrown';
  return error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(thrown: unknown): ErrorBoundaryState {
    return { error: asError(thrown) };
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const { fallback } = this.props;
    if (fallback) return fallback({ error, reset: this.reset });
    return <RootErrorFallback error={error} />;
  }
}

export default ErrorBoundary;
