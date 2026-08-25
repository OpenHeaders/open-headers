/**
 * F5b — public-view mode detection and the viewer's throwaway memory
 * host storage (origin-IDB isolation + the cipher-less sensitive-slot
 * refusal every web-tier host shares).
 */

import { storageKey } from '@openheaders/core/storage';
import { describe, expect, it } from 'vitest';
import { MemoryHostStorage } from '../../src/host/memory-host-storage';
import { publicViewWorkspaceId } from '../../src/host/public-view';

describe('publicViewWorkspaceId', () => {
  it('matches only the public page path', () => {
    expect(publicViewWorkspaceId('/public/ws-1')).toBe('ws-1');
    expect(publicViewWorkspaceId('/public/ws-1/')).toBe('ws-1');
    // The payload path belongs to the fetch, not the mount decision.
    expect(publicViewWorkspaceId('/public/ws-1/snapshot.json')).toBeNull();
    expect(publicViewWorkspaceId('/')).toBeNull();
    expect(publicViewWorkspaceId('/workbench')).toBeNull();
    expect(publicViewWorkspaceId('/public/')).toBeNull();
  });
});

describe('MemoryHostStorage', () => {
  const plain = storageKey<string>('test.plain');
  const secret = storageKey<string>('test.secret', 'local', true);

  it('round-trips plain slots and fires subscriptions', async () => {
    const storage = new MemoryHostStorage();
    const seen: Array<string | undefined> = [];
    const unsubscribe = storage.subscribe(plain, (next) => seen.push(next));
    await storage.set(plain, 'value');
    expect(await storage.get(plain)).toBe('value');
    await storage.remove(plain);
    expect(await storage.get(plain)).toBeUndefined();
    expect(seen).toEqual(['value', undefined]);
    unsubscribe();
  });

  it('refuses sensitive writes and reads them as absent', async () => {
    const storage = new MemoryHostStorage();
    await expect(storage.set(secret, 'oh-secret')).rejects.toThrow(/refusing to write sensitive slot/);
    expect(await storage.get(secret)).toBeUndefined();
  });
});
