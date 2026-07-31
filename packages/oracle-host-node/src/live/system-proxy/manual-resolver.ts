/**
 * Manual-mode system-plane resolver — the config-driven half of
 * the P3 settings surface (docs/REQUEST_ENGINE_PROXY_DESIGN.md): one
 * proxy value (env-var idiom — bare `host:port` implies `http://`),
 * credentials by VAULT REF resolved at RESOLVE time through an
 * injected callback (the credential value never sits in config), and
 * a curl-semantics NO_PROXY bypass list. Host-neutral: the desktop's
 * mode-driven service builds it today; the P4 daemon/CLI manual mode
 * reuses it unchanged.
 *
 * A bypassed target, an unparsable value, or a SOCKS4-family value all
 * keep the plane's honesty contract: bypass and unparsable resolve
 * `null` (direct — seamlessness, never a new failure); a SOCKS4 value
 * resolves the `kind: 'socks'` entry so the transport owns the honest
 * gate naming what the machine configured. SOCKS5 values are dialable
 * entries like HTTP(S) ones (P5), vault credential included.
 */

import { isBypassedByNoProxy } from './no-proxy';
import { parseProxyValue } from './proxy-value';
import type { SystemProxyResolver, SystemProxySelection } from './types';

export interface ManualProxyConfig {
  /** The configured proxy value (`corp:8080`, `http://corp:8080`). */
  proxyValue: string;
  /** NO_PROXY-syntax bypass list; empty/absent bypasses nothing. */
  bypassList?: string;
  /**
   * Resolve the configured credential ref to its `user:password`
   * value, called per resolve so a vault edit applies to the next
   * send. Absent = unauthenticated proxy; resolving `null` (a dangling
   * ref) sends unauthenticated too — the proxy's 407 is the honest
   * surface for a missing credential, never a silent config guess.
   */
  resolveCredential?: () => string | null;
}

export function createManualProxyResolver(config: ManualProxyConfig): SystemProxyResolver {
  return {
    resolve(url: string): Promise<SystemProxySelection | null> {
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        return Promise.resolve(null);
      }
      const bypass = config.bypassList?.trim();
      if (bypass !== undefined && bypass !== '') {
        const secure = target.protocol === 'https:' || target.protocol === 'wss:';
        const port = target.port !== '' ? Number(target.port) : secure ? 443 : 80;
        if (isBypassedByNoProxy(target.hostname, port, bypass)) return Promise.resolve(null);
      }
      const entry = parseProxyValue(config.proxyValue);
      if (entry === null) return Promise.resolve(null);
      if (entry.kind === 'proxy' && entry.credential === undefined) {
        const credential = config.resolveCredential?.() ?? null;
        if (credential !== null) {
          return Promise.resolve({ entries: [{ ...entry, credential }], source: 'manual' });
        }
      }
      return Promise.resolve({ entries: [entry], source: 'manual' });
    },
  };
}
