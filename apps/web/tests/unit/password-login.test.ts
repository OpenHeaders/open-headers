/**
 * SPA side of the local password login contract — the meta probe's
 * JSON-only detection (a daemon with OIDC, or none serving, answers the
 * path with app HTML via the SPA fallback) and the credentials →
 * session-token swap with its uniform refusal.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPasswordMeta, submitPasswordLogin } from '@/host/password-login';

beforeAll(() => {
  setHostLogger(consoleLogger);
});

function stubFetch(response: { status?: number; contentType?: string; body?: unknown }): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status ?? 200,
      headers: { 'content-type': response.contentType ?? 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('fetchPasswordMeta', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports enabled from a JSON meta answer', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { enabled: true } }));
    expect(await fetchPasswordMeta()).toEqual({ enabled: true });
  });

  it('treats an HTML answer (SPA fallback when the route is not composed) as disabled', async () => {
    vi.stubGlobal('fetch', stubFetch({ contentType: 'text/html', body: '<!doctype html>' }));
    expect(await fetchPasswordMeta()).toEqual({ enabled: false });
  });

  it('treats an unreachable daemon as disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await fetchPasswordMeta()).toEqual({ enabled: false });
  });
});

describe('submitPasswordLogin', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the secret on a 200 ok answer', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { ok: true, secret: 'oh_session' } }));
    expect(await submitPasswordLogin('alice@openheaders.io', 'pw')).toBe('oh_session');
  });

  it('returns null on the uniform 401 refusal', async () => {
    vi.stubGlobal('fetch', stubFetch({ status: 401, body: { ok: false } }));
    expect(await submitPasswordLogin('alice@openheaders.io', 'wrong')).toBeNull();
  });

  it('returns null when the daemon is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await submitPasswordLogin('alice@openheaders.io', 'pw')).toBeNull();
  });
});
