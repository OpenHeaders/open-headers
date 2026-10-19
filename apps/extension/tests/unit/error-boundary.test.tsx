// @vitest-environment jsdom
/**
 * The containment rings: a unit boundary (tab / tool window) shows its
 * fallback in place and remounts on Retry; a root boundary with no
 * fallback prop shows the full-page fallback with Reload and Copy
 * details. Logging is the root's job (the funnel's `onCaughtError`),
 * so React's own console report is the only noise to silence here.
 */

import ErrorBoundary from '@openheaders/ui/components/ErrorBoundary';
import UnitErrorFallback from '@openheaders/ui/components/UnitErrorFallback';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
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

  it('a root boundary without a fallback prop shows the full-page fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const marker = { shouldThrow: true };
    render(
      <ErrorBoundary>
        <ThrowsWhile marker={marker} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Reload')).toBeTruthy();
    expect(screen.getByText('TypeError: editor exploded')).toBeTruthy();
    // No host registered `revealLogs` here — the logs action stays hidden.
    expect(screen.queryByText('Open logs folder')).toBeNull();

    fireEvent.click(screen.getByText('Copy details'));
    await screen.findByText('Copied to clipboard');
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('TypeError: editor exploded');
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
