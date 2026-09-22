/**
 * The desktop's main-process `serverSignIn` plane (the client sign-in
 * plan §7, F0-b) — the three `oh.serverSignIn.*` channels over the core
 * wire client, and the one desktop act: an approved poll fronts the app.
 * The wire itself is pinned in core; the client is injected here.
 */

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import { describe, expect, it, vi } from 'vitest';
import { createServerSignInRpc } from '../../../src/main/server-sign-in';

function makeRig(overrides: Partial<ServerSignInApi> = {}) {
  const revealed: number[] = [];
  const client: ServerSignInApi = {
    start: vi.fn(async () => ({
      ok: true as const,
      code: '424242',
      pollToken: 'h',
      expiresAt: 1,
      approveUrl: 'http://10.0.0.5:8137/pair/424242',
    })),
    poll: vi.fn(async () => ({ status: 'pending' as const, expiresAt: null })),
    fetchMeta: vi.fn(async () => ({ enabled: true })),
    ...overrides,
  };
  const plane = createServerSignInRpc({
    client,
    revealApp: () => revealed.push(1),
    deviceLabel: () => 'Daniels-MacBook-Pro',
  });
  return { plane, client, revealed };
}

describe('desktop serverSignIn rpc', () => {
  it('answers only its own channels', () => {
    const { plane } = makeRig();
    expect(plane.dispatch('oh.updates.getState', {})).toBeUndefined();
    expect(plane.dispatch('oauthDeviceStart', {})).toBeUndefined();
  });

  it('starts a pair as the desktop client, named by the machine unless the caller names it', async () => {
    const { plane, client } = makeRig();
    const result = await plane.dispatch('oh.serverSignIn.start', { url: 'ws://10.0.0.5:8137' });
    expect(result).toMatchObject({ ok: true, code: '424242' });
    expect(client.start).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', deviceLabel: 'Daniels-MacBook-Pro' });
    await plane.dispatch('oh.serverSignIn.start', { url: 'ws://10.0.0.5:8137', deviceLabel: 'Work Mac' });
    expect(client.start).toHaveBeenLastCalledWith({ url: 'ws://10.0.0.5:8137', deviceLabel: 'Work Mac' });
  });

  it('polls the handle and fronts the app exactly when the approval lands', async () => {
    const poll = vi
      .fn<ServerSignInApi['poll']>()
      .mockResolvedValueOnce({ status: 'pending', expiresAt: 5 })
      .mockResolvedValueOnce({ status: 'approved', secret: 'oh_s', tokenId: 'tid' })
      .mockResolvedValueOnce({ status: 'denied' });
    const { plane, revealed } = makeRig({ poll });
    const input = { url: 'ws://10.0.0.5:8137', pollToken: 'h' };

    expect(await plane.dispatch('oh.serverSignIn.poll', input)).toEqual({ status: 'pending', expiresAt: 5 });
    expect(revealed).toEqual([]);
    expect(await plane.dispatch('oh.serverSignIn.poll', input)).toEqual({
      status: 'approved',
      secret: 'oh_s',
      tokenId: 'tid',
    });
    expect(revealed).toEqual([1]);
    expect(await plane.dispatch('oh.serverSignIn.poll', input)).toEqual({ status: 'denied' });
    expect(revealed).toEqual([1]);
    expect(poll).toHaveBeenCalledWith(input);
  });

  it('reads the gate meta through the client and wraps the payload', async () => {
    const { plane, client } = makeRig();
    expect(
      await plane.dispatch('oh.serverSignIn.meta', { url: 'ws://10.0.0.5:8137', path: '/auth/password/meta' }),
    ).toEqual({ payload: { enabled: true } });
    expect(client.fetchMeta).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', path: '/auth/password/meta' });
  });
});
