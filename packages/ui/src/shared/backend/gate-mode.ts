/**
 * Which front door a server's state asks a client to draw (the server
 * front door plan §4.1, lifted out of the web tab by the client sign-in
 * plan §7 so the wizard's sign-in step reads the same truth): a pure
 * function of the three meta routes, over ONE seam — a JSON-only GET
 * by route path — that each host binds its own way: the served tab
 * same-origin, the extension's page from its own origin, the desktop's
 * MAIN process over IPC (F0-b). The server renders the very same four
 * states on its device page from `gate-mode.ts`; the precedence here is
 * that module's, so the two front doors can never disagree.
 *
 * Every parser fails towards the safe reading — a null answer (the SPA
 * fallback, a refusal, a dead socket) is "no IdP", "claimed", "no
 * password holder" — so a client never offers to set up a server that
 * already has an administrator.
 */

/** GET a JSON document by route path on the server; null for anything that is not a JSON 2xx. */
export type MetaJsonFetch = (path: string) => Promise<unknown | null>;

export const OIDC_META_PATH = '/auth/oidc/meta';
export const SETUP_META_PATH = '/auth/setup/meta';
export const PASSWORD_META_PATH = '/auth/password/meta';

export type GateMode =
  | { readonly kind: 'setup'; readonly requiresCode: boolean }
  | { readonly kind: 'sso'; readonly provider: string }
  | { readonly kind: 'password' }
  | { readonly kind: 'no-login' };

export interface OidcMeta {
  readonly enabled: boolean;
  readonly provider?: string;
}

export interface SetupMeta {
  /** No directory user has ever been admitted, and no IdP is configured. */
  readonly unclaimed: boolean;
  /** The claim is open and a setup code exists — non-loopback browsers must carry it. */
  readonly requiresCode: boolean;
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  return payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
}

/** Only a JSON `{ enabled: true }` counts — a daemon without OIDC has no such route. */
export function parseOidcMeta(payload: unknown): OidcMeta {
  const record = asRecord(payload);
  if (!record) return { enabled: false };
  return {
    enabled: record.enabled === true,
    ...(typeof record.provider === 'string' ? { provider: record.provider } : {}),
  };
}

/** Fails towards "claimed" — never a create-the-admin form on a server that has one. */
export function parseSetupMeta(payload: unknown): SetupMeta {
  const record = asRecord(payload);
  if (!record) return { unclaimed: false, requiresCode: false };
  return { unclaimed: record.unclaimed === true, requiresCode: record.requiresCode === true };
}

export function parsePasswordMeta(payload: unknown): { enabled: boolean } {
  const record = asRecord(payload);
  return { enabled: record?.enabled === true };
}

/**
 * Ask the three meta routes at once. Their answers are consistent by
 * contract — an IdP-fronted server is never unclaimed, an unclaimed one
 * holds no password — so a single round trip decides, and the order
 * below is precedence, not dependence: sso → setup → password →
 * no-login (exactly the server's own resolver).
 */
export async function resolveGateMode(fetchJson: MetaJsonFetch): Promise<GateMode> {
  const [oidc, setup, password] = await Promise.all([
    fetchJson(OIDC_META_PATH).then(parseOidcMeta),
    fetchJson(SETUP_META_PATH).then(parseSetupMeta),
    fetchJson(PASSWORD_META_PATH).then(parsePasswordMeta),
  ]);
  if (oidc.enabled) return { kind: 'sso', provider: oidc.provider ?? 'SSO' };
  if (setup.unclaimed) return { kind: 'setup', requiresCode: setup.requiresCode };
  return password.enabled ? { kind: 'password' } : { kind: 'no-login' };
}
