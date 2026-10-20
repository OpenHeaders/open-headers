// @vitest-environment jsdom
/**
 * The containment rings: a unit boundary (tab / tool window) shows its
 * fallback in place and remounts on Retry; a root boundary with no
 * fallback prop shows the full-page fallback with Reload, Report Issue
 * and the chat link. Logging is the root's job (the funnel's `onCaughtError`),
 * so React's own console report is the only noise to silence here.
 */

import { COMMUNITY_CHAT_URL } from '@openheaders/core/diagnostics';
import ErrorBoundary from '@openheaders/ui/components/ErrorBoundary';
import UnitErrorFallback from '@openheaders/ui/components/UnitErrorFallback';
import { funnelError, setErrorFunnelSink } from '@openheaders/ui/shared/error-funnel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

// React retries a concurrent render synchronously before a boundary
// sees the throw, and reports that retry through `reportError` — a
// document `error` event the test runner would otherwise treat as
// unhandled. The real roots route it through the funnel's
// `onRecoverableError`; here it is swallowed.
beforeAll(() => {
  window.addEventListener('error', (event) => event.preventDefault());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Throws while the marker says so; the test flips it before Retry — the remount story. */
function ThrowsWhile({ marker }: { marker: { shouldThrow: boolean } }) {
  if (marker.shouldThrow) throw new TypeError('editor exploded');
  return <div>editor content</div>;
}

describe('ErrorBoundary', () => {
  it('a unit boundary shows the tab fallback in place and Retry remounts the children', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const marker = { shouldThrow: true };
    const onClose = vi.fn();
    render(
      <div>
        <span>tab bar stays</span>
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <UnitErrorFallback kind="tab" error={error} onRetry={reset} onClose={onClose} />
          )}
        >
          <ThrowsWhile marker={marker} />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('This tab hit an error')).toBeTruthy();
    expect(screen.getByText('TypeError: editor exploded')).toBeTruthy();
    expect(screen.getByText('tab bar stays')).toBeTruthy();

    fireEvent.click(screen.getByText('Close tab'));
    expect(onClose).toHaveBeenCalledOnce();

    marker.shouldThrow = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('editor content')).toBeTruthy();
    expect(screen.queryByText('This tab hit an error')).toBeNull();
  });

  it('the unit fallback reports its mount once, so a shell can forget the crashed editor', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const marker = { shouldThrow: true };
    const onCrashed = vi.fn();
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <UnitErrorFallback kind="tab" error={error} onRetry={reset} onClose={() => {}} onCrashed={onCrashed} />
        )}
      >
        <ThrowsWhile marker={marker} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This tab hit an error')).toBeTruthy();
    expect(onCrashed).toHaveBeenCalledOnce();
  });

  it('a unit boundary marks the caught error with its unit before the funnel sees it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn();
    setErrorFunnelSink(sink);
    const marker = { shouldThrow: true };
    const thrown = new TypeError('editor exploded');
    function ThrowsOnce() {
      if (marker.shouldThrow) throw thrown;
      return <div />;
    }
    render(
      <ErrorBoundary
        unit={{ kind: 'tab', mode: 'request-edit' }}
        fallback={({ error, reset }) => (
          <UnitErrorFallback kind="tab" error={error} onRetry={reset} onClose={() => {}} />
        )}
      >
        <ThrowsOnce />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This tab hit an error')).toBeTruthy();
    // The root's `onCaughtError` runs after the fallback rendered — the
    // funnel finds the mark the boundary left on the error object.
    funnelError({ surface: 'workbench', origin: 'boundary', error: thrown, componentStack: null });
    expect(sink.mock.calls[0][0].unit).toEqual({ kind: 'tab', mode: 'request-edit' });
    setErrorFunnelSink(null);
  });

  it('the window kind labels its close action Hide window', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const marker = { shouldThrow: true };
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <UnitErrorFallback kind="window" error={error} onRetry={reset} onClose={() => {}} />
        )}
      >
        <ThrowsWhile marker={marker} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This tool window hit an error')).toBeTruthy();
    expect(screen.getByText('Hide window')).toBeTruthy();
  });

  it('a root boundary without a fallback prop shows the full-page fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const marker = { shouldThrow: true };
    render(
      <ErrorBoundary>
        <ThrowsWhile marker={marker} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Reload')).toBeTruthy();
    expect(screen.getByText('TypeError: editor exploded')).toBeTruthy();

    // Report Issue opens the workbench's report dialog under this page's
    // own provider, seeded with the error as the title and the funnel's
    // details as the description — the person edits, then previews.
    fireEvent.click(screen.getByText('Report Issue'));
    expect(screen.getByDisplayValue('TypeError: editor exploded')).toBeTruthy();
    expect(screen.getByDisplayValue(/surface: workbench/)).toBeTruthy();
    expect(screen.getByText('Preview on GitHub')).toBeTruthy();

    fireEvent.click(screen.getByText('Chat with Us on Discord'));
    expect(open).toHaveBeenCalledWith(COMMUNITY_CHAT_URL, '_blank', 'noopener');
  });

  it('a thrown non-Error reads as NonErrorThrown', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function ThrowsString(): never {
      throw 'just a string';
    }
    render(
      <ErrorBoundary>
        <ThrowsString />
      </ErrorBoundary>,
    );
    expect(screen.getByText('NonErrorThrown: just a string')).toBeTruthy();
  });

  it('renders children untouched when nothing throws', () => {
    const Counter = () => {
      const [n, setN] = useState(0);
      return (
        <button type="button" onClick={() => setN(n + 1)}>
          count {n}
        </button>
      );
    };
    render(
      <ErrorBoundary>
        <Counter />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('count 0'));
    expect(screen.getByText('count 1')).toBeTruthy();
  });
});
