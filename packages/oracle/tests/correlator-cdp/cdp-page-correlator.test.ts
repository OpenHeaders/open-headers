/**
 * `CdpPageCorrelator` — reconstructs HAR `log.pages[]` timings from the CDP
 * `Page.*` lifecycle stream + the document network request, matching
 * Chrome's exporter (`PageLoad.startTime = mainRequest.startTime`; DCL/load
 * from `Page.domContentEventFired` / `Page.loadEventFired`).
 */

import { describe, expect, it } from 'vitest';

import { CdpPageCorrelator } from '../../src/correlator-cdp/cdp-page-correlator';
import type { CdpNetworkEvent } from '../../src/correlator-cdp/events';
import type {
  CdpDomContentEventFired,
  CdpFrameNavigated,
  CdpLoadEventFired,
} from '../../src/correlator-cdp/page-events';

import { cdpRedirect, cdpResponse, cdpStart, type TraceCtx } from './builders';

const TAB = 7;
const ctx: TraceCtx = { tabId: TAB, requestId: 'doc' };

function frameNavigated(loaderId: string, url: string, parentId?: string): CdpFrameNavigated {
  return {
    method: 'Page.frameNavigated',
    tabId: TAB,
    sessionId: 'session-page',
    frame: { id: 'F1', loaderId, url, ...(parentId !== undefined ? { parentId } : {}) },
  };
}

function domContent(timestamp: number): CdpDomContentEventFired {
  return { method: 'Page.domContentEventFired', tabId: TAB, sessionId: 'session-page', timestamp };
}

function loadFired(timestamp: number): CdpLoadEventFired {
  return { method: 'Page.loadEventFired', tabId: TAB, sessionId: 'session-page', timestamp };
}

/** The document request lands its identity + start baseline. */
function docRequest(overrides: { loaderId?: string; wallTime?: number; timestamp?: number } = {}): CdpNetworkEvent {
  return cdpStart(ctx, {
    type: 'Document',
    loaderId: overrides.loaderId ?? 'L1',
    wallTime: overrides.wallTime ?? 1_700_000_000,
    timestamp: overrides.timestamp ?? 100,
    request: { url: 'https://app.openheaders.io/', method: 'GET' },
  });
}

function docResponse(requestTime: number): CdpNetworkEvent {
  return cdpResponse(ctx, {
    response: {
      url: 'https://app.openheaders.io/',
      status: 200,
      statusText: 'OK',
      timing: { requestTime },
    },
  });
}

describe('CdpPageCorrelator — page timing reconstruction', () => {
  it('derives the page start + DCL/load from the document request and Page events', () => {
    const c = new CdpPageCorrelator();
    expect(c.observe(docRequest({ wallTime: 1_700_000_000, timestamp: 100 }))).toEqual([]);
    expect(c.observe(docResponse(100.05))).toEqual([]);

    // startedAtMs = (wallTime 1_700_000_000 - issue 100 + start 100.05) * 1000.
    const started = c.observe(frameNavigated('L1', 'https://app.openheaders.io/'));
    expect(started).toEqual([
      {
        kind: 'nav-started',
        tabId: TAB,
        startedAtMs: 1_700_000_000_050,
        url: 'https://app.openheaders.io/',
        loaderId: 'L1',
      },
    ]);

    // dcl = (101.626 - 100.05) * 1000 = 1576; the raw float carries scaling
    // noise (1576.0000000000077), matching Chrome's unrounded Entry.toMilliseconds.
    const [dclSignal] = c.observe(domContent(101.626));
    expect(dclSignal).toMatchObject({
      kind: 'nav-timing',
      tabId: TAB,
      timing: { pageOrigin: null, navStartMs: 1_700_000_000_050 },
    });
    if (dclSignal.kind === 'nav-timing') {
      expect(dclSignal.timing.dclMs).toBeCloseTo(1576, 6);
    }
    // load = (102.428 - 100.05) * 1000 = 2378 (clean).
    expect(c.observe(loadFired(102.428))).toEqual([
      { kind: 'nav-timing', tabId: TAB, timing: { pageOrigin: null, navStartMs: 1_700_000_000_050, loadMs: 2378 } },
    ]);
  });

  it('ignores a sub-frame navigation (only the top frame is a page boundary)', () => {
    const c = new CdpPageCorrelator();
    c.observe(docRequest());
    c.observe(docResponse(100.05));
    expect(c.observe(frameNavigated('L1', 'https://widget.openheaders.io/', 'parent-frame'))).toEqual([]);
  });

  it('ignores a chrome-error commit (failed navigation — host creates no PageLoad)', () => {
    const c = new CdpPageCorrelator();
    c.observe(docRequest());
    c.observe(docResponse(100.05));
    expect(c.observe(frameNavigated('L1', 'chrome-error://chromewebdata/'))).toEqual([]);
  });

  it('emits nothing for DCL/load before any page boundary', () => {
    const c = new CdpPageCorrelator();
    expect(c.observe(domContent(50))).toEqual([]);
    expect(c.observe(loadFired(60))).toEqual([]);
  });

  it('falls back to the issue time when the document response has not landed', () => {
    const c = new CdpPageCorrelator();
    c.observe(docRequest({ wallTime: 1000, timestamp: 50 }));
    // No docResponse → pageStart = issue time (50); startedAtMs = (1000 - 50 + 50) * 1000.
    expect(c.observe(frameNavigated('L1', 'https://app.openheaders.io/'))).toEqual([
      { kind: 'nav-started', tabId: TAB, startedAtMs: 1_000_000, url: 'https://app.openheaders.io/', loaderId: 'L1' },
    ]);
  });

  it('anchors a redirected navigation to the redirect-chain root (first hop url + start)', () => {
    const c = new CdpPageCorrelator();
    // First hop — the original request; no redirectResponse.
    c.observe(docRequest({ loaderId: 'L1', wallTime: 1000, timestamp: 50 }));
    // The redirect's next hop reuses the request id and carries the 302's
    // own `timing.requestTime` (the chain-root start = 50.0). The host binds
    // `PageLoad` to the first request, so the page must keep the first hop's
    // wall/issue/url, not the committed final hop's.
    const root302 = {
      url: 'https://app.openheaders.io/',
      status: 302,
      statusText: 'Found',
      timing: { requestTime: 50.0 },
    };
    c.observe(
      cdpRedirect(ctx, root302, 'https://app.openheaders.io/v2', {
        type: 'Document',
        loaderId: 'L1',
        wallTime: 1000.1,
        timestamp: 50.1,
      }),
    );
    // A final 200 response lands later; it must NOT overwrite the chain-root start.
    c.observe(docResponse(50.2));
    // startedAtMs = (1000 - 50 + 50.0) * 1000 = 1_000_000; url = the root.
    expect(c.observe(frameNavigated('L1', 'https://app.openheaders.io/v2'))).toEqual([
      { kind: 'nav-started', tabId: TAB, startedAtMs: 1_000_000, url: 'https://app.openheaders.io/', loaderId: 'L1' },
    ]);
  });

  it('leaves a non-redirected navigation anchored to its own document request', () => {
    const c = new CdpPageCorrelator();
    c.observe(docRequest({ loaderId: 'L1', wallTime: 1000, timestamp: 50 }));
    c.observe(docResponse(50.05));
    // startedAtMs = (1000 - 50 + 50.05) * 1000 = 1_000_050; url = the request's.
    expect(c.observe(frameNavigated('L1', 'https://app.openheaders.io/'))).toEqual([
      { kind: 'nav-started', tabId: TAB, startedAtMs: 1_000_050, url: 'https://app.openheaders.io/', loaderId: 'L1' },
    ]);
  });

  it('ignores a non-document request and emits nothing when no document matches the loader', () => {
    const c = new CdpPageCorrelator();
    c.observe(cdpStart(ctx, { type: 'XHR', loaderId: 'L1' }));
    expect(c.observe(frameNavigated('L1', 'https://app.openheaders.io/'))).toEqual([]);
  });

  it('forgetTab drops per-tab state', () => {
    const c = new CdpPageCorrelator();
    c.observe(docRequest());
    c.observe(docResponse(100.05));
    c.forgetTab(TAB);
    // No document remembered → the navigation produces no page.
    expect(c.observe(frameNavigated('L1', 'https://app.openheaders.io/'))).toEqual([]);
  });
});
