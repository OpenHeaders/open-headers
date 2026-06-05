/**
 * In-memory implementation of `CdpEventSource` for tests. Real chrome
 * wiring is forbidden (see `CdpCorrelatorStub.fromChromeDebugger`).
 */

import type { CdpEventSource, CdpNetworkEvent, CdpResponseBody } from '../../src/correlator-cdp/events';
import type { CdpPageEvent } from '../../src/correlator-cdp/page-events';

/** One recorded `fetchResponseBody` call, for assertions. */
export interface BodyFetchCall {
  readonly tabId: number;
  readonly sessionId: string;
  readonly rawRequestId: string;
}

export class InMemoryCdpSource implements CdpEventSource {
  private readonly listeners = new Set<(event: CdpNetworkEvent) => void>();
  private readonly pageListeners = new Set<(event: CdpPageEvent) => void>();
  /** Every `fetchResponseBody` call, in order — assert the resolved identity. */
  readonly bodyCalls: BodyFetchCall[] = [];
  /**
   * Programmable body responder. Defaults to rejecting (the "host has no
   * body" path the correlator turns into an empty body); tests override it
   * to resolve a specific `{ body, base64Encoded }`.
   */
  bodyResponder: (call: BodyFetchCall) => Promise<CdpResponseBody> = () => Promise.reject(new Error('no body'));

  subscribe(listener: (event: CdpNetworkEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribePage(listener: (event: CdpPageEvent) => void): () => void {
    this.pageListeners.add(listener);
    return () => {
      this.pageListeners.delete(listener);
    };
  }

  fetchResponseBody(tabId: number, sessionId: string, rawRequestId: string): Promise<CdpResponseBody> {
    const call: BodyFetchCall = { tabId, sessionId, rawRequestId };
    this.bodyCalls.push(call);
    return this.bodyResponder(call);
  }

  emit(event: CdpNetworkEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  emitPage(event: CdpPageEvent): void {
    for (const fn of this.pageListeners) fn(event);
  }
}
