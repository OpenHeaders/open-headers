/**
 * Browser-target Network plane (SW-network Phase A) — the network sibling
 * of `browser-target-fanout`. A site service worker's own requests (the
 * browser's gear-prefixed ⚙ rows) arrive on the worker's target as raw
 * `Network.*` params with no `tabId`; this module presents each event to a
 * dedicated {@link CdpCorrelator} instance once per owning tab, with
 *
 *   - `tabId` = the owner (from `controller.ownersOf(targetId)`),
 *   - `sessionId` = `target:<targetId>` — the established synthetic
 *     session key, shared with `contextKey`/`ConsoleEntry` joins.
 *
 * Store request ids come out as `target:<id>::<rawRequestId>` via the
 * correlator's own `cdpStoreRequestId` — namespaced for free, structurally
 * incapable of colliding with page-session rows or webRequest ids. The
 * correlator is reused UNCHANGED over a {@link CdpEventSource} adapter
 * whose `subscribePage`/`subscribeFetch` are inert (no Page domain on a
 * worker target; interception on SW targets is a non-goal) and whose body
 * pulls parse the targetId back out of the session key and ride
 * `sendOnTarget` — full body parity with the tab plane's lazy path.
 *
 * Ownership drives the correlator's attach set: a tab is `attachTab`ed on
 * its first target ownership and `detachTab`ed only when it leaves every
 * owner-set (one origin can enumerate two workers mid-update). Detach kills
 * the correlator's per-tab HAR state; rows already in the store persist as
 * history. History posture matches console entries — a late-joining owner
 * gets no backfill of rows already minted.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import {
  type CdpBufferedResponseBody,
  CdpCorrelator,
  type CdpEventSource,
  type CdpNetworkEvent,
  type CdpResponseBody,
} from '@openheaders/oracle/correlator-cdp';
import type { BrowserTargetOwnersListener } from './browser-target-attach-controller';
import { browserTargetSessionKey } from './browser-target-source';
import { normalizeNetworkEvent } from './cdp-normalizers';
import type { RawGetResponseBody, RawStreamResourceContent } from './cdp-raw-payloads';

/** The `browserTargetSessionKey` routing prefix, as it appears in store ids. */
const BROWSER_TARGET_PREFIX = 'target:';

/** The slice of `ChromeBrowserTargetSource` this plane consumes. */
interface NetworkSourceRef {
  subscribeNetwork(listener: (targetId: string, method: string, params: object) => void): () => void;
  sendOnTarget(targetId: string, method: string, params?: Record<string, unknown>): Promise<unknown>;
}

/** The slice of `BrowserTargetAttachController` this plane consumes. */
interface NetworkControllerRef {
  ownersOf(targetId: string): readonly number[];
  onOwnersChanged(listener: BrowserTargetOwnersListener): () => void;
}

export interface BrowserTargetNetworkOptions {
  readonly source: NetworkSourceRef;
  readonly controller: NetworkControllerRef;
  /** The lifecycle store intake — same store the tab-plane correlators feed. */
  readonly apply: (update: RequestLifecycleUpdate) => void;
}

export interface BrowserTargetNetwork {
  /** The SW-plane leg of the composite body router ({@link createBodyFetchRouter}). */
  requestBody(tabId: number, requestId: string, hopIndex: number): Promise<void>;
  dispose(): void;
}

/**
 * On-demand body fetch, as the lifecycle port host consumes it (the
 * structural shape of its `LifecycleBodyFetcher`).
 */
export interface BodyFetcherLeg {
  requestBody(tabId: number, requestId: string, hopIndex: number): Promise<void>;
}

/**
 * The composite body-fetch router — the clobber-trap guard. The lifecycle
 * port host takes ONE `bodyFetcher`, and `CdpCorrelator.requestBody` on an
 * attached tab emits an EMPTY `body-attached` for an unknown request id, so
 * dispatching one request to both instances would let the loser clobber the
 * winner. Routing by the store-id prefix — `target:` → the SW plane,
 * everything else → the tab plane — guarantees exactly one instance ever
 * answers.
 */
export function createBodyFetchRouter(swPlane: BodyFetcherLeg, tabPlane: BodyFetcherLeg): BodyFetcherLeg {
  return {
    requestBody(tabId: number, requestId: string, hopIndex: number): Promise<void> {
      const plane = requestId.startsWith(BROWSER_TARGET_PREFIX) ? swPlane : tabPlane;
      return plane.requestBody(tabId, requestId, hopIndex);
    },
  };
}

/** Parse the targetId back out of a `target:<targetId>` session key. */
function targetIdOfSessionKey(sessionId: string): string {
  return sessionId.slice(BROWSER_TARGET_PREFIX.length);
}

export function startBrowserTargetNetwork(options: BrowserTargetNetworkOptions): BrowserTargetNetwork {
  const { source, controller, apply } = options;

  const eventListeners = new Set<(event: CdpNetworkEvent) => void>();
  const adapter: CdpEventSource = {
    subscribe(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    // No Page domain exists on a worker target, and Fetch interception on
    // SW targets is a non-goal of this plane — both streams are inert.
    subscribePage() {
      return () => {};
    },
    subscribeFetch() {
      return () => {};
    },
    async fetchResponseBody(_tabId, sessionId, rawRequestId): Promise<CdpResponseBody> {
      const result = await source.sendOnTarget(targetIdOfSessionKey(sessionId), 'Network.getResponseBody', {
        requestId: rawRequestId,
      });
      const raw = result as RawGetResponseBody | undefined;
      if (typeof raw?.body !== 'string' || typeof raw.base64Encoded !== 'boolean') {
        throw new Error('Network.getResponseBody returned an unexpected shape');
      }
      return { body: raw.body, base64Encoded: raw.base64Encoded };
    },
    async streamResponseBody(_tabId, sessionId, rawRequestId): Promise<CdpBufferedResponseBody> {
      const result = await source.sendOnTarget(targetIdOfSessionKey(sessionId), 'Network.streamResourceContent', {
        requestId: rawRequestId,
      });
      const raw = result as RawStreamResourceContent | undefined;
      if (typeof raw?.bufferedData !== 'string') {
        throw new Error('Network.streamResourceContent returned an unexpected shape');
      }
      return { bufferedData: raw.bufferedData };
    },
  };

  const correlator = new CdpCorrelator(adapter);
  // Provenance (Phase B): every row this plane mints is worker-issued by
  // construction — a worker target's Network stream contains only the
  // worker's own exchanges — so stamp the additive `issuedByWorker` fact
  // onto each `started` mint (started-only; never patched). The panel's
  // gear glyph gates on it.
  const offUpdates = correlator.subscribe((update) => {
    apply(
      update.kind === 'started'
        ? { ...update, lifecycle: { ...update.lifecycle, issuedByWorker: 'service-worker' } }
        : update,
    );
  });

  // Normalize once, then present per owner with only the `tabId` restamped —
  // the same raw event belongs to every tab whose main frame lives on the
  // worker's origin (usually exactly one).
  const offNetwork = source.subscribeNetwork((targetId, method, params) => {
    const owners = controller.ownersOf(targetId);
    if (owners.length === 0) return;
    const event = normalizeNetworkEvent(owners[0], browserTargetSessionKey(targetId), method, params);
    if (event === null) return;
    for (const listener of eventListeners) listener(event);
    for (let i = 1; i < owners.length; i++) {
      const restamped = { ...event, tabId: owners[i] };
      for (const listener of eventListeners) listener(restamped);
    }
  });

  // Attach bookkeeping: the correlator's per-tab gate follows ownership,
  // refcounted across targets — a tab detaches only when it leaves its
  // LAST owner-set, so a mid-update origin (old + new worker both live)
  // never drops the tab's HAR state early.
  const ownedTargets = new Map<number, Set<string>>();
  const offOwners = controller.onOwnersChanged((targetId, added, removed) => {
    for (const tabId of added) {
      const targets = ownedTargets.get(tabId);
      if (targets === undefined) {
        ownedTargets.set(tabId, new Set([targetId]));
        correlator.attachTab(tabId);
      } else {
        targets.add(targetId);
      }
    }
    for (const tabId of removed) {
      const targets = ownedTargets.get(tabId);
      if (targets === undefined) continue;
      targets.delete(targetId);
      if (targets.size === 0) {
        ownedTargets.delete(tabId);
        correlator.detachTab(tabId);
      }
    }
  });

  return {
    requestBody: (tabId, requestId, hopIndex) => correlator.requestBody(tabId, requestId, hopIndex),
    dispose(): void {
      offOwners();
      offNetwork();
      offUpdates();
      correlator.dispose();
      eventListeners.clear();
      ownedTargets.clear();
    },
  };
}
