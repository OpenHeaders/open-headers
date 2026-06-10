/**
 * Stateful partial-HAR synthesis across the webRequest hop lifecycle —
 * the heuristic sibling of `CdpHarBuilder`, scoped to what webRequest
 * can honestly attest.
 *
 * One hop's partial entry spans several events (`onBeforeRequest` /
 * `onBeforeRedirect` seed the hop, `onSendHeaders` adds the wire request
 * headers, `onHeadersReceived` adds the response shell, the hop terminal
 * adds ip/error/time), so it cannot come from the pure per-event mapper.
 * This builder accumulates per `(tabId, requestId)` and emits:
 *
 *   - a partial `har-attached` at `onHeadersReceived` — the moment the
 *     detail tabs gain real response headers for an in-flight row;
 *   - a refined re-emit at the hop's terminal event (`onCompleted` /
 *     `onErrorOccurred` / `onBeforeRedirect`) carrying `serverIPAddress`,
 *     `_error` and the total `time`.
 *
 * The joined devtools HAR is always the better entry; once the correlator
 * attaches one for a hop ({@link noteRealHar}), the builder stops
 * refining that request so a later terminal re-emit can never overwrite
 * the authoritative slot with the poorer partial. (The reverse order is
 * fine: a joined HAR landing after the refined partial overwrites it via
 * the store's slot semantics.)
 *
 * State posture matches the correlator's sibling helpers (`HopCursor`,
 * `CorsContextStore`): per-tab maps, bounded with oldest-first eviction,
 * entries dropped at terminal emission, `forgetTab` on tab teardown.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import type { WebRequestEvent, WebRequestHeader } from './events';
import { partialHarEntry } from './webrequest-har-synth';

/** Per-tab cap on concurrently-tracked requests — `HopCursor`-style bound. */
export const MAX_PARTIAL_HAR_REQUESTS_PER_TAB = 5_000;

interface PartialHarState {
  /** Hop index the partial attaches at; bumps on every `onBeforeRedirect`. */
  hopIndex: number;
  /** Hop start, wall-clock ms. */
  startedAtMs: number;
  method: string;
  url: string;
  requestHeaders?: readonly WebRequestHeader[];
  /** Set once `onHeadersReceived` lands — the partial-emission gate. */
  response?: {
    readonly statusCode: number;
    readonly statusLine?: string;
    readonly responseHeaders?: readonly WebRequestHeader[];
    readonly resourceType: string;
  };
  /** A joined devtools HAR claimed the CURRENT hop's slot — stop refining
   *  it. Reset on hop advance: a later hop's slot is still partial-owned. */
  superseded: boolean;
}

export class WebRequestHarBuilder {
  private readonly perTab = new Map<number, Map<string, PartialHarState>>();

  /**
   * Fold one webRequest event into the per-hop state and return the
   * `har-attached` updates it completes (at most one per event).
   */
  observe(event: WebRequestEvent): readonly RequestLifecycleUpdate[] {
    switch (event.method_kind) {
      case 'onBeforeRequest': {
        const tabMap = this.ensureTab(event.tabId);
        if (tabMap.has(event.requestId)) tabMap.delete(event.requestId);
        tabMap.set(event.requestId, {
          hopIndex: 0,
          startedAtMs: event.timeStamp,
          method: event.method,
          url: event.url,
          superseded: false,
        });
        this.evictIfOver(tabMap);
        return [];
      }
      case 'onSendHeaders': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        // Hops ≥ 1 see their real outgoing method/url here first (a 303
        // rewrites POST→GET); hop 0's values are unchanged.
        state.method = event.method;
        state.url = event.url;
        if (event.requestHeaders !== undefined) state.requestHeaders = event.requestHeaders;
        return [];
      }
      case 'onHeadersReceived': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        state.response = {
          statusCode: event.statusCode,
          ...(event.statusLine !== undefined ? { statusLine: event.statusLine } : {}),
          ...(event.responseHeaders !== undefined ? { responseHeaders: event.responseHeaders } : {}),
          resourceType: event.type,
        };
        return this.emitPartial(event.tabId, event.requestId, state);
      }
      case 'onBeforeRedirect': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        // Refine the finishing hop, then advance to the next: a fresh
        // hop seed at the redirect timestamp, headers/response pending.
        const updates = this.emitTerminal(event.tabId, event.requestId, state, {
          completedAtMs: event.timeStamp,
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
        });
        state.hopIndex += 1;
        state.startedAtMs = event.timeStamp;
        state.url = event.redirectUrl;
        state.superseded = false;
        delete state.requestHeaders;
        delete state.response;
        return updates;
      }
      case 'onCompleted': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        const updates = this.emitTerminal(event.tabId, event.requestId, state, {
          completedAtMs: event.timeStamp,
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
        });
        this.forget(event.tabId, event.requestId);
        return updates;
      }
      case 'onErrorOccurred': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        const updates = this.emitTerminal(event.tabId, event.requestId, state, {
          completedAtMs: event.timeStamp,
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
          error: event.error,
        });
        this.forget(event.tabId, event.requestId);
        return updates;
      }
    }
  }

  /**
   * A joined devtools HAR attached at `(requestId, hopIndex)` — the
   * authoritative entry owns that slot; suppress further partial emissions
   * for it so a terminal refinement can't overwrite it. A join for an
   * earlier hop leaves the current hop's partial flow untouched.
   */
  noteRealHar(tabId: number, requestId: string, hopIndex: number): void {
    const state = this.getState(tabId, requestId);
    if (state !== undefined && state.hopIndex === hopIndex) state.superseded = true;
  }

  /** Drop all state for a tab — invariant 2 (lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
  }

  /** Total tracked requests across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  private emitPartial(tabId: number, requestId: string, state: PartialHarState): readonly RequestLifecycleUpdate[] {
    if (state.superseded || state.response === undefined) return [];
    const har = partialHarEntry(
      {
        startedAtMs: state.startedAtMs,
        method: state.method,
        url: state.url,
        ...(state.requestHeaders !== undefined ? { requestHeaders: state.requestHeaders } : {}),
      },
      state.response,
    );
    return [{ kind: 'har-attached', tabId, requestId, hopIndex: state.hopIndex, har }];
  }

  private emitTerminal(
    tabId: number,
    requestId: string,
    state: PartialHarState,
    terminal: { completedAtMs: number; ip?: string; error?: string },
  ): readonly RequestLifecycleUpdate[] {
    // Refinement only — a hop that never saw `onHeadersReceived` has no
    // response shell to refine (a blocked/failed-before-response request);
    // its devtools failure HAR, when one exists, carries the full entry.
    if (state.superseded || state.response === undefined) return [];
    const har = partialHarEntry(
      {
        startedAtMs: state.startedAtMs,
        method: state.method,
        url: state.url,
        ...(state.requestHeaders !== undefined ? { requestHeaders: state.requestHeaders } : {}),
      },
      state.response,
      terminal,
    );
    return [{ kind: 'har-attached', tabId, requestId, hopIndex: state.hopIndex, har }];
  }

  private forget(tabId: number, requestId: string): void {
    const tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) return;
    tabMap.delete(requestId);
    if (tabMap.size === 0) this.perTab.delete(tabId);
  }

  private getState(tabId: number, requestId: string): PartialHarState | undefined {
    return this.perTab.get(tabId)?.get(requestId);
  }

  private ensureTab(tabId: number): Map<string, PartialHarState> {
    let tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) {
      tabMap = new Map();
      this.perTab.set(tabId, tabMap);
    }
    return tabMap;
  }

  private evictIfOver(tabMap: Map<string, PartialHarState>): void {
    while (tabMap.size > MAX_PARTIAL_HAR_REQUESTS_PER_TAB) {
      const oldest = tabMap.keys().next().value;
      if (oldest === undefined) break;
      tabMap.delete(oldest);
    }
  }
}
