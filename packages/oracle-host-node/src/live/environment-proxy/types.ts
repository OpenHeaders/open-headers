/**
 * Environment-plane proxy resolution — the per-DEVICE half of the
 * two-plane proxy architecture (docs/REQUEST_ENGINE_PROXY_DESIGN.md).
 *
 * The environment plane answers "on this machine, egress works like
 * this" for one target URL at a time. It is machine state, never
 * synced (the vault posture): the desktop's resolver delegates to
 * Chromium's own proxy resolution (system settings, GPO, PAC, WPAD —
 * "works exactly like Chrome on this machine"); the node tier's
 * default resolver honors the HTTP_PROXY-family env vars. The request
 * plane consults it only for sends that INHERIT (no `proxyMode`, no
 * `proxyUrl`) — an explicit request-plane setting always wins.
 *
 * Answers are fallback CHAINS in Chromium's semantics (`PROXY a;
 * PROXY b; DIRECT`): the transport walks the chain per send — the
 * first supported entry dials, a dial failure falls through to the
 * next, a `direct` entry means direct. SOCKS5 answers are dialable
 * `kind: 'proxy'` entries like HTTP(S) ones (P5); only the SOCKS4
 * family the engine does not speak rides `kind: 'socks'` so the
 * transport can fail honestly naming the resolved proxy.
 */

/** Where an environment-plane answer came from — wire truth + the P3
 *  sourced display. `'system'` = the OS via Chromium (PAC and WPAD
 *  included); `'env'` = the HTTP_PROXY-family variables; `'manual'` /
 *  `'pac'` = the explicit modes (later slices). */
export type EnvironmentProxySource = 'env' | 'system' | 'manual' | 'pac';

export type EnvironmentProxyEntry =
  /** Terminates the chain: connect directly. */
  | { kind: 'direct' }
  /** A proxy the send may traverse — an HTTP(S) CONNECT tunnel or a
   *  SOCKS5 dial. `url` is a normalized
   *  `http(s)|socks5://host:port` — credentials never ride it; a
   *  `user:password` pair extracted from the configured value (the
   *  env-var idiom) travels separately as `credential`. */
  | { kind: 'proxy'; url: string; credential?: string }
  /** A SOCKS4-family answer the engine does not speak — carried
   *  verbatim so the honest failure names what the machine resolved. */
  | { kind: 'socks'; raw: string };

export interface EnvironmentProxySelection {
  /** Fallback entries in preference order (Chromium chain semantics).
   *  Empty means direct. */
  entries: EnvironmentProxyEntry[];
  source: EnvironmentProxySource;
}

/**
 * One environment-plane resolver — the seam both adapters implement:
 * the desktop's Chromium `session.resolveProxy` adapter (installed at
 * host boot) and the node tier's env-var adapter (the default).
 * `resolve` answers per target URL; `null` means the plane has no
 * answer for this target (bypassed, unset, or off) — the send goes
 * direct. A resolver failure must resolve `null`, never throw: the
 * plane's job is seamlessness, and Chromium's own resolution treats
 * an unresolvable answer as DIRECT too.
 */
export interface EnvironmentProxyResolver {
  resolve(url: string): Promise<EnvironmentProxySelection | null>;
}
