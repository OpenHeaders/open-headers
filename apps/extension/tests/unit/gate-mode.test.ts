/**
 * The shared gate-mode resolver (`@openheaders/ui/shared/backend`,
 * lifted out of the web tab by the client sign-in plan §7). Pins the
 * server's four states and their precedence — sso → setup → password
 * → no-login, exactly the server's own `gate-mode.ts` — over the one
 * seam every host binds its own way, and the fail-safe reading of a
 * null answer per route.
 */

import {
  OIDC_META_PATH,
  PASSWORD_META_PATH,
  parseOidcMeta,
  parsePasswordMeta,
  parseSetupMeta,
  resolveGateMode,
  SETUP_META_PATH,
} from '@openheaders/ui/shared/backend';
import { describe, expect, it, vi } from 'vitest';

/** Answer each route from one map; anything unlisted is the SPA fallback (null). */
function seam(answers: Record<string, unknown>): ReturnType<typeof vi.fn> & ((path: string) => Promise<unknown>) {
  return vi.fn(async (path: string) => answers[path] ?? null);
}

describe('resolveGateMode', () => {
  it('asks the three routes once each, in one round', async () => {
    const fetchJson = seam({});
    await resolveGateMode(fetchJson);
    expect(fetchJson.mock.calls.map(([path]) => path).sort()).toEqual(
      [OIDC_META_PATH, PASSWORD_META_PATH, SETUP_META_PATH].sort(),
    );
  });

  it('draws the setup state on an unclaimed server, carrying whether the code is asked for', async () => {
    expect(await resolveGateMode(seam({ [SETUP_META_PATH]: { unclaimed: true, requiresCode: true } }))).toEqual({
      kind: 'setup',
      requiresCode: true,
    });
  });

  it('draws the password state on a claimed server with a password holder', async () => {
    const fetchJson = seam({
      [SETUP_META_PATH]: { unclaimed: false, requiresCode: false },
      [PASSWORD_META_PATH]: { enabled: true },
    });
    expect(await resolveGateMode(fetchJson)).toEqual({ kind: 'password' });
  });

  it('puts the provider first when an IdP is configured, naming it generically when the server does not', async () => {
    expect(
      await resolveGateMode(
        seam({ [OIDC_META_PATH]: { enabled: true, provider: 'Okta' }, [SETUP_META_PATH]: { unclaimed: true } }),
      ),
    ).toEqual({ kind: 'sso', provider: 'Okta' });
    expect(await resolveGateMode(seam({ [OIDC_META_PATH]: { enabled: true } }))).toEqual({
      kind: 'sso',
      provider: 'SSO',
    });
  });

  it('reads a claimed server with neither as no-login, and every null answer the same way', async () => {
    expect(await resolveGateMode(seam({ [SETUP_META_PATH]: { unclaimed: false } }))).toEqual({ kind: 'no-login' });
    expect(await resolveGateMode(seam({}))).toEqual({ kind: 'no-login' });
  });
});

describe('the meta parsers fail towards the safe reading', () => {
  it('oidc: only a JSON enabled:true counts', () => {
    expect(parseOidcMeta(null)).toEqual({ enabled: false });
    expect(parseOidcMeta('<!doctype html>')).toEqual({ enabled: false });
    expect(parseOidcMeta({ enabled: 'yes' })).toEqual({ enabled: false });
    expect(parseOidcMeta({ enabled: true, provider: 7 })).toEqual({ enabled: true });
  });

  it('setup: never unclaimed on a null or foreign answer', () => {
    expect(parseSetupMeta(null)).toEqual({ unclaimed: false, requiresCode: false });
    expect(parseSetupMeta({ unclaimed: 'true' })).toEqual({ unclaimed: false, requiresCode: false });
    expect(parseSetupMeta({ unclaimed: true })).toEqual({ unclaimed: true, requiresCode: false });
  });

  it('password: disabled unless the answer says enabled', () => {
    expect(parsePasswordMeta(null)).toEqual({ enabled: false });
    expect(parsePasswordMeta({})).toEqual({ enabled: false });
    expect(parsePasswordMeta({ enabled: true })).toEqual({ enabled: true });
  });
});
