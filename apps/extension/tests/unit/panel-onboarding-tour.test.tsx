/**
 * PanelOnboardingTour — first-open gating on `UI.panelOnboardingCompleted`
 * and the completion write on close. The key never existed before this
 * feature, so existing installs (popup tour done) still get the panel
 * tour once; a set flag suppresses the auto-show entirely.
 */

import { type HostStorage, setHostStorage, UI } from '@openheaders/core/storage';
import PanelOnboardingTour from '@openheaders/ui/panel/components/PanelOnboardingTour';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// antd Tour measures its target via rc-resize-observer; jsdom has no
// ResizeObserver.
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
});

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  const fake: Partial<HostStorage> = {
    get: vi.fn(async (spec: { key: string }) => store[spec.key]) as HostStorage['get'],
    set: vi.fn(async (spec: { key: string }, value: unknown) => {
      store[spec.key] = value;
    }) as HostStorage['set'],
  };
  setHostStorage(fake as HostStorage);
});

afterEach(() => {
  cleanup();
});

describe('PanelOnboardingTour', () => {
  it('auto-shows the welcome step when the completion flag was never set', async () => {
    render(<PanelOnboardingTour open={null} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Unified DevTools Experience')).toBeTruthy();
    });
    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
  });

  it('stays hidden when the completion flag is already set', async () => {
    store[UI.panelOnboardingCompleted.key] = true;
    render(<PanelOnboardingTour open={null} onClose={() => {}} />);
    // Give the gate read + settle delay time to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.queryByText('Unified DevTools Experience')).toBeNull();
  });

  it('replays in controlled mode even when the flag is set', async () => {
    store[UI.panelOnboardingCompleted.key] = true;
    render(<PanelOnboardingTour open={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Unified DevTools Experience')).toBeTruthy();
    });
  });

  it('writes the completion flag and calls onClose when dismissed via Escape', async () => {
    const onClose = vi.fn();
    render(<PanelOnboardingTour open={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Unified DevTools Experience')).toBeTruthy();
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(store[UI.panelOnboardingCompleted.key]).toBe(true);
  });

  it('advances and retreats with the arrow keys', async () => {
    render(<PanelOnboardingTour open={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 6')).toBeTruthy();
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    });
  });
});
