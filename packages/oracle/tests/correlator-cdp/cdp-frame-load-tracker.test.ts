/**
 * `CdpFrameLoadTracker` — the `loadingStoppedAtMs` fact source: a
 * main-frame stop that catches its committed document request still in
 * flight (a document canceled mid-stream gets no Network terminal, so the
 * frame stop is the only record of the interruption). Plus the correlator
 * wiring that turns the tracker's hit into a lifecycle patch.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { CdpFrameLoadTracker } from '../../src/correlator-cdp/cdp-frame-load-tracker';
import { CdpCorrelator } from '../../src/correlator-cdp/correlator';
import type { CdpNetworkEvent } from '../../src/correlator-cdp/events';
import type { CdpPageEvent } from '../../src/correlator-cdp/page-events';

import { InMemoryCdpSource } from './in-memory-source';

const TAB = 7;
const SESSION = 'page';
const LOADER = 'L-doc-1';
const FRAME = 'F-main';

function docRequest(overrides: Partial<Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>> = {}) {
  return {
    method: 'Network.requestWillBeSent',
    tabId: TAB,
    sessionId: SESSION,
    requestId: LOADER,
    loaderId: LOADER,
    documentURL: 'https://app.openheaders.io/',
    request: { url: 'https://app.openheaders.io/', method: 'GET' },
    timestamp: 1,
    wallTime: 1_700_000_000,
    type: 'Document',
    ...overrides,
  } satisfies CdpNetworkEvent;
}

function frameNavigated(overrides: Partial<{ frameId: string; loaderId: string; parentId: string }> = {}) {
  return {
    method: 'Page.frameNavigated',
    tabId: TAB,
    sessionId: SESSION,
    frame: {
      id: overrides.frameId ?? FRAME,
      loaderId: overrides.loaderId ?? LOADER,
      url: 'https://app.openheaders.io/',
      ...(overrides.parentId !== undefined ? { parentId: overrides.parentId } : {}),
    },
  } satisfies CdpPageEvent;
}

function frameStopped(frameId: string = FRAME) {
  return {
    method: 'Page.frameStoppedLoading',
    tabId: TAB,
    sessionId: SESSION,
    frameId,
    atWallMs: 1_700_000_123_456,
  } satisfies CdpPageEvent;
}

function loadingFinished() {
  return {
    method: 'Network.loadingFinished',
    tabId: TAB,
    sessionId: SESSION,
    requestId: LOADER,
    timestamp: 2,
    encodedDataLength: 1234,
  } satisfies CdpNetworkEvent;
}

describe('CdpFrameLoadTracker', () => {
  it('returns the committed document when the main frame stops while it is in flight', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observeNetwork(docRequest());
    expect(tracker.observePage(frameNavigated())).toBeNull();
    expect(tracker.observePage(frameStopped())).toEqual({ sessionId: SESSION, requestId: LOADER });
  });

  it('returns nothing on a clean load — the document terminal precedes the frame stop', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observeNetwork(docRequest());
    tracker.observePage(frameNavigated());
    tracker.observeNetwork(loadingFinished());
    expect(tracker.observePage(frameStopped())).toBeNull();
  });

  it('stamps a frame stop only once', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observeNetwork(docRequest());
    tracker.observePage(frameNavigated());
    expect(tracker.observePage(frameStopped())).not.toBeNull();
    expect(tracker.observePage(frameStopped())).toBeNull();
  });

  it('ignores sub-frame commits and stops of other frames', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observeNetwork(docRequest());
    expect(tracker.observePage(frameNavigated({ frameId: 'F-child', parentId: FRAME }))).toBeNull();
    tracker.observePage(frameNavigated());
    expect(tracker.observePage(frameStopped('F-other'))).toBeNull();
    expect(tracker.observePage(frameStopped())).not.toBeNull();
  });

  it('returns nothing when the commit had no tracked document (mid-flight attach)', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observePage(frameNavigated());
    expect(tracker.observePage(frameStopped())).toBeNull();
  });

  it('a new commit supersedes the prior binding', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observeNetwork(docRequest());
    tracker.observePage(frameNavigated());
    tracker.observeNetwork(docRequest({ requestId: 'L-doc-2', loaderId: 'L-doc-2' }));
    tracker.observePage(frameNavigated({ loaderId: 'L-doc-2' }));
    expect(tracker.observePage(frameStopped())).toEqual({ sessionId: SESSION, requestId: 'L-doc-2' });
  });

  it('forgetTab drops the tab state', () => {
    const tracker = new CdpFrameLoadTracker();
    tracker.observeNetwork(docRequest());
    tracker.observePage(frameNavigated());
    tracker.forgetTab(TAB);
    expect(tracker.observePage(frameStopped())).toBeNull();
  });
});

describe('CdpCorrelator — loadingStoppedAtMs from a main-frame stop', () => {
  it('emits the phase patch for the interrupted document', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    correlator.attachTab(TAB);
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));

    source.emit(docRequest());
    source.emitPage(frameNavigated());
    source.emitPage(frameStopped());

    const patch = collected.find(
      (u) => u.kind === 'phase' && 'loadingStoppedAtMs' in u.patch && u.patch.loadingStoppedAtMs !== undefined,
    );
    expect(patch).toMatchObject({
      kind: 'phase',
      tabId: TAB,
      requestId: `${SESSION}::${LOADER}`,
      patch: { loadingStoppedAtMs: 1_700_000_123_456 },
    });
    correlator.dispose();
  });

  it('emits nothing for a clean load or a detached tab', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    correlator.attachTab(TAB);
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));

    source.emit(docRequest());
    source.emitPage(frameNavigated());
    source.emit(loadingFinished());
    source.emitPage(frameStopped());
    expect(collected.some((u) => u.kind === 'phase' && 'loadingStoppedAtMs' in u.patch)).toBe(false);

    correlator.detachTab(TAB);
    source.emitPage(frameStopped());
    expect(collected.some((u) => u.kind === 'phase' && 'loadingStoppedAtMs' in u.patch)).toBe(false);
    correlator.dispose();
  });
});
