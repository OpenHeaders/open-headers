/**
 * Back-end Switch gate — `useBackendModeSwitch.attemptChange`.
 *
 * Pins the verify-then-switch flow over the `OH.backends` registry:
 *   - a probe failure HARD-ABORTS — the registry is NOT committed;
 *   - a probe success enables the primary record after the overlay dwell
 *     (the mode itself is derived presentation, never stored);
 *   - modes that need no wire (`in-browser`) skip the probe and disable
 *     the record without forgetting its config.
 */

import {
  __clearBackendsForTests,
  getPrimaryBackend,
  refreshBackendsFromHostStorage,
  updatePrimaryBackend,
} from '@openheaders/core/backends';
import { type HostStorage, setHostStorage } from '@openheaders/core/storage';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { act, renderHook } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProbe = vi.fn();
vi.mock('@openheaders/ui/shared/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/backend')>();
  return { ...actual, probeBackendConnection: (...args: unknown[]) => mockProbe(...args) };
});

import { useBackendModeSwitch } from '@openheaders/ui/workbench/settings/components/backend-mode-switch';

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
}

const wrapper = ({ children }: { children: ReactNode }): ReactNode => <AntApp>{children}</AntApp>;

beforeEach(async () => {
  mockProbe.mockReset();
  setCurrentHost('extension');
  setHostStorage(createHostStorageFake());
  __clearBackendsForTests();
  await refreshBackendsFromHostStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBackendModeSwitch.attemptChange', () => {
  it('hard-aborts and does NOT commit when the probe fails', async () => {
    mockProbe.mockResolvedValue({ ok: false, reason: 'timeout' });
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      await result.current.attemptChange('desktop-app');
    });

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(getPrimaryBackend()).toBeNull();
    expect(result.current.mode).toBe('in-browser');
  });

  it('enables the primary record after the overlay dwell when the probe passes', async () => {
    mockProbe.mockResolvedValue({ ok: true, latencyMs: 5, protocolVersion: 1, role: 'extension', agent: 'x' });
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      const pending = result.current.attemptChange('desktop-app');
      await vi.advanceTimersByTimeAsync(1_000);
      await pending;
    });

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(getPrimaryBackend()?.enabled).toBe(true);
    expect(result.current.mode).toBe('desktop-app');
    expect(result.current.disabled).toBe(false);
  });

  it('skips the probe for a mode with no wire (in-browser), disabling without forgetting config', async () => {
    await updatePrimaryBackend({ enabled: true, authToken: 'kept-token' });
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      const pending = result.current.attemptChange('in-browser');
      await vi.advanceTimersByTimeAsync(1_000);
      await pending;
    });

    expect(mockProbe).not.toHaveBeenCalled();
    expect(getPrimaryBackend()?.enabled).toBe(false);
    // Kill switch, not amnesia: the paired token survives the switch.
    expect(getPrimaryBackend()?.authToken).toBe('kept-token');
    expect(result.current.mode).toBe('in-browser');
  });

  it('presents the configured URL + auth token to the probe', async () => {
    await updatePrimaryBackend({ url: 'ws://127.0.0.1:9999', authToken: 'tok-123' });
    mockProbe.mockResolvedValue({ ok: false, reason: 'timeout' });
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      await result.current.attemptChange('desktop-app');
    });

    expect(mockProbe).toHaveBeenCalledWith(
      'ws://127.0.0.1:9999',
      expect.objectContaining({ authToken: 'tok-123', role: 'extension' }),
    );
  });
});
