/**
 * Auth inheritance — THE rule every host and surface shares.
 *
 * A collection or folder keeps an auth POOL: named, concrete auth
 * configs, one of them the default. A request set to Inherit sends
 * with the nearest pool's default (a host-scoped entry first), or with
 * the ONE entry it names by uid from any level up its chain — the
 * request's pick, so switching between "Admin token" and "User token"
 * is a select while the credentials live in the parent. Nothing is
 * ever copied down: an inheriting request resolves the pool at the
 * next read or send, so changing a collection's default re-points
 * every descendant that inherits and leaves a folder with its own
 * pool — or a request with its own auth or its own pick — untouched.
 *
 * The rule is pure over an ancestor CHAIN (outer → inner). Deriving the
 * chain is the caller's job and differs per host: the oracle reads
 * the tree index (slots, the containment authority), the renderer the
 * projected trees — never a leaf's stored path.
 */

import type { AuthConfig, AuthPoolEntry, AuthSource, ConcreteAuthConfig } from '../types';

/** A collection or folder as the rule sees it — the pool plus the
 *  pre-pool single field it still reads. */
export interface AuthCarrier {
  level: 'collection' | 'folder';
  uid: string;
  name: string;
  auths?: readonly AuthPoolEntry[];
  defaultAuthUid?: string;
  /** The 2026.8.x single default — read as a one-entry pool. */
  auth?: AuthConfig;
}

/** The uid a legacy single `auth` field reads under — never a stored
 *  entry uid (uids are 8 chars), so a request can never pick it. */
export const LEGACY_AUTH_ENTRY_UID = 'legacy-auth';

export interface AuthPool {
  entries: readonly AuthPoolEntry[];
  /** The default entry's uid — `defaultAuthUid` when it names a live
   *  entry, else the first entry's. */
  defaultUid: string;
}

/**
 * The pool a carrier holds, or `null` when the level is transparent
 * (no entries, and no legacy field). A legacy `auth` that is itself
 * `inherit` was the old transparent marker and reads the same way.
 */
export function authPoolOf(carrier: Pick<AuthCarrier, 'auths' | 'defaultAuthUid' | 'auth'>): AuthPool | null {
  const entries = carrier.auths ?? [];
  if (entries.length > 0) {
    const defaultUid = entries.some((e) => e.uid === carrier.defaultAuthUid)
      ? (carrier.defaultAuthUid as string)
      : entries[0].uid;
    return { entries, defaultUid };
  }
  if (carrier.auth !== undefined && carrier.auth.type !== 'inherit') {
    return {
      entries: [{ uid: LEGACY_AUTH_ENTRY_UID, name: '', config: carrier.auth }],
      defaultUid: LEGACY_AUTH_ENTRY_UID,
    };
  }
  return null;
}

/** The pool's default entry, `null` for a transparent carrier. */
export function defaultAuthEntry(
  carrier: Pick<AuthCarrier, 'auths' | 'defaultAuthUid' | 'auth'>,
): AuthPoolEntry | null {
  const pool = authPoolOf(carrier);
  if (pool === null) return null;
  return pool.entries.find((e) => e.uid === pool.defaultUid) ?? null;
}

/**
 * Whether a pool entry's `appliesTo` host pattern matches `host`.
 * Case-insensitive; `*` matches any run of characters; a pattern
 * without one is an exact host match. An empty pattern never matches
 * (an entry without a scope is reached through the default, not
 * through matching).
 */
export function matchesAppliesTo(pattern: string | undefined, host: string | null): boolean {
  if (!pattern || host === null) return false;
  const p = pattern.trim().toLowerCase();
  if (p === '') return false;
  const h = host.toLowerCase();
  if (!p.includes('*')) return p === h;
  const parts = p.split('*');
  let at = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '') continue;
    const found = h.indexOf(part, at);
    if (found === -1) return false;
    if (i === 0 && found !== 0) return false;
    at = found + part.length;
  }
  const last = parts[parts.length - 1];
  return last === '' || h.endsWith(last);
}

/** The host of a URL for `appliesTo` matching — `null` when the text
 *  is not a URL yet (a template-only draft). Port excluded. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

export interface InheritedAuthResolution {
  auth: ConcreteAuthConfig;
  /** The level and entry that supplied it; `null` when no ancestor holds a pool. */
  source: Extract<AuthSource, { level: 'collection' | 'folder' }> | null;
  /** The request named an entry that no longer exists; the default applied. */
  danglingAuthUid?: string;
}

const NO_AUTH: InheritedAuthResolution = { auth: { type: 'none' }, source: null };

function sourceOf(carrier: AuthCarrier, entry: AuthPoolEntry): Extract<AuthSource, { level: 'collection' | 'folder' }> {
  return { level: carrier.level, uid: carrier.uid, name: carrier.name, entryUid: entry.uid, entryName: entry.name };
}

/**
 * Resolve what a request set to Inherit sends with, over its chain
 * (outer → inner). A named pick (`authUid`) is searched inner → outer
 * across every level's pool; the default comes from the INNERMOST
 * level with a pool — a host-scoped entry matching `host` first, else
 * the pool's default. A `none` entry is a real carrier and shadows
 * outer levels. No pool anywhere = no auth, no source.
 */
export function resolveInheritedAuth(
  chain: readonly AuthCarrier[],
  pick: { authUid?: string },
  host: string | null,
): InheritedAuthResolution {
  if (pick.authUid !== undefined) {
    for (let i = chain.length - 1; i >= 0; i--) {
      const pool = authPoolOf(chain[i]);
      const entry = pool?.entries.find((e) => e.uid === pick.authUid);
      if (entry) return { auth: entry.config, source: sourceOf(chain[i], entry) };
    }
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const pool = authPoolOf(chain[i]);
    if (pool === null) continue;
    const scoped = pool.entries.find((e) => matchesAppliesTo(e.appliesTo, host));
    const entry = scoped ?? pool.entries.find((e) => e.uid === pool.defaultUid);
    if (!entry) continue;
    return {
      auth: entry.config,
      source: sourceOf(chain[i], entry),
      ...(pick.authUid !== undefined ? { danglingAuthUid: pick.authUid } : {}),
    };
  }
  return pick.authUid !== undefined ? { ...NO_AUTH, danglingAuthUid: pick.authUid } : NO_AUTH;
}

export interface EffectiveAuth {
  auth: ConcreteAuthConfig;
  source: AuthSource | null;
  danglingAuthUid?: string;
}

/**
 * The auth a request sends with: its own config (source `request`), or
 * the inherited resolution. A disabled Inherit still resolves — the
 * executor skips the contribution the way it skips any disabled auth,
 * and the attribution names what was suspended.
 */
export function effectiveAuthFor(auth: AuthConfig, chain: readonly AuthCarrier[], host: string | null): EffectiveAuth {
  if (auth.type !== 'inherit') return { auth, source: { level: 'request' } };
  const resolved = resolveInheritedAuth(chain, auth, host);
  const effective: ConcreteAuthConfig = auth.disabled ? { ...resolved.auth, disabled: true } : resolved.auth;
  return {
    auth: effective,
    source: resolved.source,
    ...(resolved.danglingAuthUid !== undefined ? { danglingAuthUid: resolved.danglingAuthUid } : {}),
  };
}

/** A one-entry pool for a config landed from an import or a spec —
 *  the entry named by the caller (empty = the type's label). */
export function singleEntryPool(
  uid: string,
  config: ConcreteAuthConfig,
  name = '',
): { auths: AuthPoolEntry[]; defaultAuthUid: string } {
  return { auths: [{ uid, name, config }], defaultAuthUid: uid };
}

/**
 * A pool with `config` as its default entry: the existing default
 * entry keeps its uid, name and scope and takes the new config; a
 * transparent carrier gets a one-entry pool under `mintUid()`. What a
 * surface that lands ONE config (a spec update, an import leg, the
 * container editor's default) writes — never wiping the other entries.
 */
export function withDefaultAuthConfig(
  carrier: Pick<AuthCarrier, 'auths' | 'defaultAuthUid' | 'auth'>,
  config: ConcreteAuthConfig,
  mintUid: () => string,
): { auths: AuthPoolEntry[]; defaultAuthUid: string } {
  const pool = authPoolOf(carrier);
  const entries = pool === null ? [] : pool.entries.filter((e) => e.uid !== LEGACY_AUTH_ENTRY_UID);
  const current = pool === null ? undefined : entries.find((e) => e.uid === pool.defaultUid);
  if (current === undefined) {
    const uid = mintUid();
    return { auths: [...entries, { uid, name: '', config }], defaultAuthUid: uid };
  }
  return {
    auths: entries.map((e) => (e.uid === current.uid ? { ...e, config } : e)),
    defaultAuthUid: current.uid,
  };
}

/** The pool without its default entry — the level goes transparent
 *  when nothing else remains. Named entries survive. */
export function withoutDefaultAuth(carrier: Pick<AuthCarrier, 'auths' | 'defaultAuthUid' | 'auth'>): {
  auths: AuthPoolEntry[];
  defaultAuthUid: undefined;
} {
  const pool = authPoolOf(carrier);
  const entries = pool === null ? [] : pool.entries.filter((e) => e.uid !== LEGACY_AUTH_ENTRY_UID);
  return { auths: entries.filter((e) => e.uid !== pool?.defaultUid), defaultAuthUid: undefined };
}
// ── The per-kind mask ──────────────────────────────────────────────

/** The wire kind an auth config is applied to. HTTP takes everything;
 *  the session kinds take only what their protocol can carry. */
export type AuthProtocolKind = 'http' | 'websocket' | 'grpc' | 'mqtt';

const ALL_AUTH_TYPES: readonly ConcreteAuthConfig['type'][] = [
  'none',
  'basic',
  'bearer',
  'api-key',
  'oauth2',
  'aws-sigv4',
  'edgegrid',
  'asap',
  'digest',
  'oauth1',
  'hawk',
  'jwt',
];

const AUTH_MASKS: Record<AuthProtocolKind, ReadonlySet<ConcreteAuthConfig['type']>> = {
  http: new Set(ALL_AUTH_TYPES),
  websocket: new Set(['none', 'bearer', 'basic', 'api-key']),
  grpc: new Set(['none', 'bearer', 'basic', 'api-key']),
  mqtt: new Set(['none', 'basic']),
};

/**
 * The auth types `kind` can carry — handshake headers for WebSocket,
 * metadata pairs for gRPC, the CONNECT username/password for MQTT.
 * The renderer greys inherited entries outside it; the executors
 * refuse them by name (`assertAuthAllowed`) — never a silent none.
 */
export function authMaskFor(kind: AuthProtocolKind): ReadonlySet<ConcreteAuthConfig['type']> {
  return AUTH_MASKS[kind];
}

/** Whether `kind` can apply `auth` — the type mask plus the api-key
 *  placement rule (a handshake / metadata / CONNECT has no query leg,
 *  so a query-placed key never rides a session kind). */
export function authAllowedFor(kind: AuthProtocolKind, auth: ConcreteAuthConfig): boolean {
  if (!authMaskFor(kind).has(auth.type)) return false;
  if (auth.type === 'api-key' && kind !== 'http') return auth.in === 'header';
  return true;
}

/** The auth types' display labels — the executors' refusal copy
 *  (surfaces localize through their own catalogs). */
export const AUTH_TYPE_LABELS: Record<ConcreteAuthConfig['type'], string> = {
  none: 'No Auth',
  basic: 'Basic Auth',
  bearer: 'Bearer Token',
  'api-key': 'API Key',
  oauth2: 'OAuth 2.0',
  'aws-sigv4': 'AWS Signature v4',
  edgegrid: 'Akamai EdgeGrid',
  asap: 'ASAP (Atlassian)',
  digest: 'Digest Auth',
  oauth1: 'OAuth 1.0',
  hawk: 'Hawk Authentication',
  jwt: 'JWT Bearer',
};

/** The kind noun WITH its article — "an MQTT session" needs `an`. */
const AUTH_KIND_NOUNS: Record<AuthProtocolKind, string> = {
  http: 'a request',
  websocket: 'a WebSocket session',
  grpc: 'a gRPC call',
  mqtt: 'an MQTT session',
};

/**
 * The named refusal when a resolved auth cannot ride `kind`, `null`
 * when it applies: a masked type passes, and so does a suspended
 * (`disabled`) or `none` resolution — nothing would contribute. The
 * copy names the source ("Inherited OAuth 2.0 from Collection
 * 'Payments' › Admin token cannot be applied to a WebSocket
 * session.") — a request's OWN config is always inside its schema's
 * subset, so the source is an ancestor entry in practice.
 */
export function assertAuthAllowed(kind: AuthProtocolKind, effective: EffectiveAuth): string | null {
  const { auth, source } = effective;
  if (auth.disabled === true || auth.type === 'none') return null;
  if (authAllowedFor(kind, auth)) return null;
  const label = auth.type === 'api-key' && auth.in === 'query' ? 'API Key in query' : AUTH_TYPE_LABELS[auth.type];
  const noun = AUTH_KIND_NOUNS[kind];
  if (source === null || source.level === 'request') return `${label} cannot be applied to ${noun}.`;
  const levelName = source.level === 'collection' ? 'Collection' : 'Folder';
  const entry = source.entryName !== '' ? ` › ${source.entryName}` : '';
  return `Inherited ${label} from ${levelName} '${source.name}'${entry} cannot be applied to ${noun}.`;
}
