/**
 * `ohd status` availability line — one abort-capped feed read, silent
 * on every failure, severity floor always from the STABLE manifest.
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchAvailabilityLine } from '../../src/cli/update-notify';

const STABLE_URL = 'https://updates.openheaders.com/versions/stable.json';
const BETA_URL = 'https://updates.openheaders.com/versions/beta.json';

function feedFetch(byUrl: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const handler = byUrl[String(input)];
    if (!handler) throw new Error(`unexpected fetch: ${String(input)}`);
    return handler();
  }) as unknown as typeof fetch;
}

function manifest(latest: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ daemon: { latest, tag: `v${latest}`, severity: 'normal', ...extra } }));
}

describe('fetchAvailabilityLine', () => {
  it('names a newer release with the upgrade verb', async () => {
    const line = await fetchAvailabilityLine({
      env: {},
      currentVersion: '2026.7.0',
      channel: 'stable',
      fetchFn: feedFetch({ [STABLE_URL]: () => manifest('2026.7.19') }),
    });
    expect(line).toBe('update available: ohd 2026.7.19 (you have 2026.7.0) — run: ohd upgrade');
  });

  it('stays silent when up to date, on dev builds, and under OH_NO_UPDATE_CHECK', async () => {
    const fetchFn = feedFetch({ [STABLE_URL]: () => manifest('2026.7.0') });
    expect(await fetchAvailabilityLine({ env: {}, currentVersion: '2026.7.0', channel: 'stable', fetchFn })).toBeNull();
    expect(await fetchAvailabilityLine({ env: {}, currentVersion: '2026.7.0', channel: null })).toBeNull();
    expect(
      await fetchAvailabilityLine({
        env: { OH_NO_UPDATE_CHECK: '1' },
        currentVersion: '2026.7.0',
        channel: 'stable',
        fetchFn,
      }),
    ).toBeNull();
  });

  it('escalates below the security floor', async () => {
    const line = await fetchAvailabilityLine({
      env: {},
      currentVersion: '2026.7.0',
      channel: 'stable',
      fetchFn: feedFetch({
        [STABLE_URL]: () => manifest('2026.7.19', { severity: 'security', minimumSafeVersion: '2026.7.10' }),
      }),
    });
    expect(line).toContain('SECURITY UPDATE');
    expect(line).toContain('ohd upgrade');
  });

  it('a beta install reads its offer from beta but the floor from stable', async () => {
    const line = await fetchAvailabilityLine({
      env: {},
      currentVersion: '2026.7.15-beta.1',
      channel: 'beta',
      fetchFn: feedFetch({
        [BETA_URL]: () => manifest('2026.7.19-beta.2'),
        [STABLE_URL]: () => manifest('2026.7.18', { severity: 'security', minimumSafeVersion: '2026.7.16' }),
      }),
    });
    expect(line).toContain('SECURITY UPDATE');
    expect(line).toContain('2026.7.19-beta.2');
  });

  it('degrades to silence on any feed failure', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(
      await fetchAvailabilityLine({ env: {}, currentVersion: '2026.7.0', channel: 'stable', fetchFn: failing }),
    ).toBeNull();
  });
});
