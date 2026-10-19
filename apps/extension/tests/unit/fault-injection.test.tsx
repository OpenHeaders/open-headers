// @vitest-environment jsdom
/**
 * The fault-injection seam: a unit armed by its key makes the probe
 * inside exactly that boundary throw a real render error; the fallback
 * commits, settles the arm through `onCrashed`, and Retry renders the
 * unit clean. Other units never notice. The root unit reaches a root
 * boundary.
 */

import ErrorBoundary from '@openheaders/ui/components/ErrorBoundary';
import UnitErrorFallback from '@openheaders/ui/components/UnitErrorFallback';
import {
  armFault,
  FaultProbe,
  type FaultUnit,
  faultUnitKey,
  isFaultArmed,
  ROOT_FAULT_UNIT,
  resetFaults,
  settleFault,
  subscribeFaults,
} from '@openheaders/ui/shared/fault-injection';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  // React's synchronous retry of a thrown render reports through
  // `reportError`; the real roots route it to the funnel, here it is
  // swallowed.
  window.addEventListener('error', (event) => event.preventDefault());
});

afterEach(() => {
  cleanup();
  resetFaults();
  vi.restoreAllMocks();
});

const TAB_A: FaultUnit = { kind: 'tab', id: 'a' };
const TAB_B: FaultUnit = { kind: 'tab', id: 'b' };

function Unit({ unit }: { unit: FaultUnit }) {
  return (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <UnitErrorFallback
          kind="tab"
          error={error}
          onRetry={reset}
          onClose={() => {}}
          onCrashed={() => settleFault(unit)}
        />
      )}
    >
      <FaultProbe unit={unit} />
      <div>content {faultUnitKey(unit)}</div>
    </ErrorBoundary>
  );
}

describe('fault injection', () => {
  it('arms and settles by unit key and tells its subscribers once per change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFaults(listener);
    expect(isFaultArmed(TAB_A)).toBe(false);
    armFault(TAB_A);
    armFault(TAB_A);
    expect(isFaultArmed(TAB_A)).toBe(true);
    expect(isFaultArmed(TAB_B)).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    settleFault(TAB_A);
    settleFault(TAB_A);
    expect(isFaultArmed(TAB_A)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    armFault(TAB_B);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(faultUnitKey(ROOT_FAULT_UNIT)).toBe('root');
    expect(faultUnitKey({ kind: 'window', id: 'http-rules' })).toBe('window:http-rules');
  });

  it('an armed tab throws into its own boundary; the fallback settles the arm and Retry renders it clean', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Unit unit={TAB_A} />
        <Unit unit={TAB_B} />
      </>,
    );
    expect(screen.getByText('content tab:a')).toBeTruthy();
    expect(screen.getByText('content tab:b')).toBeTruthy();

    act(() => armFault(TAB_A));
    expect(screen.getByText('This tab hit an error')).toBeTruthy();
    expect(screen.getByText('InjectedFaultError: render fault injected into tab:a')).toBeTruthy();
    expect(screen.queryByText('content tab:a')).toBeNull();
    expect(screen.getByText('content tab:b')).toBeTruthy();
    // The fallback's commit spent the arm.
    expect(isFaultArmed(TAB_A)).toBe(false);

    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('content tab:a')).toBeTruthy();
    expect(screen.queryByText('This tab hit an error')).toBeNull();
  });

  it('the root unit reaches a root boundary above everything', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <FaultProbe unit={ROOT_FAULT_UNIT} />
        <div>the app</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('the app')).toBeTruthy();
    act(() => armFault(ROOT_FAULT_UNIT));
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('InjectedFaultError: render fault injected into root')).toBeTruthy();
  });
});
