/**
 * The desktop's main-process `oh.backendIdentity.accept` plane — the
 * one channel relayed onto the shared client-plane accept, which
 * re-dials the record's wire from this process (the renderer holds no
 * wire). The accept itself is pinned where the client plane lives.
 */

import { describe, expect, it, vi } from 'vitest';
import { createBackendIdentityRpc } from '../../../src/main/backend-identity';

describe('desktop backendIdentity rpc', () => {
  it('answers only its own channel', () => {
    const plane = createBackendIdentityRpc({ accept: vi.fn(async () => ({ reconnected: true })) });
    expect(plane.dispatch('oh.backendProbe', {})).toBeUndefined();
    expect(plane.dispatch('oh.serverSignIn.start', {})).toBeUndefined();
  });

  it('relays the record id to the accept and answers its result', async () => {
    const accept = vi.fn(async () => ({ reconnected: true }));
    const plane = createBackendIdentityRpc({ accept });
    expect(await plane.dispatch('oh.backendIdentity.accept', { backendId: 'backend-a' })).toEqual({
      reconnected: true,
    });
    expect(accept).toHaveBeenCalledWith('backend-a');
  });

  it('answers a record with no live wire as not reconnected', async () => {
    const plane = createBackendIdentityRpc({ accept: vi.fn(async () => ({ reconnected: false })) });
    expect(await plane.dispatch('oh.backendIdentity.accept', { backendId: 'backend-a' })).toEqual({
      reconnected: false,
    });
  });
});
