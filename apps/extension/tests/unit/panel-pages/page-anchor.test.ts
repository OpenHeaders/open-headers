import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { anchorPageTimings, selectMainDocByLoader, selectMainDocByPage } from '@openheaders/ui/panel/data/page-anchor';
import { describe, expect, it } from 'vitest';

function lifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'r1',
    url: 'https://openheaders.io',
    method: 'GET',
    resourceType: 'document',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    har: [],
    harBodyByHop: [],
    ...over,
  };
}

function page(over: Partial<Page> = {}): Page {
  return { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/a', ...over };
}

describe('selectMainDocByLoader', () => {
  it('returns the main document whose loader id matches', () => {
    const docs = [
      lifecycle({ requestId: 'd1', loaderId: 'L1', hopStartedAtMs: 100 }),
      lifecycle({ requestId: 'd2', loaderId: 'L2', hopStartedAtMs: 200 }),
    ];
    expect(selectMainDocByLoader(docs, 'L2')?.requestId).toBe('d2');
  });

  it('prefers the latest hop among same-loader documents (committed hop wins)', () => {
    const docs = [
      lifecycle({ requestId: 'redirect-source', loaderId: 'L1', hopStartedAtMs: 100 }),
      lifecycle({ requestId: 'committed', loaderId: 'L1', hopStartedAtMs: 300 }),
    ];
    expect(selectMainDocByLoader(docs, 'L1')?.requestId).toBe('committed');
  });

  it('ignores non-main-document resource types', () => {
    const docs = [
      lifecycle({ requestId: 'sub', resourceType: 'xmlhttprequest', loaderId: 'L1', hopStartedAtMs: 500 }),
      lifecycle({ requestId: 'doc', resourceType: 'main_frame', loaderId: 'L1', hopStartedAtMs: 100 }),
    ];
    expect(selectMainDocByLoader(docs, 'L1')?.requestId).toBe('doc');
  });

  it('returns null when no main document carries the loader id', () => {
    const docs = [lifecycle({ requestId: 'd1', loaderId: 'L1' })];
    expect(selectMainDocByLoader(docs, 'L9')).toBeNull();
    expect(selectMainDocByLoader([], 'L1')).toBeNull();
  });
});

describe('selectMainDocByPage — loader-bound grouping', () => {
  const pages: Page[] = [
    page({ id: 'page_1', startedAtMs: 0, loaderId: 'L1' }),
    page({ id: 'page_2', startedAtMs: 1000, loaderId: 'L2' }),
  ];

  it('binds each page to its loader-matched committed document', () => {
    const docs = [
      lifecycle({ requestId: 'doc1', startedAtMs: 5, hopStartedAtMs: 5, loaderId: 'L1' }),
      lifecycle({ requestId: 'doc2', startedAtMs: 1005, hopStartedAtMs: 1005, loaderId: 'L2' }),
    ];
    const byPage = selectMainDocByPage(pages, docs);
    expect(byPage.get('page_1')?.requestId).toBe('doc1');
    expect(byPage.get('page_2')?.requestId).toBe('doc2');
  });

  it('keeps a transition-window document on its own page via the loader join', () => {
    // doc1's hop starts after page_2 began (slow nav). Start-time proximity
    // would group it under page_2; the loader id pins it to page_1.
    const docs = [
      lifecycle({ requestId: 'doc1', startedAtMs: 1500, hopStartedAtMs: 1500, loaderId: 'L1' }),
      lifecycle({ requestId: 'doc2', startedAtMs: 1005, hopStartedAtMs: 1005, loaderId: 'L2' }),
    ];
    const byPage = selectMainDocByPage(pages, docs);
    expect(byPage.get('page_1')?.requestId).toBe('doc1');
    expect(byPage.get('page_2')?.requestId).toBe('doc2');
  });
});

describe('anchorPageTimings', () => {
  it('re-anchors the page start to the document network start and shifts milestones', () => {
    const p = page({ startedAtMs: 100, dclMs: 500, loadMs: 800 });
    const doc = lifecycle({ hopStartedAtMs: 150, hopNetworkStartMs: 150 });
    const anchored = anchorPageTimings(p, doc);
    expect(anchored.startedAtMs).toBe(150);
    expect(anchored.dclMs).toBe(450);
    expect(anchored.loadMs).toBe(750);
  });

  it('returns the page values unchanged when no document is known', () => {
    const p = page({ startedAtMs: 100, dclMs: 500, loadMs: 800 });
    expect(anchorPageTimings(p, undefined)).toEqual({ startedAtMs: 100, dclMs: 500, loadMs: 800 });
  });

  it('never shifts the block backward when the document starts before the page', () => {
    const p = page({ startedAtMs: 200, dclMs: 500 });
    const doc = lifecycle({ hopStartedAtMs: 100, hopNetworkStartMs: 100 });
    expect(anchorPageTimings(p, doc).startedAtMs).toBe(200);
  });
});
