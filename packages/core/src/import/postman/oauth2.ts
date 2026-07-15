import type { AuthConfig } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop } from '../report';
import type { PostmanAuth } from './types';

// ── OAuth 2.0 auth import ───────────────────────────────────────────

/** How a vendor grant-type token lands on the product's OAuth2 config. */
type GrantDisposition =
  | {
      kind: 'flow';
      flow: 'authorization-code-pkce' | 'client-credentials' | 'device-code' | 'password-credentials';
      /** UI grant-type choice, persisted when the vendor grant needs a
       *  field-set distinction the flow alone doesn't carry (plain
       *  authorization-code rides the PKCE wire flow with the PKCE
       *  pair suppressed). */
      grantType?: 'authorization-code' | 'authorization-code-pkce';
    }
  | { kind: 'permanent-drop'; reason: string }
  | { kind: 'unknown' };

/**
 * Vendor grant-type tokens mapped onto the shipped flows. `implicit`
 * is a PERMANENT drop — removed by OAuth 2.1 (fragment-delivered
 * tokens, no refresh); genuinely unknown tokens keep the honest
 * `#todo-oauth-grants` note.
 */
function grantDispositionOf(grantType: string): GrantDisposition {
  if (grantType === 'authorization_code_with_pkce') {
    return { kind: 'flow', flow: 'authorization-code-pkce', grantType: 'authorization-code-pkce' };
  }
  if (grantType === 'authorization_code') {
    return { kind: 'flow', flow: 'authorization-code-pkce', grantType: 'authorization-code' };
  }
  if (grantType === 'client_credentials') return { kind: 'flow', flow: 'client-credentials' };
  if (grantType === 'password_credentials') return { kind: 'flow', flow: 'password-credentials' };
  if (/device/.test(grantType)) return { kind: 'flow', flow: 'device-code' };
  if (grantType === 'implicit') {
    return {
      kind: 'permanent-drop',
      reason:
        'OAuth 2.0 "implicit" grant not imported — removed by OAuth 2.1 (fragment-delivered tokens, no refresh). Migrate the provider config to Authorization Code with PKCE.',
    };
  }
  return { kind: 'unknown' };
}

/**
 * The vendor param keys the mapper consumes (or deliberately ignores).
 * Anything else carrying a value surfaces in one aggregate note so the
 * imported config is auditable — never silently thinner than the
 * source.
 */
const CONSUMED_KEYS: ReadonlySet<string> = new Set([
  'grant_type',
  'authUrl',
  'accessTokenUrl',
  'refreshTokenUrl',
  'clientId',
  'clientSecret',
  'username',
  'password',
  'scope',
  'addTokenTo',
  'client_authentication',
  'tokenName',
  'authRequestParams',
  'tokenRequestParams',
  'refreshRequestParams',
  // Runtime material the flow regenerates per run — lossless to ignore.
  'state',
]);

/** Postman stores oauth2 params as `[{key, value}]` (or a plain object
 *  in pre-v2.1 exports); values are usually strings but the advanced
 *  request-params entries carry arrays. Preserve the raw values. */
function rawParamMap(x: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (Array.isArray(x)) {
    for (const p of x) {
      if (p && typeof p === 'object' && typeof (p as { key?: unknown }).key === 'string') {
        map.set((p as { key: string }).key, (p as { value?: unknown }).value);
      }
    }
  } else if (x && typeof x === 'object') {
    for (const [key, value] of Object.entries(x as Record<string, unknown>)) map.set(key, value);
  }
  return map;
}

function stringOf(params: Map<string, unknown>, key: string): string | undefined {
  const value = params.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Advanced request-params rows (`[{key, value, enabled?}]`) → the
 *  schema's extra-params lists. Disabled rows stay behind. */
function extraParamsOf(raw: unknown): Array<{ uid: string; key: string; value: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows: Array<{ uid: string; key: string; value: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { key, value, enabled } = entry as { key?: unknown; value?: unknown; enabled?: unknown };
    if (typeof key !== 'string' || key === '' || enabled === false) continue;
    rows.push({ uid: generateUid(), key, value: typeof value === 'string' ? value : '' });
  }
  return rows.length > 0 ? rows : undefined;
}

/**
 * Map a vendor `auth.oauth2` config onto the first-class `oauth2`
 * AuthConfig for the shipped flows (authorization-code with or
 * without PKCE / client-credentials / device-code /
 * password-credentials). Returns `null` — with the reason recorded —
 * when the grant is `implicit` (permanent drop), unrecognized, or the
 * config is missing the endpoints the flow cannot run without.
 */
export function resolveOAuth2Auth(raw: PostmanAuth, authPath: string, report: ImportReport): AuthConfig | null {
  const params = rawParamMap(raw.oauth2);
  const grantType = stringOf(params, 'grant_type') ?? 'authorization_code';

  const disposition = grantDispositionOf(grantType);
  if (disposition.kind === 'permanent-drop') {
    recordDrop(report, {
      path: authPath,
      reason: disposition.reason,
      tracking: 'PERMANENT: OAuth 2.0 implicit grant',
    });
    return null;
  }
  if (disposition.kind === 'unknown') {
    recordDrop(report, {
      path: authPath,
      reason: `OAuth 2.0 "${grantType}" grant not imported — not a recognized grant type.`,
      tracking: '#todo-oauth-grants',
    });
    return null;
  }
  const { flow } = disposition;

  const tokenEndpoint = stringOf(params, 'accessTokenUrl');
  const clientId = stringOf(params, 'clientId');
  if (tokenEndpoint === undefined || clientId === undefined) {
    const missing = [
      ...(tokenEndpoint === undefined ? ['access token URL'] : []),
      ...(clientId === undefined ? ['client id'] : []),
    ].join(' + ');
    recordDrop(report, {
      path: authPath,
      reason: `OAuth 2.0 config not imported — the ${missing} is missing, and the flow cannot run without it.`,
      tracking: 'PERMANENT: OAuth 2.0 config completeness',
    });
    return null;
  }

  const authorizationEndpoint = stringOf(params, 'authUrl');
  const refreshTokenUrl = stringOf(params, 'refreshTokenUrl');
  const clientSecret = stringOf(params, 'clientSecret');
  const username = stringOf(params, 'username');
  const password = stringOf(params, 'password');
  const scope = stringOf(params, 'scope');
  const label = stringOf(params, 'tokenName');
  const addTokenTo = stringOf(params, 'addTokenTo');
  const clientAuthentication = stringOf(params, 'client_authentication');
  const extraAuthParams = extraParamsOf(params.get('authRequestParams'));
  const extraTokenParams = extraParamsOf(params.get('tokenRequestParams'));
  const extraRefreshParams = extraParamsOf(params.get('refreshRequestParams'));

  const leftovers = [...params.keys()].filter((key) => !CONSUMED_KEYS.has(key) && !isIgnorableDefault(params, key));
  if (leftovers.length > 0) {
    recordDrop(report, {
      path: `${authPath}.oauth2`,
      reason: `OAuth 2.0 parameter${leftovers.length === 1 ? '' : 's'} without a counterpart (${leftovers.join(', ')}) — review the imported config before the first send.`,
      tracking: '#todo-oauth-params',
    });
  }

  return {
    type: 'oauth2',
    credentialRef: generateUid(),
    flow,
    ...(disposition.grantType !== undefined ? { grantType: disposition.grantType } : {}),
    ...(authorizationEndpoint !== undefined ? { authorizationEndpoint } : {}),
    tokenEndpoint,
    ...(refreshTokenUrl !== undefined && refreshTokenUrl !== tokenEndpoint ? { refreshEndpoint: refreshTokenUrl } : {}),
    clientId,
    ...(clientSecret !== undefined ? { clientSecret } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(password !== undefined ? { password } : {}),
    scopes: scope !== undefined ? scope.split(/\s+/).filter((s) => s !== '') : [],
    ...(label !== undefined ? { label } : {}),
    ...(addTokenTo === 'queryParams' ? { sendAs: 'query' as const } : {}),
    ...(clientAuthentication === 'header' ? { clientAuthentication: 'basic-header' as const } : {}),
    ...(extraAuthParams !== undefined ? { extraAuthParams } : {}),
    ...(extraTokenParams !== undefined ? { extraTokenParams } : {}),
    ...(extraRefreshParams !== undefined ? { extraRefreshParams } : {}),
  };
}

/**
 * Values that match our runtime's own behavior import losslessly with
 * no note: an `S256` challenge (the only method the PKCE flow uses), a
 * `Bearer` header prefix (how the token is applied), and header/body
 * placements already covered by the schema defaults.
 */
function isIgnorableDefault(params: Map<string, unknown>, key: string): boolean {
  const value = params.get(key);
  if (key === 'challengeAlgorithm') return value === 'S256';
  if (key === 'headerPrefix') return typeof value === 'string' && value.trim().toLowerCase() === 'bearer';
  return false;
}
