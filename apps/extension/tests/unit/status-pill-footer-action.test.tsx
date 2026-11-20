/**
 * The System popover's one footer action (the activity monitor plan §7,
 * fork 9): a surface may put ONE link on the popover's last line — the
 * workbench's way to its Activity Monitor — and a surface that passes
 * none keeps the line as the build info alone.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { StatusPill } from '@openheaders/ui/shared/status';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridge: HostBridge = {
  call: async () => ({ snapshot: {} }) as never,
  broadcast: () => {},
  subscribe: () => () => {},
  presence: () => () => {},
};

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  // The popover measures its trigger; the test DOM has no observer of its own.
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  setHostBridge(bridge);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StatusPill — the footer action', () => {
  it('shows the action a surface passes on the popover’s last line, and runs it on a press', async () => {
    const onOpen = vi.fn();
    render(
      <StatusPill
        density="full"
        footerAction={
          <button type="button" onClick={onOpen}>
            Open Activity Monitor
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByTestId('status-pill'));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Activity Monitor' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('adds nothing to the popover where a surface passes no action', async () => {
    render(<StatusPill density="full" />);
    fireEvent.click(screen.getByTestId('status-pill'));
    await screen.findByText('Browser Interceptor');
    expect(screen.queryByRole('button', { name: 'Open Activity Monitor' })).toBeNull();
  });
});
