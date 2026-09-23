/**
 * The desktop's main-process `serverSignIn` plane (the client sign-in
 * plan §14.9, F0-b) — the five `oh.serverSignIn.*` channels relayed
 * onto the core client, the machine name as the device label unless the
 * caller names one. The grants themselves are pinned in core; the
 * spine's browser hop is the user agent the live client is built over.
 */

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import { describe, expect, it, vi } from 'vitest';
import { createServerSignInRpc } from '../../../src/main/server-sign-in';

function makeRig(overrides: Partial<ServerSignInApi> = {}) {
  const client: ServerSignInApi = {
    start: vi.fn(async () => ({ ok: true as const, kind: 'redirect' as const, handle: 'h', expiresAt: 1 })),
    poll: vi.fn(async () => ({ status: 'pending' as const, retryAfterMs: 1000 })),
    cancel: vi.fn(async () => undefined),
    signOut: vi.fn(async () => ({ ok: true })),
    fetchMeta: vi.fn(async () => ({ enabled: true })),
    ...overrides,
  };
  const plane = createServerSignInRpc({
    userAgent: { redirectUri: () => 'http://127.0.0.1:8137/oauth/callback', launch: async () => '' },
    client,
    deviceLabel: () => 'Daniels-MacBook-Pro',
  });
  return { plane, client };
}

describe('desktop serverSignIn rpc', () => {
  it('answers only its own channels', () => {
    const { plane } = makeRig();
    expect(plane.dispatch('oh.updates.getState', {})).toBeUndefined();
    expect(plane.dispatch('oauthAuthorize', {})).toBeUndefined();
  });

  it('starts the grant as the desktop client, named by the machine unless the caller names it', async () => {
    const { plane, client } = makeRig();
    const result = await plane.dispatch('oh.serverSignIn.start', { url: 'ws://10.0.0.5:8137' });
    expect(result).toEqual({ ok: true, kind: 'redirect', handle: 'h', expiresAt: 1 });
    expect(client.start).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', deviceLabel: 'Daniels-MacBook-Pro' });
    await plane.dispatch('oh.serverSignIn.start', { url: 'ws://10.0.0.5:8137', deviceLabel: 'Work Mac' });
    expect(client.start).toHaveBeenLastCalledWith({ url: 'ws://10.0.0.5:8137', deviceLabel: 'Work Mac' });
  });

  it('relays poll, cancel and signOut on the handle and the credential', async () => {
    const poll = vi
      .fn<ServerSignInApi['poll']>()
      .mockResolvedValueOnce({ status: 'pending', retryAfterMs: 1000 })
      .mockResolvedValueOnce({ status: 'approved', secret: 'oh_s' });
    const { plane, client } = makeRig({ poll });

    expect(await plane.dispatch('oh.serverSignIn.poll', { handle: 'h' })).toEqual({
      status: 'pending',
      retryAfterMs: 1000,
    });
    expect(await plane.dispatch('oh.serverSignIn.poll', { handle: 'h' })).toEqual({
      status: 'approved',
      secret: 'oh_s',
    });
    expect(poll).toHaveBeenCalledWith({ handle: 'h' });

    expect(await plane.dispatch('oh.serverSignIn.cancel', { handle: 'h' })).toEqual({ ok: true });
    expect(client.cancel).toHaveBeenCalledWith({ handle: 'h' });

    expect(await plane.dispatch('oh.serverSignIn.signOut', { url: 'ws://10.0.0.5:8137', token: 'oh_s' })).toEqual({
      ok: true,
    });
    expect(client.signOut).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', token: 'oh_s' });
  });

  it('reads the gate meta through the client and wraps the payload', async () => {
    const { plane, client } = makeRig();
    expect(
      await plane.dispatch('oh.serverSignIn.meta', { url: 'ws://10.0.0.5:8137', path: '/auth/password/meta' }),
    ).toEqual({ payload: { enabled: true } });
    expect(client.fetchMeta).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', path: '/auth/password/meta' });
  });
});
