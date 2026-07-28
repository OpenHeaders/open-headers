import { CHANGELOG_FEED_BASE } from '@openheaders/core/changelog-feed';
import { describe, expect, it } from 'vitest';
import { createWhatsNewHistoryApi } from '../../../src/host/whats-new-history';

const jsonResponse = (body: unknown, ok = true): Response => ({ ok, json: async () => body }) as unknown as Response;

function recordingFetch(body: unknown): { calls: string[]; fetchFn: typeof fetch } {
  const calls: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return jsonResponse(body);
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe('createWhatsNewHistoryApi', () => {
  it('lists the extension stream view rows', async () => {
    const { calls, fetchFn } = recordingFetch([
      { app: 'extension', version: '2026.7.27', date: '2026-07-28', channel: 'stable', severity: 'normal', json: 'x' },
    ]);
    expect(await createWhatsNewHistoryApi(fetchFn).list()).toEqual([
      { version: '2026.7.27', date: '2026-07-28', channel: 'stable', severity: 'normal', hasNotes: true },
    ]);
    expect(calls).toEqual([`${CHANGELOG_FEED_BASE}/extension.json`]);
  });

  it('reads a release entry body from the extension stream', async () => {
    const { calls, fetchFn } = recordingFetch({ body_markdown: '## Rules' });
    expect(await createWhatsNewHistoryApi(fetchFn).entryBody('2026.7.27')).toBe('## Rules');
    expect(calls).toEqual([`${CHANGELOG_FEED_BASE}/extension/2026.7.27.json`]);
  });

  it('answers null on failures and never fetches a non-version string', async () => {
    const failing = (async () => {
      throw new Error('permission declined');
    }) as typeof fetch;
    expect(await createWhatsNewHistoryApi(failing).list()).toBeNull();
    expect(await createWhatsNewHistoryApi(failing).entryBody('2026.7.27')).toBeNull();
    const { calls, fetchFn } = recordingFetch({ body_markdown: '## Rules' });
    expect(await createWhatsNewHistoryApi(fetchFn).entryBody('latest')).toBeNull();
    expect(calls).toEqual([]);
  });
});
