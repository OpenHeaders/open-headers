/**
 * SPA side of the SSO login contract — fragment consumption (one-shot,
 * history-stripped), the meta probe's JSON-only detection (a daemon
 * without OIDC answers the path with app HTML via the SPA fallback),
 * and the claim-code → session-token swap.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslator } from '@openheaders/i18n';
import { claimOidcToken, consumeOidcHash, fetchOidcMeta, oidcErrorKey } from '@/host/oidc-login';

function stubFetch(response: { status?: number; contentType?: string; body?: unknown }): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status ?? 200,
      headers: { 'content-type': response.contentType ?? 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('consumeOidcHash', () => {
  it('consumes a claim fragment and strips it from the URL', () => {
    const replaced: string[] = [];
    const result = consumeOidcHash({ hash: '#oidc=abc%2Fdef' }, (url) => replaced.push(url));
    expect(result).toEqual({ kind: 'claim', code: 'abc/def' });
    expect(replaced).toEqual(['/']);
  });

  it('consumes an error fragment', () => {
    const replaced: string[] = [];
    const result = consumeOidcHash({ hash: '#oidc-error=unknown-user' }, (url) => replaced.push(url));
    expect(result).toEqual({ kind: 'error', reason: 'unknown-user' });
    expect(replaced).toEqual(['/']);
  });

  it('leaves unrelated hashes alone', () => {
    const replaced: string[] = [];
    expect(consumeOidcHash({ hash: '' }, (url) => replaced.push(url))).toBeNull();
    expect(consumeOidcHash({ hash: '#some-anchor' }, (url) => replaced.push(url))).toBeNull();
    expect(replaced).toEqual([]);
  });
});

describe('fetchOidcMeta', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports enabled from a JSON meta answer', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { enabled: true, provider: 'ACME SSO' } }));
    expect(await fetchOidcMeta()).toEqual({ enabled: true, provider: 'ACME SSO' });
  });

  it('treats an HTML answer (SPA fallback on a no-OIDC daemon) as disabled', async () => {
    vi.stubGlobal('fetch', stubFetch({ contentType: 'text/html', body: '<!doctype html>' }));
    expect(await fetchOidcMeta()).toEqual({ enabled: false });
  });

  it('treats an unreachable daemon as disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await fetchOidcMeta()).toEqual({ enabled: false });
  });
});

describe('claimOidcToken', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the secret on a 200 ok answer', async () => {
    vi.stubGlobal('fetch', stubFetch({ body: { ok: true, secret: 'oh_session' } }));
    expect(await claimOidcToken('claim-code')).toBe('oh_session');
  });

  it('returns null on a spent/unknown code (404)', async () => {
    vi.stubGlobal('fetch', stubFetch({ status: 404, body: { ok: false } }));
    expect(await claimOidcToken('claim-code')).toBeNull();
  });
});

describe('oidcErrorKey', () => {
  it('maps every refusal reason to its own message key', () => {
    expect(oidcErrorKey('unknown-user')).toBe('web.oidcError.unknownUser');
    expect(oidcErrorKey('user-deactivated')).toBe('web.oidcError.userDeactivated');
    expect(oidcErrorKey('email-unverified')).toBe('web.oidcError.emailUnverified');
    expect(oidcErrorKey('provider-unavailable')).toBe('web.oidcError.providerUnavailable');
    expect(oidcErrorKey('seat-limit-reached')).toBe('web.oidcError.seatLimitReached');
    expect(oidcErrorKey('personal-seats-disabled')).toBe('web.oidcError.personalSeatsDisabled');
    expect(oidcErrorKey('personal-license-invalid')).toBe('web.oidcError.personalLicenseInvalid');
    expect(oidcErrorKey('personal-license-identity-mismatch')).toBe('web.oidcError.personalLicenseIdentityMismatch');
    expect(oidcErrorKey('personal-license-no-identity')).toBe('web.oidcError.personalLicenseNoIdentity');
  });

  it('falls back to the generic SSO-failed line, including claim failures', () => {
    expect(oidcErrorKey('anything-else')).toBe('web.oidcError.failed');
    expect(oidcErrorKey('rejected')).toBe('web.oidcError.failed');
    expect(oidcErrorKey('unknown')).toBe('web.oidcError.failed');
  });

  it('resolves to the exact English sentences', () => {
    const t = getTranslator('en');
    expect(t(oidcErrorKey('unknown-user'))).toBe(
      'Signed in, but this daemon has no user for your email. Ask the daemon admin to add you.',
    );
    expect(t(oidcErrorKey('seat-limit-reached'))).toBe(
      'Signed in, but this daemon has no free seats for a new user. Ask the daemon admin — or get in now with your own individual seat.',
    );
    expect(t(oidcErrorKey('anything-else'))).toBe('Single sign-on failed. Try again, or connect with a pairing token instead.');
  });
});
