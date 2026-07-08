/**
 * Probe-gated enable toggle — `useBackendEnableSwitch.setEnabled`.
 *
 * Pins the verify-then-enable flow over the `OH.backends` registry:
 *   - a probe failure HARD-ABORTS — the record is NOT enabled;
 *   - a probe success enables the record after the overlay dwell;
 *   - disabling never probes and never forgets config (kill switch);
 *   - the probe presents the record's own URL + paired token.
 */

import {
  __clearBackendsForTests,
  createBackend,
  getBackend,
  refreshBackendsFromHostStorage,
  updateBackend,
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

import { useBackendEnableSwitch } from '@openheaders/ui/workbench/settings/components/use-backend-enable-switch';

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

describe('useBackendEnableSwitch.setEnabled', () => {
  it('hard-aborts and does NOT enable when the probe fails', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137' });
    mockProbe.mockResolvedValue({ ok: false, reason: 'timeout' });
    const { result } = renderHook(() => useBackendEnableSwitch(), { wrapper });

    await act(async () => {
      await result.current.setEnabled(record, true);
    });

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(getBackend(record.id)?.enabled).toBe(false);
  });

  it('enables the record after the overlay dwell when the probe passes', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137' });
    mockProbe.mockResolvedValue({ ok: true, latencyMs: 5, protocolVersion: 1, role: 'extension', agent: 'x' });
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackendEnableSwitch(), { wrapper });

    await act(async () => {
      const pending = result.current.setEnabled(record, true);
      await vi.advanceTimersByTimeAsync(1_000);
      await pending;
    });

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(getBackend(record.id)?.enabled).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it('disables without a probe and without forgetting config (kill switch)', async () => {
    const created = await createBackend({ url: 'ws://127.0.0.1:8137', authToken: 'kept-token' });
    const record = await updateBackend(created.id, { enabled: true });
    const { result } = renderHook(() => useBackendEnableSwitch(), { wrapper });

    await act(async () => {
      if (record) await result.current.setEnabled(record, false);
    });

    expect(mockProbe).not.toHaveBeenCalled();
    expect(getBackend(created.id)?.enabled).toBe(false);
    // Kill switch, not amnesia: the paired token survives the disable.
    expect(getBackend(created.id)?.authToken).toBe('kept-token');
  });

  it('presents the record own URL + auth token to the probe', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:9999', authToken: 'tok-123' });
    mockProbe.mockResolvedValue({ ok: false, reason: 'timeout' });
    const { result } = renderHook(() => useBackendEnableSwitch(), { wrapper });

    await act(async () => {
      await result.current.setEnabled(record, true);
    });

    expect(mockProbe).toHaveBeenCalledWith(
      'ws://127.0.0.1:9999',
      expect.objectContaining({ authToken: 'tok-123', role: 'extension' }),
    );
  });

  it('a same-state flip is a no-op', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137' });
    const { result } = renderHook(() => useBackendEnableSwitch(), { wrapper });

    await act(async () => {
      await result.current.setEnabled(record, false);
    });

    expect(mockProbe).not.toHaveBeenCalled();
    expect(getBackend(record.id)?.enabled).toBe(false);
  });
});
