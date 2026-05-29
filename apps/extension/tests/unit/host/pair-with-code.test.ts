/**
 * Coverage for the extension's `pairWithCode` capability (WS-A2) — the
 * code→token HTTP exchange against the daemon's JSON confirm route.
 *
 * The daemon side is exercised in oracle-host-node's `pairing-http`
 * suite; here we pin the client contract: URL derivation (ws→http), the
 * request shape (Accept/Content-Type JSON, deviceLabel body), and the
 * mapping of every daemon reason + transport fault onto the
 * `PairWithCodeResult` the UI consumes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { pairWithCode } from '@/host/pair-with-code';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pairWithCode (extension)', () => {
  it('exchanges a code for a token and maps secret→token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, secret: 'oh_abc', tokenId: 'tid-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await pairWithCode({ url: 'ws://127.0.0.1:8137', code: '424242', deviceLabel: 'Work Chrome' });

    expect(result).toEqual({ ok: true, token: 'oh_abc', tokenId: 'tid-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8137/pair/424242/confirm');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Accept: 'application/json', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ deviceLabel: 'Work Chrome' });
  });

  it('derives an https origin from a wss URL and omits an empty label', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, secret: 'oh_x', tokenId: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    await pairWithCode({ url: 'wss://host.example:9000', code: '111111' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://host.example:9000/pair/111111/confirm');
    expect(JSON.parse(init.body)).toEqual({});
  });

  it('maps each daemon reason through unchanged', async () => {
    for (const reason of ['unknown', 'expired', 'consumed'] as const) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: false, reason }, 410));
      vi.stubGlobal('fetch', fetchMock);
      const result = await pairWithCode({ url: 'ws://127.0.0.1:8137', code: '424242' });
      expect(result).toEqual({ ok: false, reason });
    }
  });

  it('reports unreachable when the fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await pairWithCode({ url: 'ws://127.0.0.1:8137', code: '424242' });
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('rejects a non-ws backend URL before dialing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await pairWithCode({ url: 'http://127.0.0.1:8137', code: '424242' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric code before dialing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await pairWithCode({ url: 'ws://127.0.0.1:8137', code: 'abc123' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports error on a non-JSON response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    const result = await pairWithCode({ url: 'ws://127.0.0.1:8137', code: '424242' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('error');
  });
});
