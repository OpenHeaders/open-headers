import { describe, expect, it } from 'vitest';

import type { Page, PageStreamUpdate } from '@openheaders/core/page-stream';

import { NOOP, reducePageUpdate } from '@openheaders/ui/panel/data/page-client-reducer';

function page(over: Partial<Page> = {}): Page {
  return {
    id: 'page_1',
    startedAtMs: 100,
    url: null,
    ...over,
  };
}

describe('reducePageUpdate', () => {
  it('page-started appends a fresh page', () => {
    const next = reducePageUpdate([], { kind: 'page-started', tabId: 1, page: page() });
    expect(next).toEqual([page()]);
  });

  it('page-started dedups by id (replay-after-reconnect)', () => {
    const prev = [page({ id: 'page_1' })];
    const update: PageStreamUpdate = { kind: 'page-started', tabId: 1, page: page({ id: 'page_1' }) };
    expect(reducePageUpdate(prev, update)).toBe(NOOP);
  });

  it('page-started replaces in place when the page reference differs', () => {
    const prev = [page({ id: 'page_1', url: null })];
    const next = reducePageUpdate(prev, {
      kind: 'page-started',
      tabId: 1,
      page: page({ id: 'page_1', url: 'https://openheaders.io' }),
    });
    expect(next).not.toBe(NOOP);
    expect((next as readonly Page[])[0].url).toBe('https://openheaders.io');
  });

  it('nav-timing-attached refines the named page url + dcl + load', () => {
    const prev = [page({ id: 'page_1', url: null })];
    const next = reducePageUpdate(prev, {
      kind: 'nav-timing-attached',
      tabId: 1,
      pageId: 'page_1',
      timing: { pageOrigin: 'https://openheaders.io', dclMs: 30, loadMs: 80 },
    });
    expect(next).not.toBe(NOOP);
    expect((next as readonly Page[])[0]).toMatchObject({
      url: 'https://openheaders.io',
      dclMs: 30,
      loadMs: 80,
    });
  });

  it('nav-timing-attached refining only larger timing values', () => {
    const prev = [page({ id: 'page_1', dclMs: 50, loadMs: 100 })];
    const update: PageStreamUpdate = {
      kind: 'nav-timing-attached',
      tabId: 1,
      pageId: 'page_1',
      timing: { pageOrigin: null, dclMs: 10, loadMs: 90 },
    };
    expect(reducePageUpdate(prev, update)).toBe(NOOP);
  });

  it('nav-timing-attached corrects startedAtMs down to navStartMs only', () => {
    const prev = [page({ id: 'page_1', startedAtMs: 250 })];
    const next = reducePageUpdate(prev, {
      kind: 'nav-timing-attached',
      tabId: 1,
      pageId: 'page_1',
      timing: { pageOrigin: null, navStartMs: 100 },
    });
    expect(next).not.toBe(NOOP);
    expect((next as readonly Page[])[0].startedAtMs).toBe(100);

    // A later navStartMs is ignored (no forward shift).
    expect(
      reducePageUpdate(next as readonly Page[], {
        kind: 'nav-timing-attached',
        tabId: 1,
        pageId: 'page_1',
        timing: { pageOrigin: null, navStartMs: 180 },
      }),
    ).toBe(NOOP);
  });

  it('nav-timing-attached NOOP when page id missing', () => {
    const prev = [page({ id: 'page_1' })];
    const next = reducePageUpdate(prev, {
      kind: 'nav-timing-attached',
      tabId: 1,
      pageId: 'ghost',
      timing: { pageOrigin: 'https://openheaders.io' },
    });
    expect(next).toBe(NOOP);
  });

  it('page-document-attached sets the named page documentId', () => {
    const prev = [page({ id: 'page_1' }), page({ id: 'page_2', startedAtMs: 200 })];
    const next = reducePageUpdate(prev, {
      kind: 'page-document-attached',
      tabId: 1,
      pageId: 'page_1',
      documentId: 'D1',
    });
    expect(next).not.toBe(NOOP);
    expect((next as readonly Page[])[0].documentId).toBe('D1');
    expect((next as readonly Page[])[1].documentId).toBeUndefined();
  });

  it('page-document-attached is set-once (mirror of the hub gate) and NOOP on unknown page', () => {
    const prev = [page({ id: 'page_1', documentId: 'D1' })];
    expect(
      reducePageUpdate(prev, { kind: 'page-document-attached', tabId: 1, pageId: 'page_1', documentId: 'D-STALE' }),
    ).toBe(NOOP);
    expect(
      reducePageUpdate(prev, { kind: 'page-document-attached', tabId: 1, pageId: 'page_9', documentId: 'D9' }),
    ).toBe(NOOP);
  });

  it('page-started replaces in place when only documentId differs (replay carries it)', () => {
    const prev = [page({ id: 'page_1' })];
    const next = reducePageUpdate(prev, {
      kind: 'page-started',
      tabId: 1,
      page: page({ id: 'page_1', documentId: 'D1' }),
    });
    expect(next).not.toBe(NOOP);
    expect((next as readonly Page[])[0].documentId).toBe('D1');
  });

  it('tab-cleared empties; NOOP on already-empty', () => {
    expect(reducePageUpdate([], { kind: 'tab-cleared', tabId: 1 })).toBe(NOOP);
    const next = reducePageUpdate([page()], { kind: 'tab-cleared', tabId: 1 });
    expect(next).toEqual([]);
  });
});
