/**
 * SecretsStorageBanner — the "unlock secrets storage" surface.
 *
 * Pins the contract: hydrate from `oh.secrets.getState` (hosts without
 * the RPC never render), show only while the cipher is `unavailable`,
 * name the platform-appropriate remedy, drive `oh.secrets.relaunch`
 * from the action button, follow live `secretsStorageState` broadcasts,
 * and dismiss per session.
 */

import { type HostBridge, type SecretsStorageState, setHostBridge } from '@openheaders/core/bridge';
import { SecretsStorageBanner } from '@openheaders/ui/shared/notifications';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface BridgeFake {
  bridge: HostBridge;
  relaunch: ReturnType<typeof vi.fn>;
  emit: (state: SecretsStorageState) => void;
}

function createBridgeFake(getState: () => Promise<SecretsStorageState>): BridgeFake {
  const listeners = new Set<(payload: unknown) => void>();
  const relaunch = vi.fn(async () => ({ ok: true }));
  const bridge: HostBridge = {
    async call(type, ..._args) {
      if (type === 'oh.secrets.getState') return (await getState()) as never;
      if (type === 'oh.secrets.relaunch') return (await relaunch()) as never;
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe(type, handler) {
      const fn = handler as (payload: unknown) => void;
      if (type === 'secretsStorageState') listeners.add(fn);
      return () => listeners.delete(fn);
    },
    presence: () => () => {},
  };
  return {
    bridge,
    relaunch,
    emit: (state) => {
      for (const fn of listeners) fn(state);
    },
  };
}

function install(getState: () => Promise<SecretsStorageState>): BridgeFake {
  const fake = createBridgeFake(getState);
  setHostBridge(fake.bridge);
  return fake;
}

describe('SecretsStorageBanner', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing on hosts without the secrets RPC', async () => {
    install(() => Promise.reject(new Error('no handler')));
    render(<SecretsStorageBanner />);
    await act(async () => {});
    expect(screen.queryByTestId('secrets-storage-banner')).toBeNull();
  });

  it('renders nothing while the cipher is available or untouched', async () => {
    for (const status of ['available', 'unknown'] as const) {
      install(() => Promise.resolve({ status, platform: 'darwin' }));
      const { unmount } = render(<SecretsStorageBanner />);
      await act(async () => {});
      expect(screen.queryByTestId('secrets-storage-banner')).toBeNull();
      unmount();
    }
  });

  it('shows the keychain remedy on macOS and relaunches from the action', async () => {
    const fake = install(() => Promise.resolve({ status: 'unavailable', platform: 'darwin' }));
    render(<SecretsStorageBanner />);
    await waitFor(() => expect(screen.getByTestId('secrets-storage-banner')).toBeTruthy());
    expect(screen.getByTestId('secrets-storage-banner').textContent).toContain('keychain');

    fireEvent.click(screen.getByTestId('secrets-storage-relaunch'));
    await waitFor(() => expect(fake.relaunch).toHaveBeenCalledTimes(1));
  });

  it('names the keyring backend on Linux', async () => {
    install(() => Promise.resolve({ status: 'unavailable', platform: 'linux' }));
    render(<SecretsStorageBanner />);
    await waitFor(() => expect(screen.getByTestId('secrets-storage-banner')).toBeTruthy());
    expect(screen.getByTestId('secrets-storage-banner').textContent).toContain('keyring');
  });

  it('appears live when a broadcast flips the status to unavailable', async () => {
    const fake = install(() => Promise.resolve({ status: 'available', platform: 'darwin' }));
    render(<SecretsStorageBanner />);
    await act(async () => {});
    expect(screen.queryByTestId('secrets-storage-banner')).toBeNull();

    act(() => fake.emit({ status: 'unavailable', platform: 'darwin' }));
    await waitFor(() => expect(screen.getByTestId('secrets-storage-banner')).toBeTruthy());
  });

  it('dismisses for the session via the close affordance', async () => {
    install(() => Promise.resolve({ status: 'unavailable', platform: 'darwin' }));
    render(<SecretsStorageBanner />);
    await waitFor(() => expect(screen.getByTestId('secrets-storage-banner')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId('secrets-storage-banner')).toBeNull());
  });
});
