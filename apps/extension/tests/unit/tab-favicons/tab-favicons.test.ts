/**
 * Tab favicons — the browser's icons under keys that name their bytes,
 * and the inventory rows that carry them. Asserts:
 *   - a key is stable for the same bytes and differs for other bytes
 *   - the pull answers the keys it holds, leaves the others out, takes
 *     nothing that is not a key, and never more than one pull's worth
 *   - an asker that reads favicons by key gets a key per row; one that
 *     says nothing gets the bytes inline, as every snapshot carried them
 *   - only a frame that says `by-key` asks for keys
 */

import { TELEMETRY_FAVICONS_PER_PULL } from '@openheaders/core/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { faviconsFor, resolveTabFavicon } from '@/background/telemetry-stream-host/tab-favicons';
import { faviconsAskedBy, queryBrowserTabs } from '@/background/telemetry-stream-host/tab-snapshot';

const dataUri = (seed: string): string => `data:image/png;base64,${btoa(`icon ${seed}`)}`;

function listTabs(tabs: Array<Partial<chrome.tabs.Tab>>): void {
  vi.mocked(chrome.tabs.query).mockImplementation(((_query: chrome.tabs.QueryInfo, callback?: unknown) => {
    (callback as (list: Array<Partial<chrome.tabs.Tab>>) => void)(tabs);
  }) as typeof chrome.tabs.query);
}

describe('tab favicons', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('names the same bytes with the same key, on whatever tab they show', async () => {
    const onDocs = await resolveTabFavicon('https://openheaders.io/docs', dataUri('openheaders'));
    const onBlog = await resolveTabFavicon('https://openheaders.io/blog', dataUri('openheaders'));
    const other = await resolveTabFavicon('https://api.openheaders.io/', dataUri('api'));

    expect(onDocs?.key).toMatch(/^[0-9a-f]{16}$/);
    expect(onBlog?.key).toBe(onDocs?.key);
    expect(other?.key).not.toBe(onDocs?.key);
    expect(onDocs?.dataUri).toBe(dataUri('openheaders'));
  });

  it('answers a pull with the keys it holds and leaves the others out', async () => {
    const held = await resolveTabFavicon('https://openheaders.io/', dataUri('held'));
    if (held === undefined) throw new Error('the icon did not resolve');

    expect(faviconsFor([held.key, 'ffffffffffffffff', 7, null])).toEqual({ [held.key]: dataUri('held') });
  });

  it('answers at most one pull’s worth of keys', async () => {
    const keys: string[] = [];
    for (let i = 0; i < TELEMETRY_FAVICONS_PER_PULL + 4; i++) {
      const icon = await resolveTabFavicon(`https://openheaders.io/${i}`, dataUri(`many ${i}`));
      if (icon !== undefined) keys.push(icon.key);
    }
    expect(keys).toHaveLength(TELEMETRY_FAVICONS_PER_PULL + 4);
    expect(Object.keys(faviconsFor(keys))).toEqual(keys.slice(0, TELEMETRY_FAVICONS_PER_PULL));
  });

  it('gives a tab that has no icon neither a key nor bytes', async () => {
    expect(await resolveTabFavicon('', undefined)).toBeUndefined();
  });

  it('reads `by-key` from an asking frame and nothing else', () => {
    expect(faviconsAskedBy({ type: 'oh.telemetry.tabs.subscribe', favicons: 'by-key' })).toBe('by-key');
    expect(faviconsAskedBy({ type: 'oh.telemetry.tabs.subscribe' })).toBeUndefined();
    expect(faviconsAskedBy({ type: 'oh.telemetry.tabs.subscribe', favicons: 'inline' })).toBeUndefined();
    expect(faviconsAskedBy({ type: 'oh.telemetry.tabs.subscribe', favicons: true })).toBeUndefined();
  });

  it('carries a key per row for an asker that reads by key, and the bytes inline for one that does not', async () => {
    listTabs([
      {
        id: 3,
        windowId: 1,
        title: 'Docs',
        url: 'https://openheaders.io/docs',
        active: true,
        favIconUrl: dataUri('row'),
      },
      { id: 4, windowId: 1, title: 'Blank', url: '', active: false },
    ]);

    const byKey = await queryBrowserTabs('by-key');
    expect(byKey[0].favIconKey).toMatch(/^[0-9a-f]{16}$/);
    expect(byKey[0]).not.toHaveProperty('favIconUrl');
    expect(byKey[1]).not.toHaveProperty('favIconKey');
    expect(byKey[1]).not.toHaveProperty('favIconUrl');

    const inline = await queryBrowserTabs();
    expect(inline[0].favIconUrl).toBe(dataUri('row'));
    expect(inline[0]).not.toHaveProperty('favIconKey');

    // The key an asker was given is the one its pull answers.
    expect(faviconsFor([byKey[0].favIconKey])).toEqual({ [byKey[0].favIconKey ?? '']: dataUri('row') });
  });
});
