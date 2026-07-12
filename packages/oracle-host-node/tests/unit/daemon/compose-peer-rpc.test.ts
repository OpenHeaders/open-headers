/**
 * Peer-RPC composition — ownership is the union of the planes, and a
 * dispatch lands on the plane that owns the channel (first match in
 * argument order).
 */

import { describe, expect, it } from 'vitest';
import { composePeerRpc } from '../../../src/daemon/compose-peer-rpc';

const PEER = { userId: 'user-1' };

function plane(channels: string[], answer: string) {
  return {
    owns: (type: string) => channels.includes(type),
    dispatch: async () => answer,
  };
}

describe('composePeerRpc', () => {
  it('owns the union of its planes', () => {
    const composed = composePeerRpc(plane(['a'], 'A'), plane(['b'], 'B'));
    expect(composed.owns('a')).toBe(true);
    expect(composed.owns('b')).toBe(true);
    expect(composed.owns('c')).toBe(false);
  });

  it('dispatches to the owning plane', async () => {
    const composed = composePeerRpc(plane(['a'], 'A'), plane(['b'], 'B'));
    await expect(composed.dispatch({ type: 'a' }, PEER)).resolves.toBe('A');
    await expect(composed.dispatch({ type: 'b' }, PEER)).resolves.toBe('B');
  });

  it('fails loudly on a channel no plane owns', async () => {
    const composed = composePeerRpc(plane(['a'], 'A'));
    await expect(composed.dispatch({ type: 'zz' }, PEER)).rejects.toThrow("peer-rpc: no plane owns 'zz'");
  });
});
