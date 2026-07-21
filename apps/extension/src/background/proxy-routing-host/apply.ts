/**
 * Per-browser routing appliers (OBSERVABILITY_PLAN.md §5.1). One
 * adapter per proxy-config surface:
 *
 *  - Chromium (`chrome.proxy.settings`): the scope compiles into a PAC
 *    (`buildScopePac`) with a DIRECT failover, installed at `regular`
 *    scope. Another extension holding proxy control is reported as a
 *    conflict — never fought.
 *  - Firefox (`proxy.onRequest`): genuinely per-request — the standing
 *    listener (registered at module eval so the event page wakes for
 *    it) consults the routing state and answers proxy-then-direct for
 *    scoped hosts, direct for everything else. Apply is a state swap.
 *  - Safari: no proxy API — acks `unsupported`.
 *
 * The DIRECT failover in both paths is deliberate (ratified): browsing
 * survives a dead capture port at the cost of a capture gap, and the
 * config survives wire flaps for the same reason.
 */

import { buildScopePac, hostInScope } from '@openheaders/core/proxy';
import type { ProxyRoutingMode } from '@openheaders/core/types';

/** The routing verdict an adapter applies — the wire state, minus the frame type. */
export interface ProxyRoutingState {
  enabled: boolean;
  port: number | null;
  scopePatterns: string[];
}

export interface ProxyRoutingApplyResult {
  applied: boolean;
  error?: string;
}

export interface ProxyRoutingAdapter {
  readonly mode: ProxyRoutingMode;
  apply(state: ProxyRoutingState): Promise<ProxyRoutingApplyResult>;
}

export const INACTIVE_ROUTING_STATE: ProxyRoutingState = { enabled: false, port: null, scopePatterns: [] };

// ── Chromium: chrome.proxy PAC ────────────────────────────────────

function lastRuntimeErrorMessage(): string | undefined {
  return chrome.runtime?.lastError?.message;
}

/**
 * Only constructed on Chrome/Edge, where the manifest ships the
 * `proxy` permission — `chrome.proxy` is present by construction; the
 * try/catch below covers any runtime surprise as an honest error ack.
 */
export function createChromiumRoutingAdapter(): ProxyRoutingAdapter {
  return {
    mode: 'pac',
    apply(state: ProxyRoutingState): Promise<ProxyRoutingApplyResult> {
      return new Promise((resolve) => {
        try {
          chrome.proxy.settings.get({}, (config) => {
            const control = config?.levelOfControl ?? 'not_controllable';
            if (control === 'controlled_by_other_extensions' || control === 'not_controllable') {
              resolve({ applied: false, error: `proxy settings ${control.replace(/_/g, ' ')}` });
              return;
            }
            const done = (): void => {
              const error = lastRuntimeErrorMessage();
              resolve(error !== undefined ? { applied: false, error } : { applied: true });
            };
            if (state.enabled && state.port !== null) {
              chrome.proxy.settings.set(
                {
                  value: {
                    mode: 'pac_script',
                    pacScript: { data: buildScopePac(state.scopePatterns, state.port) },
                  },
                  scope: 'regular',
                },
                done,
              );
            } else {
              chrome.proxy.settings.clear({ scope: 'regular' }, done);
            }
          });
        } catch (err) {
          resolve({ applied: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}

// ── Firefox: proxy.onRequest ──────────────────────────────────────

type FirefoxProxyInfo = { type: 'direct' } | { type: 'http'; host: string; port: number };

interface FirefoxProxyRequestDetails {
  url: string;
}

interface FirefoxProxyApi {
  onRequest: {
    addListener(
      listener: (details: FirefoxProxyRequestDetails) => Promise<FirefoxProxyInfo | FirefoxProxyInfo[]>,
      filter: { urls: string[] },
    ): void;
  };
}

declare const browser: (typeof chrome & { proxy?: FirefoxProxyApi }) | undefined;

function firefoxProxyApi(): FirefoxProxyApi | null {
  return typeof browser !== 'undefined' ? (browser.proxy ?? null) : null;
}

/**
 * Firefox adapter. `readState` is consulted per request — the listener
 * is standing (registered once, at adapter construction during module
 * eval, so the event page wakes for proxy decisions) and awaits the
 * host's hydration so a cold start answers from the persisted state.
 */
export function createFirefoxRoutingAdapter(readState: () => Promise<ProxyRoutingState>): ProxyRoutingAdapter {
  const api = firefoxProxyApi();
  if (api !== null) {
    api.onRequest.addListener(
      async (details) => {
        const state = await readState();
        if (!state.enabled || state.port === null) return { type: 'direct' };
        let host: string;
        try {
          host = new URL(details.url).hostname;
        } catch {
          return { type: 'direct' };
        }
        if (!hostInScope(host, state.scopePatterns)) return { type: 'direct' };
        return [{ type: 'http', host: '127.0.0.1', port: state.port }, { type: 'direct' }];
      },
      { urls: ['<all_urls>'] },
    );
  }
  return {
    mode: 'onRequest',
    apply(): Promise<ProxyRoutingApplyResult> {
      // The standing listener reads the swapped state per request —
      // nothing to install; the only failure is a missing API.
      return Promise.resolve(api !== null ? { applied: true } : { applied: false, error: 'proxy API unavailable' });
    },
  };
}

// ── Safari: no proxy API ──────────────────────────────────────────

export function createUnsupportedRoutingAdapter(): ProxyRoutingAdapter {
  return {
    mode: 'unsupported',
    apply(): Promise<ProxyRoutingApplyResult> {
      return Promise.resolve({ applied: false });
    },
  };
}
