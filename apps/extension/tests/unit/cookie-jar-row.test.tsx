// @vitest-environment jsdom
/**
 * CookieJarRow — the jar inspection line under the "Use cookie jar"
 * knob. The row reads the workspace jar through the
 * `getCookieJarSummary` bridge RPC (value-free metadata only) and
 * clears it through `clearCookieJar`; a host that rejects the summary
 * (no jar on this runtime) gets no row at all.
 */

import { type CookieJarEntryWire, type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import CookieJarRow from '@openheaders/ui/workbench/components/request-editor/CookieJarRow';
import SettingsTab from '@openheaders/ui/workbench/components/request-editor/SettingsTab';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The antd Select measures itself via rc-resize-observer; jsdom doesn't
// ship a ResizeObserver.
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

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

/** Install a fake bridge whose jar channels answer from `cookies`;
 *  every other channel rejects like an unimplemented host RPC. */
function installBridge(cookies: CookieJarEntryWire[], options: { rejectSummary?: boolean } = {}) {
  const call = vi.fn(async (type: string) => {
    if (type === 'getCookieJarSummary') {
      if (options.rejectSummary) throw new Error("host: RPC 'getCookieJarSummary' is not implemented");
      return { cookies };
    }
    if (type === 'clearCookieJar') return { success: true };
    throw new Error(`unexpected RPC '${type}'`);
  });
  setHostBridge({
    call,
    broadcast: () => {},
    subscribe: () => () => {},
    presence: () => () => {},
  } as unknown as HostBridge);
  return call;
}

const SESSION_COOKIE: CookieJarEntryWire = {
  name: 'session',
  domain: 'api.openheaders.io',
  hostOnly: true,
  path: '/',
  secure: false,
};

const TENANT_COOKIE: CookieJarEntryWire = {
  name: 'tenant',
  domain: 'openheaders.io',
  hostOnly: false,
  path: '/',
  secure: true,
  expiresAt: Date.parse('2027-01-01T00:00:00Z'),
};

describe('CookieJarRow', () => {
  it('shows the jar count once the summary answers', async () => {
    installBridge([SESSION_COOKIE, TENANT_COOKIE]);
    render(<CookieJarRow />);
    await waitFor(() => expect(screen.getByText('2 cookies in this workspace’s jar')).toBeTruthy());
  });

  it('uses the singular for one cookie and disables Clear on an empty jar', async () => {
    installBridge([SESSION_COOKIE]);
    render(<CookieJarRow />);
    await waitFor(() => expect(screen.getByText('1 cookie in this workspace’s jar')).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(false);

    cleanup();
    installBridge([]);
    render(<CookieJarRow />);
    await waitFor(() => expect(screen.getByText('0 cookies in this workspace’s jar')).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears the jar over the bridge and empties the count', async () => {
    const call = installBridge([SESSION_COOKIE, TENANT_COOKIE]);
    render(<CookieJarRow />);
    await waitFor(() => expect(screen.getByText('2 cookies in this workspace’s jar')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getByText('0 cookies in this workspace’s jar')).toBeTruthy());
    expect(call).toHaveBeenCalledWith('clearCookieJar', {});
  });

  it('renders nothing when the host rejects the summary channel', async () => {
    installBridge([], { rejectSummary: true });
    const { container } = render(<CookieJarRow />);
    // Give the rejected call a tick to settle before asserting absence.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[data-testid="oh-cookie-jar-row"]')).toBeNull();
  });

  it('rides the node branch of SettingsTab, under the cookie-jar knob', async () => {
    registerCapability('requestRuntime', () => 'node');
    installBridge([SESSION_COOKIE]);
    render(<SettingsTab value={{}} onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Use cookie jar' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('oh-cookie-jar-row')).toBeTruthy());
  });

  it('never renders on a browser runtime — the node branch is not mounted', async () => {
    installBridge([SESSION_COOKIE]);
    render(<SettingsTab value={{}} onChange={() => {}} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId('oh-cookie-jar-row')).toBeNull();
  });
});
