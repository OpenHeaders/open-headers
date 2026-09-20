/**
 * The extension's `serverSignIn` capability (the client sign-in plan
 * §7) — the core wire client bound to the page's own fetch. The wire
 * itself is pinned in core; here the binding: the start names this
 * client kind, rides the page-side fetch (the extension's origin, no
 * relay), and the poll carries the handle as the bearer.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExtensionServerSignIn } from '@/host/server-sign-in';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createExtensionServerSignIn', () => {
  it('starts a pair as the extension over the page-side fetch', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        code: '424242',
        pollToken: 'h',
        expiresAt: 1,
        approveUrl: 'http://10.0.0.5:8137/pair/424242',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createExtensionServerSignIn().start({ url: 'ws://10.0.0.5:8137' });

    expect(result).toEqual({
      ok: true,
      code: '424242',
      pollToken: 'h',
      expiresAt: 1,
      approveUrl: 'http://10.0.0.5:8137/pair/424242',
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://10.0.0.5:8137/pair');
    expect(JSON.parse(init.body as string)).toEqual({ client: 'extension' });
  });

  it('polls the handle as the bearer and hands the approved secret through', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'approved', secret: 'oh_s', tokenId: 'tid' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createExtensionServerSignIn().poll({ url: 'ws://10.0.0.5:8137', pollToken: 'handle-1' });

    expect(result).toEqual({ status: 'approved', secret: 'oh_s', tokenId: 'tid' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://10.0.0.5:8137/pair/poll');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer handle-1' });
  });

  it('reads the gate meta as JSON from the back-end origin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ enabled: true, provider: 'Okta' })),
    );
    expect(
      await createExtensionServerSignIn().fetchMeta({ url: 'ws://10.0.0.5:8137', path: '/auth/oidc/meta' }),
    ).toEqual({ enabled: true, provider: 'Okta' });
  });
});
