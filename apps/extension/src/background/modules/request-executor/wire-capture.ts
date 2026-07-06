/**
 * Wire-layer telemetry for the executor: joins a fetch to the webRequest
 * chain the extension-traffic channel captures for it, surfacing the
 * facts `fetch()` withholds — raw `Set-Cookie` response headers and the
 * remote IP.
 *
 * Correlation model mirrors the resource-timing capture: a window opens
 * immediately before the fetch and settles after the body read. Within
 * the window, a candidate chain is one whose FIRST event matches the
 * submitted method + URL; more than one candidate means the attribution
 * would be a guess, so the whole capture is dropped — ambiguity renders
 * as honest absence, never a wrong join. Redirect hops share one
 * `requestId`, so the chain aggregates Set-Cookie across hops and takes
 * the remote IP from the terminal `onCompleted`. Everything degrades to
 * `undefined` — no wire fact is ever fabricated.
 */

import type { CredentialsMode, ExecutedWireCapture } from '@openheaders/core/types';
import type { WebRequestEvent } from '@openheaders/oracle/correlator-heuristic';

export type ExtensionTrafficSubscribe = (listener: (event: WebRequestEvent) => void) => () => void;

let subscribeExtensionTraffic: ExtensionTrafficSubscribe | null = null;

/** Wired once at SW boot by the lifecycle pipeline; unregistered hosts
 *  (tests, exotic platforms) simply produce snapshots without `wire`. */
export function registerExtensionTrafficSource(subscribe: ExtensionTrafficSubscribe): void {
  subscribeExtensionTraffic = subscribe;
}

/** Chain-start events marginally older than the window mark (clock skew
 *  between the webRequest dispatcher's stamps and `Date.now()`) still
 *  belong to this fetch. */
const JOIN_EPSILON_MS = 100;

/** One short grace wait for webRequest event delivery — the terminal
 *  event has fired on the wall clock by the time the body read
 *  completes, but listener dispatch is a separate task. */
const DELIVERY_GRACE_MS = 50;

export interface WireJoinMatch {
  method: string;
  /** Accepted spellings of the submitted URL (raw + parser-normalized —
   *  webRequest reports the normalized form). */
  submittedUrls: readonly string[];
  /** `Date.now()` mark taken just before the fetch. */
  windowStartMs: number;
}

/** Pick the one chain whose start matches the fetch; 0 or >1 candidates
 *  ⇒ `undefined`. */
export function pickWireChain(
  chains: ReadonlyMap<string, readonly WebRequestEvent[]>,
  match: WireJoinMatch,
): readonly WebRequestEvent[] | undefined {
  let found: readonly WebRequestEvent[] | undefined;
  for (const events of chains.values()) {
    const first = events[0];
    if (first === undefined) continue;
    if (first.method !== match.method) continue;
    if (!match.submittedUrls.includes(first.url)) continue;
    if (first.timeStamp < match.windowStartMs - JOIN_EPSILON_MS) continue;
    if (found !== undefined) return undefined;
    found = events;
  }
  return found;
}

/** Fold one captured chain into the snapshot's wire field: Set-Cookie
 *  lines across all hops in arrival order, remote IP from the terminal
 *  `onCompleted`. */
export function aggregateWireCapture(
  chain: readonly WebRequestEvent[],
  credentialsMode: CredentialsMode,
): ExecutedWireCapture {
  const setCookieHeaders: string[] = [];
  let ip: string | undefined;
  for (const event of chain) {
    if (event.method_kind === 'onHeadersReceived' || event.method_kind === 'onBeforeRedirect') {
      for (const header of event.responseHeaders ?? []) {
        if (header.name.toLowerCase() === 'set-cookie' && header.value !== undefined) {
          setCookieHeaders.push(header.value);
        }
      }
    }
    if (event.method_kind === 'onCompleted' && event.ip !== undefined) ip = event.ip;
  }
  return {
    ...(ip !== undefined ? { ip } : {}),
    ...(setCookieHeaders.length > 0 ? { setCookieHeaders } : {}),
    credentialsMode,
  };
}

function hasTerminal(chain: readonly WebRequestEvent[]): boolean {
  return chain.some((event) => event.method_kind === 'onCompleted' || event.method_kind === 'onErrorOccurred');
}

function submittedUrlSpellings(url: string): string[] {
  try {
    const normalized = new URL(url).href;
    return normalized === url ? [url] : [url, normalized];
  } catch {
    return [url];
  }
}

export interface WireCaptureOptions {
  method: string;
  /** The URL handed to `fetch()`. */
  url: string;
  credentialsMode: CredentialsMode;
}

export interface WireCapture {
  /** Resolve the capture for this fetch. Unsubscribes from the channel. */
  settle(): Promise<ExecutedWireCapture | undefined>;
  /** Abandon the capture (error path). */
  cancel(): void;
}

const INERT_CAPTURE: WireCapture = {
  settle: () => Promise.resolve(undefined),
  cancel: () => {},
};

export function startWireCapture(options: WireCaptureOptions): WireCapture {
  if (subscribeExtensionTraffic === null) return INERT_CAPTURE;

  const chains = new Map<string, WebRequestEvent[]>();
  let unsubscribe: (() => void) | null = null;
  try {
    unsubscribe = subscribeExtensionTraffic((event) => {
      const chain = chains.get(event.requestId);
      if (chain !== undefined) chain.push(event);
      else chains.set(event.requestId, [event]);
    });
  } catch {
    return INERT_CAPTURE;
  }
  const windowStartMs = Date.now();

  const match: WireJoinMatch = {
    method: options.method,
    submittedUrls: submittedUrlSpellings(options.url),
    windowStartMs,
  };
  const cancel = (): void => {
    unsubscribe?.();
    unsubscribe = null;
  };

  return {
    async settle() {
      if (unsubscribe === null) return undefined;
      // Event delivery is a separate task from the fetch's own promise
      // chain: yield one macrotask, then allow one short grace wait if
      // the matched chain is still missing its terminal event.
      await new Promise((resolve) => setTimeout(resolve, 0));
      let chain = pickWireChain(chains, match);
      if (chain === undefined || !hasTerminal(chain)) {
        await new Promise((resolve) => setTimeout(resolve, DELIVERY_GRACE_MS));
        chain = pickWireChain(chains, match);
      }
      cancel();
      if (chain === undefined) return undefined;
      return aggregateWireCapture(chain, options.credentialsMode);
    },
    cancel,
  };
}
