/**
 * `HarFeedPresence` — which tabs have a live finished-request feed,
 * folded from the host's presence events.
 */

import { describe, expect, it } from 'vitest';

import { HarFeedPresence } from '../../src/correlator-heuristic/har-feed-presence';

const TAB = 11;
const OTHER_TAB = 12;

describe('HarFeedPresence', () => {
  it('a tab the host never announced has no feed', () => {
    expect(new HarFeedPresence().isLive(TAB)).toBe(false);
  });

  it('a feed opening makes its tab live, and only its tab', () => {
    const feeds = new HarFeedPresence();
    expect(feeds.observe({ kind: 'tab-har-active', tabId: TAB })).toBe(false);
    expect(feeds.isLive(TAB)).toBe(true);
    expect(feeds.isLive(OTHER_TAB)).toBe(false);
  });

  it('the last feed closing reports the loss', () => {
    const feeds = new HarFeedPresence();
    feeds.observe({ kind: 'tab-har-active', tabId: TAB });
    expect(feeds.observe({ kind: 'tab-har-inactive', tabId: TAB })).toBe(true);
    expect(feeds.isLive(TAB)).toBe(false);
  });

  it('a reconnect overlapping the port it replaces is one sustained feed', () => {
    const feeds = new HarFeedPresence();
    feeds.observe({ kind: 'tab-har-active', tabId: TAB });
    feeds.observe({ kind: 'tab-har-active', tabId: TAB });
    expect(feeds.observe({ kind: 'tab-har-inactive', tabId: TAB })).toBe(false);
    expect(feeds.isLive(TAB)).toBe(true);
    expect(feeds.observe({ kind: 'tab-har-inactive', tabId: TAB })).toBe(true);
    expect(feeds.isLive(TAB)).toBe(false);
  });

  it('a close for a tab with no feed is not a loss', () => {
    const feeds = new HarFeedPresence();
    expect(feeds.observe({ kind: 'tab-har-inactive', tabId: TAB })).toBe(false);
    expect(feeds.isLive(TAB)).toBe(false);
  });

  it('a feed can come back after it closed', () => {
    const feeds = new HarFeedPresence();
    feeds.observe({ kind: 'tab-har-active', tabId: TAB });
    feeds.observe({ kind: 'tab-har-inactive', tabId: TAB });
    feeds.observe({ kind: 'tab-har-active', tabId: TAB });
    expect(feeds.isLive(TAB)).toBe(true);
  });
});
