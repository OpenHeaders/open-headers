// @vitest-environment jsdom
/**
 * PlaceRequiredHint — the hover on a primary the send cannot use as
 * configured: the headline names the case (a kind this surface cannot
 * run, or a chosen place it cannot honour), the reader's reason sits
 * under it, and Choose closes the hint before opening the picker.
 */

import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { PlaceRequiredHint } from '@openheaders/ui/workbench/execution-place/PlaceRequiredHint';
import type { ExecutionPlaceResolution } from '@openheaders/ui/workbench/execution-place/resolve-execution-place';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  setCurrentHost('extension');
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});
afterEach(cleanup);

function resolution(overrides: Partial<ExecutionPlaceResolution>): ExecutionPlaceResolution {
  return {
    place: 'here',
    placeName: null,
    state: 'ready',
    reason: { kind: 'runs-here' },
    cta: null,
    alternatives: [],
    ...overrides,
  };
}

describe('PlaceRequiredHint', () => {
  it('a kind this surface cannot run: the way-around headline, the reason, Choose opens the picker', async () => {
    const onChoose = vi.fn();
    render(
      <PlaceRequiredHint
        active
        resolution={resolution({ place: 'desktop-app', state: 'needs-companion', reason: { kind: 'tcp-scheme' } })}
        reason="mqtt:// opens a raw TCP socket."
        onChoose={onChoose}
      >
        <button type="button" disabled>
          Connect
        </button>
      </PlaceRequiredHint>,
    );
    fireEvent.mouseEnter(screen.getByText('Connect').parentElement as HTMLElement);
    const hint = await screen.findByTestId('execution-place-hint');
    expect(hint.textContent).toContain(
      'This request cannot run in the browser. Run it on the desktop app or a server.',
    );
    expect(hint.textContent).toContain('mqtt:// opens a raw TCP socket.');
    fireEvent.click(screen.getByTestId('execution-place-hint-choose'));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('a chosen place the surface cannot honour: the headline names the choice, not the browser', async () => {
    render(
      <PlaceRequiredHint
        active
        resolution={resolution({
          place: 'workspace-server',
          placeName: 'Acme',
          state: 'unsupported',
          reason: { kind: 'server-off' },
        })}
        reason="Running requests on a server is turned off in Settings on this device."
        onChoose={vi.fn()}
      >
        <button type="button" disabled>
          Send
        </button>
      </PlaceRequiredHint>,
    );
    fireEvent.mouseEnter(screen.getByText('Send').parentElement as HTMLElement);
    const hint = await screen.findByTestId('execution-place-hint');
    expect(hint.textContent).toContain('This request is set to run on Acme.');
    expect(hint.textContent).not.toContain('cannot run in the browser');
  });

  it('inactive, renders the child alone', () => {
    render(
      <PlaceRequiredHint active={false} resolution={resolution({})} reason="" onChoose={vi.fn()}>
        <button type="button">Send</button>
      </PlaceRequiredHint>,
    );
    fireEvent.mouseEnter(screen.getByText('Send'));
    expect(screen.queryByTestId('execution-place-hint')).toBeNull();
  });
});
