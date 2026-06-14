import { describe, expect, it } from 'vitest';
import { type CdpRosterTab, readCdpPinnedTabs, readCdpRoster } from '../../src/types/cdp';

const tab: CdpRosterTab = {
  tabId: 7,
  windowId: 3,
  index: 2,
  title: 'Docs',
  url: 'https://openheaders.io/docs',
  pinned: true,
};

describe('readCdpRoster', () => {
  it('returns a well-formed roster verbatim', () => {
    expect(readCdpRoster({ tabs: [tab] })).toEqual([tab]);
  });

  it('returns [] for an absent context', () => {
    expect(readCdpRoster(undefined)).toEqual([]);
  });

  it('returns [] when the context has no tabs', () => {
    expect(readCdpRoster({ enabled: true })).toEqual([]);
  });

  it('returns [] for a malformed roster (defends a stale / partial payload)', () => {
    expect(readCdpRoster({ tabs: [{ tabId: '7', title: 'Docs' }] })).toEqual([]);
    expect(readCdpRoster({ tabs: 'not-an-array' })).toEqual([]);
  });
});

describe('readCdpPinnedTabs', () => {
  it('reads a well-formed pinned-tab id list', () => {
    expect(readCdpPinnedTabs({ pinnedTabs: [4, 9] })).toEqual([4, 9]);
  });

  it('returns [] for absent / malformed payloads', () => {
    expect(readCdpPinnedTabs(undefined)).toEqual([]);
    expect(readCdpPinnedTabs({ enabled: false })).toEqual([]);
    expect(readCdpPinnedTabs({ pinnedTabs: ['4'] })).toEqual([]);
  });
});
