/**
 * The admin console's peer-execute switch (`oh.daemon.peerExecute.get`
 * / `.set`) — the egress opt-in's remote tier read as its effective
 * value and written to the settings record through the gate's own
 * seam; a non-boolean write is refused in band.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdminChannels } from './_admin-channels-rig';

describe('oh.daemon.peerExecute.*', () => {
  it('get answers the gate’s effective value; set writes through it and answers ok', async () => {
    let remote = true;
    const writes: boolean[] = [];
    const table = buildAdminChannels({
      peerExecute: {
        read: async () => ({ remote, hostKind: 'daemon' as const }),
        setRemote: async (value) => {
          writes.push(value);
          remote = value;
        },
      },
    });
    const get = table.get('oh.daemon.peerExecute.get');
    const set = table.get('oh.daemon.peerExecute.set');
    if (!get || !set) throw new Error('channel missing');

    expect(await get({})).toEqual({ remote: true, hostKind: 'daemon' });
    expect(await set({ remote: false })).toEqual({ ok: true });
    expect(writes).toEqual([false]);
    expect(await get({})).toEqual({ remote: false, hostKind: 'daemon' });
  });

  it('set refuses a non-boolean without touching the record', async () => {
    const writes: boolean[] = [];
    const table = buildAdminChannels({
      peerExecute: {
        read: async () => ({ remote: true, hostKind: 'daemon' as const }),
        setRemote: async (value) => {
          writes.push(value);
        },
      },
    });
    const set = table.get('oh.daemon.peerExecute.set');
    if (!set) throw new Error('channel missing');

    expect(await set({ remote: 'no' })).toEqual({ ok: false, error: 'remote must be a boolean' });
    expect(writes).toEqual([]);
  });
});
