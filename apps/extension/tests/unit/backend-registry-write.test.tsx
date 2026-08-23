/**
 * Connection-registry writes on a host that cannot hold them.
 *
 * `OH.backends` is a sensitive slot, so a host without an at-rest
 * cipher refuses the write rather than storing paired tokens in
 * plaintext. Two things must follow, and both are pinned here: the
 * refusal reaches the user instead of vanishing into a `void`ed
 * promise, and the caller learns the write did not land (`null`) so it
 * never drives a flow on a record that was never stored.
 *
 * The served web tab is the host where that refusal is permanent — it
 * is served BY its back-end and joins no others — so `hostJoinsBackends`
 * keeps the whole affordance off that host in the first place.
 */

import { type HostStorage, requireHostStorage, setHostStorage } from '@openheaders/core/storage';
import { useBackendRegistryWrite } from '@openheaders/ui/workbench/settings/components/use-backend-registry-write';
import { hostJoinsBackends } from '@openheaders/ui/workbench/settings/schema/backend';
import { act, renderHook } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [name, spec] of Object.entries(specs)) out[name] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      for (const spec of Array.isArray(specs) ? specs : [specs]) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => {},
  };
}

const wrapper = ({ children }: { children: ReactNode }): ReactNode => <AntApp>{children}</AntApp>;

/** The refusal a cipher-less host raises on a sensitive slot. */
function refuseWrites(): void {
  setHostStorage({
    ...requireHostStorage(),
    set: () => Promise.reject(new Error('no cipher; refusing to write sensitive slot "oh.backends"')),
  });
}

beforeEach(() => {
  setHostStorage(createHostStorageFake());
});

describe('useBackendRegistryWrite', () => {
  it('passes a successful write through', async () => {
    const { result } = renderHook(() => useBackendRegistryWrite(), { wrapper });

    let written: string | null = null;
    await act(async () => {
      written = await result.current(() => Promise.resolve('stored'));
    });

    expect(written).toBe('stored');
  });

  it('resolves null on a refusal instead of rejecting into the caller', async () => {
    refuseWrites();
    const { result } = renderHook(() => useBackendRegistryWrite(), { wrapper });

    let written: unknown = 'untouched';
    await act(async () => {
      written = await result.current(() => requireHostStorage().set({ key: 'oh.backends' } as never, []));
    });

    expect(written).toBeNull();
  });

  it('surfaces the refusal with its cause', async () => {
    refuseWrites();
    const { result } = renderHook(() => useBackendRegistryWrite(), { wrapper });

    await act(async () => {
      await result.current(() => requireHostStorage().set({ key: 'oh.backends' } as never, []));
    });

    const notice = document.body.textContent ?? '';
    expect(notice).toContain('Could not save the connection');
    expect(notice).toContain('refusing to write sensitive slot');
  });
});

describe('hostJoinsBackends', () => {
  it('is true where a client plane exists and false on the served web tab', () => {
    expect(hostJoinsBackends('extension')).toBe(true);
    expect(hostJoinsBackends('desktop')).toBe(true);
    expect(hostJoinsBackends('web')).toBe(false);
  });
});
