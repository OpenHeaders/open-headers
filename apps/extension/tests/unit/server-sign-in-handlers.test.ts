/**
 * The service worker's `oh.serverSignIn.*` channels (the client sign-in
 * plan §14.9) — the five verbs relayed onto the host's one core client,
 * and the identity API bound as the code grant's user agent: the
 * registered `/callback` on the browser's redirect origin, the flow's
 * window resolving with the redirect, a closed window rejecting.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  available: true,
  redirectBase: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/',
  launchWebAuthFlow: vi.fn<(options: { url: string; interactive: boolean }) => Promise<string | null>>(),
}));

vi.mock('@utils/browser-api', () => ({
  identity: {
    isAvailable: () => fake.available,
    getRedirectURL: (path: string) => `${fake.redirectBase}${path}`,
    launchWebAuthFlow: fake.launchWebAuthFlow,
  },
}));
vi.mock('@/utils/self-host-label', () => ({ selfHostLabel: () => 'Chrome · macOS' }));

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import {
  createServerSignInHandlers,
  identityUserAgent,
} from '@/background/modules/message-handler/handlers/server-sign-in';
import type { HandlerArgs, HandlerMap } from '@/background/modules/message-handler/types';

function makeClient(): ServerSignInApi & { [K in keyof ServerSignInApi]: ReturnType<typeof vi.fn> } {
  return {
    start: vi.fn(async () => ({ ok: true as const, kind: 'redirect' as const, handle: 'h', expiresAt: 1 })),
    poll: vi.fn(async () => ({ status: 'pending' as const, retryAfterMs: 1000 })),
    cancel: vi.fn(async () => undefined),
    signOut: vi.fn(async () => ({ ok: true })),
    fetchMeta: vi.fn(async () => ({ enabled: true })),
  };
}

async function invoke(handlers: HandlerMap, type: string, message: Record<string, unknown>): Promise<unknown> {
  const respond = vi.fn();
  const kept = handlers[type]({
    message: { type, ...message },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: {},
  } as unknown as HandlerArgs);
  expect(kept).toBe(true);
  await vi.waitFor(() => expect(respond).toHaveBeenCalled());
  return respond.mock.calls[0][0];
}

beforeEach(() => {
  fake.available = true;
  fake.launchWebAuthFlow.mockReset();
});

describe('the serverSignIn channels', () => {
  it("relays start with the caller's label, poll, cancel, signOut and the meta read onto the client", async () => {
    const client = makeClient();
    const handlers = createServerSignInHandlers(() => client);

    expect(await invoke(handlers, 'oh.serverSignIn.start', { url: 'ws://10.0.0.5:8137' })).toEqual({
      ok: true,
      kind: 'redirect',
      handle: 'h',
      expiresAt: 1,
    });
    expect(client.start).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137' });
    await invoke(handlers, 'oh.serverSignIn.start', { url: 'ws://10.0.0.5:8137', deviceLabel: 'Work laptop' });
    expect(client.start).toHaveBeenLastCalledWith({ url: 'ws://10.0.0.5:8137', deviceLabel: 'Work laptop' });

    expect(await invoke(handlers, 'oh.serverSignIn.poll', { handle: 'h' })).toEqual({
      status: 'pending',
      retryAfterMs: 1000,
    });
    expect(client.poll).toHaveBeenCalledWith({ handle: 'h' });

    expect(await invoke(handlers, 'oh.serverSignIn.cancel', { handle: 'h' })).toEqual({ ok: true });
    expect(client.cancel).toHaveBeenCalledWith({ handle: 'h' });

    expect(await invoke(handlers, 'oh.serverSignIn.signOut', { url: 'ws://10.0.0.5:8137', token: 'oh_s' })).toEqual({
      ok: true,
    });
    expect(client.signOut).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', token: 'oh_s' });

    expect(
      await invoke(handlers, 'oh.serverSignIn.meta', { url: 'ws://10.0.0.5:8137', path: '/auth/oidc/meta' }),
    ).toEqual({
      payload: { enabled: true },
    });
    expect(client.fetchMeta).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', path: '/auth/oidc/meta' });
  });

  it('answers the honest fallback when the client throws', async () => {
    const client = makeClient();
    client.start.mockRejectedValue(new Error('boom'));
    client.poll.mockRejectedValue(new Error('boom'));
    client.fetchMeta.mockRejectedValue(new Error('boom'));
    const handlers = createServerSignInHandlers(() => client);
    expect(await invoke(handlers, 'oh.serverSignIn.start', { url: 'x' })).toEqual({ ok: false, reason: 'error' });
    expect(await invoke(handlers, 'oh.serverSignIn.poll', { handle: 'h' })).toEqual({ status: 'offline' });
    expect(await invoke(handlers, 'oh.serverSignIn.meta', { url: 'x', path: '/p' })).toEqual({ payload: null });
  });
});

describe('identityUserAgent', () => {
  it('is the registered callback on the identity redirect origin and the flow window, when the API exists', async () => {
    const agent = identityUserAgent();
    if (agent === null) throw new Error('no user agent');
    expect(agent.redirectUri()).toBe('https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/callback');

    fake.launchWebAuthFlow.mockResolvedValueOnce(
      'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/callback?code=c&state=s',
    );
    await expect(agent.launch('http://10.0.0.5:8137/auth/oauth/authorize?x', 's')).resolves.toBe(
      'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/callback?code=c&state=s',
    );
    expect(fake.launchWebAuthFlow).toHaveBeenCalledWith({
      url: 'http://10.0.0.5:8137/auth/oauth/authorize?x',
      interactive: true,
    });

    fake.launchWebAuthFlow.mockResolvedValueOnce(null);
    await expect(agent.launch('http://10.0.0.5:8137/auth/oauth/authorize', 's')).rejects.toThrow(
      'the authorization window closed before the redirect',
    );
  });

  it('is absent without the identity API — the client then runs the device grant', () => {
    fake.available = false;
    expect(identityUserAgent()).toBeNull();
  });
});
