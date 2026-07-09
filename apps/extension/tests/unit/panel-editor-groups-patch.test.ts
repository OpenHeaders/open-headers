/**
 * updateTabInLeaf's per-kind patch rules over the tab union — foreign
 * fields drop, and a dom-storage-entry `entryKey` patch is an IDENTITY
 * move: id and label re-derive from the new key and the leaf's active
 * pointer follows, so re-opens and row highlights keep matching a
 * renamed entry.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { EditorLeaf, EditorNode } from '@openheaders/ui/panel/data/editor-groups';
import { insertTabIntoLeaf, makeLeaf, updateTabInLeaf } from '@openheaders/ui/panel/data/editor-groups';
import type { InspectorTab } from '@openheaders/ui/panel/data/inspector-tab';
import {
  buildCacheEntryTab,
  buildCookieTab,
  buildDomStorageEntryTab,
  buildInspectorTab,
  cacheEntryLabel,
  cacheEntryTabId,
  cookieTabId,
  domStorageEntryTabId,
  tabIsDirty,
  tabPillLabel,
  tabSearchText,
  tabTitle,
} from '@openheaders/ui/panel/data/inspector-tab';
import { describe, expect, it } from 'vitest';

const DOM_TAB = buildDomStorageEntryTab({
  frameId: 0,
  area: 'local',
  entryKey: 'oh-theme',
  timestamp: 1_770_000_000_000,
});

const COOKIE_TAB = buildCookieTab({
  cookieKey: { name: 'sid', domain: 'openheaders.io', path: '/', secure: true },
  scopeUrl: 'https://openheaders.io/',
  timestamp: 1_770_000_000_000,
});

const REQUEST_TAB = buildInspectorTab({
  lifecycle: {
    requestId: 'req-1',
    url: 'https://openheaders.io/api/data',
    method: 'GET',
    statusCode: 200,
    startedAtMs: 1_770_000_000_000,
  } as unknown as RequestLifecycle,
  displayId: 1,
});

function leafWith(...tabs: InspectorTab[]): EditorNode {
  return tabs.reduce<EditorNode>((acc, tab) => insertTabIntoLeaf(acc, 'leaf-root', tab), makeLeaf('leaf-root'));
}

describe('updateTabInLeaf over the tab union', () => {
  it('re-keys a dom-storage-entry on an entryKey patch: id, label and active pointer follow', () => {
    const root = leafWith(REQUEST_TAB, DOM_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', DOM_TAB.id, {
      entryKey: 'oh-appearance',
      dirty: false,
    }) as EditorLeaf;

    const renamed = next.tabs.find((t) => t.kind === 'dom-storage-entry');
    expect(renamed).toMatchObject({
      id: domStorageEntryTabId(0, 'local', 'oh-appearance'),
      label: 'oh-appearance',
      entryKey: 'oh-appearance',
    });
    // The renamed tab was active — the leaf's pointer moves with it.
    expect(next.activeTabId).toBe(domStorageEntryTabId(0, 'local', 'oh-appearance'));
  });

  it('patches dirty on a dom-storage-entry and reports it through tabIsDirty', () => {
    const root = leafWith(DOM_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', DOM_TAB.id, { dirty: true }) as EditorLeaf;
    expect(next.tabs[0] && tabIsDirty(next.tabs[0])).toBe(true);
  });

  it('re-keys a cookie tab on a cookieKey identity patch: id, label and active pointer follow', () => {
    const root = leafWith(REQUEST_TAB, COOKIE_TAB);
    const movedKey = { name: 'sid2', domain: 'openheaders.io', path: '/', secure: true };
    const next = updateTabInLeaf(root, 'leaf-root', COOKIE_TAB.id, { cookieKey: movedKey, dirty: false }) as EditorLeaf;

    const rekeyed = next.tabs.find((t) => t.kind === 'cookie');
    expect(rekeyed).toMatchObject({
      id: cookieTabId(movedKey),
      label: 'sid2',
      cookieKey: movedKey,
    });
    expect(next.activeTabId).toBe(cookieTabId(movedKey));
  });

  it('a cookieKey patch resolving to the same identity is a no-op', () => {
    const root = leafWith(COOKIE_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', COOKIE_TAB.id, { cookieKey: { ...COOKIE_TAB.cookieKey } });
    expect(next).toBe(root);
  });

  it('drops fields foreign to the tab kind (entryKey on a request tab is a no-op)', () => {
    const root = leafWith(REQUEST_TAB);
    const next = updateTabInLeaf(root, 'leaf-root', REQUEST_TAB.id, { entryKey: 'oh-x' });
    expect(next).toBe(root);
  });

  it('a cache-entry tab is patch-inert — read-only documents carry no view state', () => {
    const root = leafWith(CACHE_TAB);
    expect(updateTabInLeaf(root, 'leaf-root', CACHE_TAB.id, { dirty: true })).toBe(root);
    expect(updateTabInLeaf(root, 'leaf-root', CACHE_TAB.id, { entryKey: 'oh-x' })).toBe(root);
    expect(tabIsDirty(CACHE_TAB)).toBe(false);
  });
});

const CACHE_TAB = buildCacheEntryTab({
  frameId: 0,
  cache: 'oh-assets-v1',
  url: 'https://openheaders.io/assets/logo.gif',
  method: 'GET',
  timestamp: 1_770_000_000_000,
});

describe('cache-entry tab union arm', () => {
  it('derives identity from frame + cache + method + url, so re-opens dedupe', () => {
    expect(CACHE_TAB.id).toBe(cacheEntryTabId(0, 'oh-assets-v1', 'https://openheaders.io/assets/logo.gif', 'GET'));
    const again = buildCacheEntryTab({
      frameId: 0,
      cache: 'oh-assets-v1',
      url: 'https://openheaders.io/assets/logo.gif',
      method: 'GET',
      timestamp: 1_770_000_000_999,
    });
    expect(again.id).toBe(CACHE_TAB.id);
  });

  it('labels with the URL tail: last path segment + query, hostname for roots, raw for unparsable', () => {
    expect(CACHE_TAB.label).toBe('logo.gif');
    expect(cacheEntryLabel('https://openheaders.io/api/data?page=2')).toBe('data?page=2');
    expect(cacheEntryLabel('https://openheaders.io/')).toBe('openheaders.io');
    expect(cacheEntryLabel('not a url')).toBe('not a url');
  });

  it('feeds the per-kind helpers: title, pill label and search haystack', () => {
    expect(tabTitle(CACHE_TAB)).toBe('oh-assets-v1 › https://openheaders.io/assets/logo.gif');
    expect(tabPillLabel(CACHE_TAB)).toBe('logo.gif');
    expect(tabSearchText(CACHE_TAB)).toBe('oh-assets-v1 https://openheaders.io/assets/logo.gif GET');
  });
});
