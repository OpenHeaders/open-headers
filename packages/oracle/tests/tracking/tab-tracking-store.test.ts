/**
 * tab-tracking-store typed-mutator API.
 *
 * Covers every mutator's externally-observable shape, iteration
 * determinism, hasTrackedResource truthiness, and snapshot
 * immutability. Module state is global, so each test clears the
 * store in beforeEach.
 */

import type { TrackedResource } from '@openheaders/core/types';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAllTracking,
  dropTab,
  dropTrackedUrl,
  getTrackedResourceMap,
  getTrackedTabCount,
  hasTrackedResource,
  hasTrackedTab,
  iterateTrackedEntries,
  mergeTrackedResources,
  replaceTabResources,
  setTrackedResource,
  snapshotTrackedTabs,
  transferTabTracking,
} from '@openheaders/oracle/tracking/tab-tracking-store';

function makeResource(overrides: Partial<TrackedResource> = {}): TrackedResource {
  const now = Date.now();
  return {
    firstSeenTs: now,
    lastSeenTs: now,
    timestamp: now,
    resourceType: 'xmlhttprequest',
    sources: new Set(['webRequest']),
    servedFromCache: false,
    ...overrides,
  };
}

beforeEach(() => {
  clearAllTracking();
});

describe('setTrackedResource', () => {
  it('inserts a new entry and returns true', () => {
    const inserted = setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    expect(inserted).toBe(true);
    expect(hasTrackedResource(1, 'https://openheaders.io/a')).toBe(true);
    expect(getTrackedTabCount()).toBe(1);
  });

  it('merges sources on re-insert and returns false', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    const inserted = setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'perfObserver', true);
    expect(inserted).toBe(false);
    const res = getTrackedResourceMap(1)!.get('https://openheaders.io/a')!;
    expect(res.sources.has('webRequest')).toBe(true);
    expect(res.sources.has('perfObserver')).toBe(true);
    // servedFromCache was false from the first insert — second observation
    // (cache hit) must not flip it to true.
    expect(res.servedFromCache).toBe(false);
  });
});

describe('dropTab', () => {
  it('removes the tab and returns true', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    expect(dropTab(1)).toBe(true);
    expect(hasTrackedTab(1)).toBe(false);
  });

  it('returns false when the tab has no tracking', () => {
    expect(dropTab(99)).toBe(false);
  });
});

describe('dropTrackedUrl', () => {
  it('removes a single URL and keeps the tab when others remain', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    setTrackedResource(1, 'https://openheaders.io/b', 'xmlhttprequest', 'webRequest', false);
    expect(dropTrackedUrl(1, 'https://openheaders.io/a')).toBe(true);
    expect(hasTrackedResource(1, 'https://openheaders.io/a')).toBe(false);
    expect(hasTrackedResource(1, 'https://openheaders.io/b')).toBe(true);
    expect(hasTrackedTab(1)).toBe(true);
  });

  it('cascades to dropTab when the last URL is removed', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    expect(dropTrackedUrl(1, 'https://openheaders.io/a')).toBe(true);
    expect(hasTrackedTab(1)).toBe(false);
  });

  it('returns false on unknown tab or url', () => {
    expect(dropTrackedUrl(1, 'https://openheaders.io/a')).toBe(false);
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    expect(dropTrackedUrl(1, 'https://openheaders.io/other')).toBe(false);
  });
});

describe('replaceTabResources', () => {
  it('overwrites the tab entry with the new map', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    const next = new Map<string, TrackedResource>([
      ['https://openheaders.io/b', makeResource()],
      ['https://openheaders.io/c', makeResource()],
    ]);
    replaceTabResources(1, next);
    expect(hasTrackedResource(1, 'https://openheaders.io/a')).toBe(false);
    expect(hasTrackedResource(1, 'https://openheaders.io/b')).toBe(true);
    expect(getTrackedResourceMap(1)!.size).toBe(2);
  });

  it('drops the tab entirely when the new map is empty', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    replaceTabResources(1, new Map());
    expect(hasTrackedTab(1)).toBe(false);
  });
});

describe('transferTabTracking', () => {
  it('moves the inner map from source to target tab', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    expect(transferTabTracking(1, 2)).toBe(true);
    expect(hasTrackedTab(1)).toBe(false);
    expect(hasTrackedResource(2, 'https://openheaders.io/a')).toBe(true);
  });

  it('returns false when the source has no tracking', () => {
    expect(transferTabTracking(99, 2)).toBe(false);
    expect(hasTrackedTab(2)).toBe(false);
  });
});

describe('mergeTrackedResources', () => {
  it('inserts new urls and preserves existing entries', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    const live = getTrackedResourceMap(1)!.get('https://openheaders.io/a')!;
    const liveTs = live.firstSeenTs;
    mergeTrackedResources(1, [
      ['https://openheaders.io/a', makeResource({ firstSeenTs: 0 })],
      ['https://openheaders.io/b', makeResource()],
    ]);
    // Live entry untouched.
    expect(getTrackedResourceMap(1)!.get('https://openheaders.io/a')!.firstSeenTs).toBe(liveTs);
    expect(hasTrackedResource(1, 'https://openheaders.io/b')).toBe(true);
  });

  it('does not leave an empty tab entry when given no entries on a new tab', () => {
    mergeTrackedResources(5, []);
    expect(hasTrackedTab(5)).toBe(false);
  });
});

describe('iterateTrackedEntries', () => {
  it('yields every tab in insertion order', () => {
    setTrackedResource(3, 'https://openheaders.io/x', 'xmlhttprequest', 'webRequest', false);
    setTrackedResource(1, 'https://openheaders.io/y', 'xmlhttprequest', 'webRequest', false);
    setTrackedResource(2, 'https://openheaders.io/z', 'xmlhttprequest', 'webRequest', false);
    const ids = [...iterateTrackedEntries()].map(([tabId]) => tabId);
    expect(ids).toEqual([3, 1, 2]);
  });
});

describe('snapshotTrackedTabs', () => {
  it('returns a deep copy that does not observe later mutations', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    const snap = snapshotTrackedTabs();
    setTrackedResource(1, 'https://openheaders.io/b', 'xmlhttprequest', 'webRequest', false);
    dropTab(1);
    // Snapshot still sees the original single-entry tab.
    expect(snap.has(1)).toBe(true);
    expect(snap.get(1)!.size).toBe(1);
    expect(snap.get(1)!.has('https://openheaders.io/a')).toBe(true);
  });
});
