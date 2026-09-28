/**
 * The request's execution place as a host-local value: the record
 * helpers, the entity composition and split the editors save through,
 * and the hook over the editing scope's `executionPlaces` slot — read
 * once, followed live, written per request without dropping another
 * request's entry.
 */

import { type HostStorage, setHostStorage, wsKeys } from '@openheaders/core/storage';
import { readExecutionPlace, withExecutionPlace } from '@openheaders/core/utils';
import {
  splitLocalPlace,
  useRequestExecutionPlaces,
  withLocalPlace,
} from '@openheaders/ui/workbench/execution-place/local-place';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function createHostStorageFake(): HostStorage & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string): void => {
    for (const fn of listeners.get(key) ?? []) fn();
  };
  return {
    map,
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
      notify(spec.key);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) {
        map.set(spec.key, value);
        notify(spec.key);
      }
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) {
        map.delete(spec.key);
        notify(spec.key);
      }
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: (spec, handler) => {
      let bucket = listeners.get(spec.key);
      if (!bucket) {
        bucket = new Set();
        listeners.set(spec.key, bucket);
      }
      const fn = (): void => handler(map.get(spec.key) as never);
      bucket.add(fn);
      return () => bucket?.delete(fn);
    },
  };
}

let storage: ReturnType<typeof createHostStorageFake>;

beforeEach(() => {
  storage = createHostStorageFake();
  setHostStorage(storage);
});

afterEach(cleanup);

describe('the execution-places record', () => {
  it('reads an absent entry as Automatic and clears by removing the entry', () => {
    expect(readExecutionPlace(undefined, 'req-1')).toBeUndefined();
    const set = withExecutionPlace(undefined, 'req-1', 'workspace-server');
    expect(readExecutionPlace(set, 'req-1')).toBe('workspace-server');
    expect(withExecutionPlace(set, 'req-1', undefined)).toEqual({});
  });

  it('composes the place onto an entity and splits it back off the updates', () => {
    const entity = { uid: 'req-1', url: 'https://api.openheaders.io' };
    expect(withLocalPlace(entity, 'desktop-app')).toEqual({ ...entity, executionPlace: 'desktop-app' });
    expect(withLocalPlace(entity, undefined)).toEqual(entity);
    expect(splitLocalPlace({ url: 'https://api.openheaders.io', executionPlace: 'here' as const })).toEqual({
      executionPlace: 'here',
      entityUpdates: { url: 'https://api.openheaders.io' },
    });
  });
});

describe('useRequestExecutionPlaces', () => {
  it('reads the scope slot, follows it live, and writes one request without dropping another', async () => {
    const key = wsKeys('ws-1').executionPlaces;
    storage.map.set(key.key, { 'req-a': 'workspace-server' });
    const { result } = renderHook(() => useRequestExecutionPlaces('ws-1'));
    await waitFor(() => expect(result.current.placeOf('req-a')).toBe('workspace-server'));
    expect(result.current.placeOf('req-b')).toBeUndefined();

    await act(async () => {
      await result.current.setPlace('req-b', 'desktop-app');
    });
    expect(storage.map.get(key.key)).toEqual({ 'req-a': 'workspace-server', 'req-b': 'desktop-app' });
    expect(result.current.placeOf('req-b')).toBe('desktop-app');

    await act(async () => {
      await result.current.setPlace('req-a', undefined);
    });
    expect(storage.map.get(key.key)).toEqual({ 'req-b': 'desktop-app' });

    // Another tab's write lands through the subscription.
    await act(async () => {
      await storage.set(key, { 'req-b': 'here' });
    });
    expect(result.current.placeOf('req-b')).toBe('here');
  });

  it('reads as empty and refuses writes without a scope', async () => {
    const { result } = renderHook(() => useRequestExecutionPlaces(null));
    expect(result.current.placeOf('req-a')).toBeUndefined();
    await act(async () => {
      await result.current.setPlace('req-a', 'here');
    });
    expect(storage.map.size).toBe(0);
  });
});
