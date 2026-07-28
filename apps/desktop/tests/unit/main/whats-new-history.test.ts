import { CHANGELOG_FEED_BASE } from '@openheaders/core/changelog-feed';
import { describe, expect, it } from 'vitest';
import { fetchWhatsNewEntryBody, fetchWhatsNewHistory } from '../../../src/main/whats-new-history';

const jsonResponse = (body: unknown, ok = true): Response => ({ ok, json: async () => body }) as unknown as Response;

function recordingFetch(body: unknown): { calls: string[]; fetchFn: typeof fetch } {
  const calls: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return jsonResponse(body);
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe('fetchWhatsNewHistory', () => {
  it('reads the desktop stream view and parses its rows', async () => {
    const { calls, fetchFn } = recordingFetch([
      { app: 'desktop', version: '2026.7.27', date: '2026-07-28', channel: 'beta', severity: 'normal', json: 'x' },
    ]);
    expect(await fetchWhatsNewHistory(fetchFn)).toEqual([
      { version: '2026.7.27', date: '2026-07-28', channel: 'beta', severity: 'normal', hasNotes: true },
    ]);
    expect(calls).toEqual([`${CHANGELOG_FEED_BASE}/desktop.json`]);
  });

  it('answers null on non-200, network failure, and foreign bodies', async () => {
    expect(await fetchWhatsNewHistory((async () => jsonResponse([], false)) as typeof fetch)).toBeNull();
    expect(
      await fetchWhatsNewHistory((async () => {
        throw new Error('offline');
      }) as typeof fetch),
    ).toBeNull();
    expect(await fetchWhatsNewHistory((async () => jsonResponse({ rows: [] })) as typeof fetch)).toBeNull();
  });
});

describe('fetchWhatsNewEntryBody', () => {
  it('reads the versioned entry object and extracts the body', async () => {
    const { calls, fetchFn } = recordingFetch({ body_markdown: '## Streams' });
    expect(await fetchWhatsNewEntryBody('2026.7.27', fetchFn)).toBe('## Streams');
    expect(calls).toEqual([`${CHANGELOG_FEED_BASE}/desktop/2026.7.27.json`]);
  });

  it('refuses a non-version string without fetching', async () => {
    const { calls, fetchFn } = recordingFetch({ body_markdown: '## Streams' });
    expect(await fetchWhatsNewEntryBody('../latest', fetchFn)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('answers null on non-200 and entry-less shapes', async () => {
    expect(await fetchWhatsNewEntryBody('2026.7.27', (async () => jsonResponse({}, false)) as typeof fetch)).toBeNull();
    expect(await fetchWhatsNewEntryBody('2026.7.27', (async () => jsonResponse({})) as typeof fetch)).toBeNull();
  });
});
