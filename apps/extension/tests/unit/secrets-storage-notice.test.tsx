/**
 * Secrets-storage lock surfaces — the "unlock secrets storage" flow.
 *
 * Pins the contract of the two renderer-side surfaces fed by
 * `oh.secrets.getState` + the `secretsStorageState` broadcast:
 *   - `useSecretsStorageNotice` keeps a standing error suggestion in the
 *     Notifications panel while the cipher is unavailable (platform-
 *     appropriate remedy, "Relaunch app" follow-through) and retires it
 *     the moment the state recovers; hosts without the RPC never push.
 *   - `productStatusInlineActions` renders the text-sized Relaunch
 *     link INSIDE the status popover's `secrets` row only while the
 *     host stamps `context.cipher === 'unavailable'` on a red entry.
 */

import { type HostBridge, type SecretsStorageState, setHostBridge } from '@openheaders/core/bridge';
import {
  __resetNotificationsForTests,
  useSecretsStorageNotice,
  useSuggestions,
} from '@openheaders/ui/shared/notifications';
import type { StatusEntry } from '@openheaders/ui/shared/status';
import { productStatusInlineActions } from '@openheaders/ui/shared/status';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface BridgeFake {
  bridge: HostBridge;
  relaunch: ReturnType<typeof vi.fn>;
  emit: (state: SecretsStorageState) => void;
}

function installBridge(getState: () => Promise<SecretsStorageState>): BridgeFake {
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
  setHostBridge(bridge);
  return {
    bridge,
    relaunch,
    emit: (state) => {
      for (const fn of listeners) fn(state);
    },
  };
}

function useNoticeHarness() {
  useSecretsStorageNotice();
  return useSuggestions();
}

describe('useSecretsStorageNotice', () => {
  afterEach(() => {
    cleanup();
    __resetNotificationsForTests();
  });

  it('pushes one error suggestion with the platform remedy and the relaunch action', async () => {
    const fake = installBridge(() => Promise.resolve({ status: 'unavailable', platform: 'darwin' }));
    const { result } = renderHook(useNoticeHarness);

    await waitFor(() => expect(result.current).toHaveLength(1));
    const suggestion = result.current[0];
    expect(suggestion).toMatchObject({ severity: 'error', title: 'Secrets storage is locked' });
    expect(String(suggestion?.description)).toContain('keychain');
    expect(suggestion?.actions?.[0]?.label).toBe('Relaunch app');

    suggestion?.actions?.[0]?.run();
    await waitFor(() => expect(fake.relaunch).toHaveBeenCalledTimes(1));
  });

  it('retires the suggestion when a broadcast reports recovery', async () => {
    const fake = installBridge(() => Promise.resolve({ status: 'unavailable', platform: 'linux' }));
    const { result } = renderHook(useNoticeHarness);
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(String(result.current[0]?.description)).toContain('keyring');

    act(() => fake.emit({ status: 'available', platform: 'linux' }));
    await waitFor(() => expect(result.current).toHaveLength(0));
  });

  it('pushes nothing on hosts without the secrets RPC or while the cipher is fine', async () => {
    installBridge(() => Promise.reject(new Error('no handler')));
    const rejected = renderHook(useNoticeHarness);
    await act(async () => {});
    expect(rejected.result.current).toHaveLength(0);
    rejected.unmount();

    installBridge(() => Promise.resolve({ status: 'available', platform: 'darwin' }));
    const healthy = renderHook(useNoticeHarness);
    await act(async () => {});
    expect(healthy.result.current).toHaveLength(0);
  });
});

describe('productStatusInlineActions — secrets relaunch link', () => {
  afterEach(() => {
    cleanup();
  });

  function secretsEntry(overrides: Partial<StatusEntry> = {}): StatusEntry {
    return {
      subsystem: 'secrets',
      state: 'red',
      message: 'Secrets storage locked — relaunch to unlock',
      context: { cipher: 'unavailable', platform: 'darwin' },
      timestamp: 1,
      ...overrides,
    };
  }

  it('renders the relaunch link for a red cipher-unavailable entry and drives the RPC', async () => {
    const fake = installBridge(() => Promise.resolve({ status: 'unavailable', platform: 'darwin' }));
    render(<div>{productStatusInlineActions('secrets', secretsEntry())}</div>);

    fireEvent.click(screen.getByTestId('secrets-status-relaunch'));
    await waitFor(() => expect(fake.relaunch).toHaveBeenCalledTimes(1));
  });

  it('renders nothing without the cipher context or off the secrets subsystem', () => {
    render(
      <>
        {productStatusInlineActions('secrets', secretsEntry({ state: 'green', context: undefined }))}
        {productStatusInlineActions('secrets', undefined)}
        {productStatusInlineActions('requests', secretsEntry())}
      </>,
    );
    expect(screen.queryByTestId('secrets-status-relaunch')).toBeNull();
  });
});
