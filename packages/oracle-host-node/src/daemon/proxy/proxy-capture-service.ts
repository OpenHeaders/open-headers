/**
 * Proxy capture service — the `oh.daemon.proxy.{status,start,stop,
 * scope.set}` backing and the composition root that makes S5's capture
 * engine drivable: one daemon-side `RequestLifecycleStore` +
 * `RequestLifecycleHub` pair fed by {@link createProxyCaptureEngine},
 * with the bind-port preference and the §2.4 decrypt-scope list
 * persisted in `oh.proxyCaptureSettings`.
 *
 * Laws:
 *  - status is re-derived per call (bound port from the live server, CA
 *    presence from a fresh sealed-slot read) — never a cached flag;
 *  - scope edits take effect on live traffic without a rebind (the
 *    engine reads patterns through a getter per CONNECT);
 *  - invalid patterns are refused at the edit, so the persisted list
 *    never carries an entry the matcher would silently skip — and a
 *    bare `*` catch-all is unrepresentable end to end;
 *  - stopping tears the server down but keeps the store: captured
 *    lifecycles stay inspectable until the next `start` — a stop is a
 *    tap being closed, not evidence being destroyed.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { isValidScopePattern } from '@openheaders/core/proxy';
import { ProxyCaptureSettingsSchema } from '@openheaders/core/schemas';
import { WS_PORT } from '@openheaders/core/protocol';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { ProxyCaptureSettings, ProxyCaptureStatus } from '@openheaders/core/types';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { readProxyCa } from './ca-store';
import type { ProxyMitmServer } from './mitm-server';
import { createProxyCaptureEngine } from './proxy-capture-engine';

const SCOPE = 'proxy-capture';

/** Default bind port for the capture proxy — loopback-only, next to the main sync/HTTP port. */
export const DEFAULT_PROXY_CAPTURE_PORT = WS_PORT + 1;

export type ProxyCaptureStartResult = { ok: true; port: number } | { ok: false; error: string };
export type ProxyCaptureScopeResult = { ok: true; scopePatterns: string[] } | { ok: false; error: string };

/** The control surface the admin table fronts — no hub, no lifetime. */
export interface ProxyCaptureControl {
  status(): Promise<ProxyCaptureStatus>;
  /** Bind the capture proxy. `port` overrides AND persists the preference. */
  start(port?: number): Promise<ProxyCaptureStartResult>;
  stop(): Promise<{ ok: true }>;
  /** Replace the decrypt-scope list. Live immediately; persisted. */
  setScope(patterns: readonly string[]): Promise<ProxyCaptureScopeResult>;
}

export interface ProxyCaptureService extends ProxyCaptureControl {
  /** The hub the lifecycle-port acceptor attaches panel sinks to. */
  readonly hub: RequestLifecycleHub;
  dispose(): Promise<void>;
}

export function createProxyCaptureService(): ProxyCaptureService {
  const store = new RequestLifecycleStore();
  const hub = new RequestLifecycleHub({ store });

  // In-memory working copy of the persisted settings, hydrated once —
  // every read/write goes through `settings()`, which awaits the
  // one-shot hydration then returns the LIVE `current` (never a snapshot
  // captured at hydration time, so a later `persist` is always visible).
  let hydrated: Promise<void> | null = null;
  let current: ProxyCaptureSettings = { version: 1, port: DEFAULT_PROXY_CAPTURE_PORT, scopePatterns: [] };
  const settings = async (): Promise<ProxyCaptureSettings> => {
    hydrated ??= hostStorage
      .getValidated(OH.proxyCaptureSettings, ProxyCaptureSettingsSchema)
      .then((persisted) => {
        if (persisted) current = persisted;
      })
      .catch((err: unknown) => {
        logger.warn(SCOPE, 'settings hydrate failed; using defaults', err);
      });
    await hydrated;
    return current;
  };
  const persist = async (next: ProxyCaptureSettings): Promise<void> => {
    current = next;
    await hostStorage.set(OH.proxyCaptureSettings, next);
  };

  let server: ProxyMitmServer | null = null;
  let lastError: string | null = null;

  async function status(): Promise<ProxyCaptureStatus> {
    const s = await settings();
    const caRead = await readProxyCa();
    return {
      running: server !== null,
      boundPort: server?.port ?? null,
      port: s.port,
      scopePatterns: [...s.scopePatterns],
      caPresent: caRead !== null && caRead !== 'undecryptable',
      lastError,
    };
  }

  async function start(port?: number): Promise<ProxyCaptureStartResult> {
    const s = await settings();
    if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      return { ok: false, error: 'port must be an integer in 1–65535' };
    }
    if (server !== null) {
      const bound = server.port;
      if (port === undefined || port === s.port) {
        return bound !== null ? { ok: true, port: bound } : { ok: false, error: 'proxy is mid-shutdown — retry' };
      }
      return { ok: false, error: 'proxy is running — stop it before changing the port' };
    }
    if (port !== undefined && port !== s.port) await persist({ ...s, port });
    const engine = createProxyCaptureEngine({
      getScopePatterns: () => current.scopePatterns,
      sink: (update) => store.apply(update),
    });
    try {
      const bound = await engine.server.listen(current.port);
      server = engine.server;
      lastError = null;
      return { ok: true, port: bound };
    } catch (err) {
      lastError = (err as Error).message;
      await engine.server.close().catch(() => {});
      return { ok: false, error: lastError };
    }
  }

  async function stop(): Promise<{ ok: true }> {
    const closing = server;
    server = null;
    if (closing !== null) await closing.close();
    return { ok: true };
  }

  async function setScope(patterns: readonly string[]): Promise<ProxyCaptureScopeResult> {
    const s = await settings();
    const trimmed = [...new Set(patterns.map((p) => p.trim()).filter((p) => p.length > 0))];
    const invalid = trimmed.filter((p) => !isValidScopePattern(p));
    if (invalid.length > 0) {
      return { ok: false, error: `invalid scope pattern${invalid.length === 1 ? '' : 's'}: ${invalid.join(', ')}` };
    }
    await persist({ ...s, scopePatterns: trimmed });
    return { ok: true, scopePatterns: trimmed };
  }

  async function dispose(): Promise<void> {
    await stop();
    hub.dispose();
  }

  return { status, start, stop, setScope, hub, dispose };
}
