/**
 * The `session_start` scale-of-use buckets read the slot the popup
 * writes: the runtime-active workspace's rule projection
 * (`wsKeys(runtimeActive).rules`, the rule cache's storage key) and the
 * extension workspace list (S31 pin — the zero-rules majority is a
 * measurement of that slot, not of a stale one).
 */

import { type HostStorage, OH, setHostStorage, wsKeys } from '@openheaders/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  const fake: Partial<HostStorage> = {
    get: vi.fn(async (spec: { key: string }) => store[spec.key]) as HostStorage['get'],
  };
  setHostStorage(fake as HostStorage);
});

async function loadModule() {
  return import('../../src/background/modules/product-telemetry');
}

describe('readScaleBuckets', () => {
  it('buckets the runtime-active workspace rule projection and the workspace list', async () => {
    const { readScaleBuckets } = await loadModule();
    store[OH.workspaces.key] = [{ id: 'ws-a' }, { id: 'ws-b' }];
    store[OH.runtimeActive.key] = 'ws-b';
    store[wsKeys('ws-a').rules.key] = [{ id: 'r1' }];
    store[wsKeys('ws-b').rules.key] = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
    expect(await readScaleBuckets()).toEqual({ rules: '2-5', workspaces: '2-5' });
  });

  it('falls back to the first listed workspace when no runtime-active pointer exists', async () => {
    const { readScaleBuckets } = await loadModule();
    store[OH.workspaces.key] = [{ id: 'ws-a' }];
    store[wsKeys('ws-a').rules.key] = [{ id: 'r1' }];
    expect(await readScaleBuckets()).toEqual({ rules: '1', workspaces: '1' });
  });

  it('reads zeros on an empty store rather than omitting the buckets', async () => {
    const { readScaleBuckets } = await loadModule();
    expect(await readScaleBuckets()).toEqual({ rules: '0', workspaces: '0' });
  });
});
