/**
 * CDP Page-domain bridge — wires the oracle `CdpPageCorrelator` onto
 * `PageStreamHub` from a `CdpEventSource`'s network + page streams, so
 * CDP-owned tabs get Chrome-exact `log.pages[]` timings.
 */

import type {
  CdpBufferedResponseBody,
  CdpEventSource,
  CdpNetworkEvent,
  CdpPageEvent,
  CdpResponseBody,
} from '@openheaders/oracle/correlator-cdp';
import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { describe, expect, it } from 'vitest';

import { startCdpPageBridge } from '@/background/page-port-host/cdp-page-bridge';

const TAB = 11;

class FakeCdpSource implements CdpEventSource {
  private readonly net = new Set<(e: CdpNetworkEvent) => void>();
  private readonly page = new Set<(e: CdpPageEvent) => void>();
  subscribe(l: (e: CdpNetworkEvent) => void): () => void {
    this.net.add(l);
    return () => this.net.delete(l);
  }
  subscribePage(l: (e: CdpPageEvent) => void): () => void {
    this.page.add(l);
    return () => this.page.delete(l);
  }
  fetchResponseBody(): Promise<CdpResponseBody> {
    return Promise.reject(new Error('no body'));
  }
  streamResponseBody(): Promise<CdpBufferedResponseBody> {
    return Promise.reject(new Error('no body'));
  }
  emit(e: CdpNetworkEvent): void {
    for (const l of this.net) l(e);
  }
  emitPage(e: CdpPageEvent): void {
    for (const l of this.page) l(e);
  }
}

function docRequest(): CdpNetworkEvent {
  return {
    method: 'Network.requestWillBeSent',
    tabId: TAB,
    sessionId: 'page',
    requestId: 'doc',
    loaderId: 'L1',
    documentURL: 'https://app.openheaders.io/',
    request: { url: 'https://app.openheaders.io/', method: 'GET' },
    timestamp: 100,
    wallTime: 1_700_000_000,
    type: 'Document',
  };
}

function docResponse(): CdpNetworkEvent {
  return {
    method: 'Network.responseReceived',
    tabId: TAB,
    sessionId: 'page',
    requestId: 'doc',
    timestamp: 100.1,
    type: 'Document',
    response: { url: 'https://app.openheaders.io/', status: 200, statusText: 'OK', timing: { requestTime: 100.05 } },
  };
}

describe('startCdpPageBridge', () => {
  it('reconstructs a page with Chrome-exact start + DCL/load from the CDP streams', () => {
    const hub = new PageStreamHub();
    const bus = new TabLifecycleBus();
    const source = new FakeCdpSource();
    startCdpPageBridge({ source, hub, bus });

    source.emit(docRequest());
    source.emit(docResponse());
    source.emitPage({
      method: 'Page.frameNavigated',
      tabId: TAB,
      sessionId: 'page',
      frame: { id: 'F1', loaderId: 'L1', url: 'https://app.openheaders.io/' },
    });
    source.emitPage({ method: 'Page.domContentEventFired', tabId: TAB, sessionId: 'page', timestamp: 101.626 });
    source.emitPage({ method: 'Page.loadEventFired', tabId: TAB, sessionId: 'page', timestamp: 102.428 });

    const pages = hub.snapshotTab(TAB);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      id: 'page_1',
      startedAtMs: 1_700_000_000_050,
      url: 'https://app.openheaders.io/',
    });
    // Milestones are the raw `(eventSec − pageStartSec) * 1000` product (no
    // rounding, by design), so assert to sub-µs rather than exact float.
    expect(pages[0].dclMs).toBeCloseTo(1576, 5);
    expect(pages[0].loadMs).toBeCloseTo(2378, 5);
  });

  it('forgets per-tab correlator state when the tab closes', () => {
    const hub = new PageStreamHub();
    const bus = new TabLifecycleBus();
    const source = new FakeCdpSource();
    startCdpPageBridge({ source, hub, bus });

    source.emit(docRequest());
    source.emit(docResponse());
    bus.notifyTabForgotten(TAB);
    // The remembered document is gone, so the navigation yields no page.
    source.emitPage({
      method: 'Page.frameNavigated',
      tabId: TAB,
      sessionId: 'page',
      frame: { id: 'F1', loaderId: 'L1', url: 'https://app.openheaders.io/' },
    });
    expect(hub.snapshotTab(TAB)).toHaveLength(0);
  });

  it('dispose() detaches both source streams', () => {
    const hub = new PageStreamHub();
    const bus = new TabLifecycleBus();
    const source = new FakeCdpSource();
    const bridge = startCdpPageBridge({ source, hub, bus });
    bridge.dispose();

    source.emit(docRequest());
    source.emitPage({
      method: 'Page.frameNavigated',
      tabId: TAB,
      sessionId: 'page',
      frame: { id: 'F1', loaderId: 'L1', url: 'https://app.openheaders.io/' },
    });
    expect(hub.snapshotTab(TAB)).toHaveLength(0);
  });
});
