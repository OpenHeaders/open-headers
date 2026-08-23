/**
 * SPA side of the server claim — the meta probe's fail-towards-claimed
 * guard (a create-the-admin form must never appear on a server that
 * already has one), the claim POST's success/refusal split, and where
 * each typed 400 lands on the form.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSetupMeta, setupClaimInvalidError, submitSetupClaim } from '@/host/setup-claim';

beforeAll(() => {
  setHostLogger(consoleLogger);
});

const CLAIM = { displayName: 'John Doe', email: 'john@openheaders.io', password: 'claim-pass-2026', code: '' };

function stubFetch(response: { status?: number; contentType?: string; body?: unknown }): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status ?? 200,
      headers: { 'content-type': response.contentType ?? 'application/json' },
    });
  }) as unknown as typeof fetch;
}

function stubUnreachable(): typeof fetch {
  return vi.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSetupMeta', () => {
  it('reports an open claim, and whether the remote path needs the code', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { unclaimed: true, requiresCode: true } }));
    expect(await fetchSetupMeta()).toEqual({ unclaimed: true, requiresCode: true });
  });

  it('reports a claimed server', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { unclaimed: false, requiresCode: false } }));
    expect(await fetchSetupMeta()).toEqual({ unclaimed: false, requiresCode: false });
  });

  it('treats an HTML answer (the SPA fallback under an auth URL) as claimed', async () => {
    vi.stubGlobal('fetch', stubFetch({ contentType: 'text/html', body: '<!doctype html>' }));
    expect(await fetchSetupMeta()).toEqual({ unclaimed: false, requiresCode: false });
  });

  it('treats an unreachable server as claimed', async () => {
    vi.stubGlobal('fetch', stubUnreachable());
    expect(await fetchSetupMeta()).toEqual({ unclaimed: false, requiresCode: false });
  });
});

describe('submitSetupClaim', () => {
  it('returns the session secret and the count of pairings the claim revoked', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { ok: true, secret: 'oh_session', revokedTokens: 2 } }));
    expect(await submitSetupClaim(CLAIM)).toEqual({ ok: true, secret: 'oh_session', revokedTokens: 2 });
  });

  it('reads a missing revokedTokens as none revoked', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { ok: true, secret: 'oh_session' } }));
    expect(await submitSetupClaim(CLAIM)).toEqual({ ok: true, secret: 'oh_session', revokedTokens: 0 });
  });

  it('carries a typed 400 through verbatim', async () => {
    vi.stubGlobal('fetch', stubFetch({ status: 400, body: { ok: false, reason: 'password-too-short' } }));
    expect(await submitSetupClaim(CLAIM)).toEqual({ ok: false, kind: 'invalid', reason: 'password-too-short' });
  });

  it('reads a 400 the form does not know as a body the route could not compose', async () => {
    vi.stubGlobal('fetch', stubFetch({ status: 400, body: { ok: false, reason: 'something-new' } }));
    expect(await submitSetupClaim(CLAIM)).toEqual({ ok: false, kind: 'invalid', reason: 'malformed-request' });
  });

  it('reads the uniform 403 as refused, whatever the state behind it', async () => {
    vi.stubGlobal('fetch', stubFetch({ status: 403, body: { ok: false } }));
    expect(await submitSetupClaim(CLAIM)).toEqual({ ok: false, kind: 'refused' });
  });

  it('reads an unreachable server as offline, never as refused', async () => {
    vi.stubGlobal('fetch', stubUnreachable());
    expect(await submitSetupClaim(CLAIM)).toEqual({ ok: false, kind: 'offline' });
  });

  it('sends the code only when one was typed, and trimmed', async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, secret: 's' }), { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', spy);
    const sentBody = (call: unknown[] | undefined): Record<string, unknown> =>
      JSON.parse(String((call?.[1] as RequestInit | undefined)?.body ?? '{}')) as Record<string, unknown>;

    await submitSetupClaim(CLAIM);
    const bare = sentBody(spy.mock.calls[0]);
    expect(bare).not.toHaveProperty('code');
    expect(bare).toMatchObject({ displayName: 'John Doe', email: 'john@openheaders.io' });

    await submitSetupClaim({ ...CLAIM, code: '  4821-9930  ' });
    expect(sentBody(spy.mock.calls[1]).code).toBe('4821-9930');
  });
});

describe('setupClaimInvalidError', () => {
  it('sends each field reason to the field it names', () => {
    expect(setupClaimInvalidError('display-name-required').field).toBe('displayName');
    expect(setupClaimInvalidError('email-required').field).toBe('email');
    expect(setupClaimInvalidError('password-too-short').field).toBe('password');
  });

  it('sends an unreadable body to the card, which has no field to blame', () => {
    expect(setupClaimInvalidError('malformed-request').field).toBeNull();
  });
});
