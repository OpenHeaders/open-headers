/**
 * "Log XMLHttpRequests" derivation — one synthesized console entry per
 * terminal XHR-category request, phrased and leveled the browser's way.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { deriveXhrLogEntries, isXhrLogEntry } from '@openheaders/ui/panel/data/console-xhr-log';
import { describe, expect, it } from 'vitest';

function makeLifecycle(
  opts: Omit<Partial<RequestLifecycle>, 'har'> & { har?: Partial<InspectorHarEntry> | null } = {},
): RequestLifecycle {
  const url = opts.url ?? 'https://api.openheaders.io/data';
  const har: InspectorHarEntry | null =
    opts.har === null
      ? null
      : ({
          startedDateTime: '2026-07-13T00:00:00.000Z',
          request: { method: opts.method ?? 'GET', url, headers: [], queryString: [] },
          response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'application/json' } },
          _resourceType: 'fetch',
          ...(opts.har ?? {}),
        } as InspectorHarEntry);
  const { har: _ignored, ...rest } = opts;
  return {
    tabId: 1,
    requestId: 'page::9.1',
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    completedAtMs: 2_000,
    statusCode: 200,
    statusText: 'OK',
    har: [har],
    harBodyByHop: [],
    ...rest,
  };
}

const rows = (...lifecycles: RequestLifecycle[]) => lifecycles.map((lifecycle) => ({ lifecycle }));

describe('deriveXhrLogEntries', () => {
  it('a completed fetch yields the browser phrasing at Info level with the request join key', () => {
    const [entry] = deriveXhrLogEntries(rows(makeLifecycle()));
    expect(entry.args[0].text).toBe('Fetch finished loading: GET "https://api.openheaders.io/data".');
    expect(entry.level).toBe('info');
    expect(entry.source).toBe('browser');
    expect(entry.category).toBe('network');
    expect(entry.requestId).toBe('page::9.1');
    expect(entry.timestamp).toBe(2_000);
    expect(entry.xhrLog).toEqual({ kindLabel: 'Fetch', failed: false });
    expect(isXhrLogEntry(entry)).toBe(true);
  });

  it('the kind label follows the precise resource type — XHR / Fetch / EventSource', () => {
    const entries = deriveXhrLogEntries(
      rows(
        makeLifecycle({ har: { _resourceType: 'xhr' } as Partial<InspectorHarEntry> }),
        makeLifecycle({ requestId: 'page::9.2', har: { _resourceType: 'eventsource' } as Partial<InspectorHarEntry> }),
        // No HAR yet — falls back to the webRequest vocabulary.
        makeLifecycle({ requestId: 'page::9.3', har: null }),
      ),
    );
    expect(entries.map((e) => e.xhrLog.kindLabel)).toEqual(['XHR', 'EventSource', 'XHR']);
  });

  it('a failed phase or an HTTP error status phrases as "failed loading" (still Info — browser parity)', () => {
    const entries = deriveXhrLogEntries(
      rows(
        makeLifecycle({ phase: 'failed', error: { code: 'net::ERR_FAILED', reason: 'failed' } }),
        makeLifecycle({ requestId: 'page::9.2', statusCode: 404 }),
      ),
    );
    expect(entries.every((e) => e.xhrLog.failed)).toBe(true);
    expect(entries.every((e) => e.level === 'info')).toBe(true);
    expect(entries[0].args[0].text).toContain('failed loading');
  });

  it('skips in-flight requests, non-XHR categories, and synthetic redirect-hop rows', () => {
    const entries = deriveXhrLogEntries(
      rows(
        makeLifecycle({ phase: 'pending', completedAtMs: undefined }),
        makeLifecycle({
          requestId: 'page::9.2',
          resourceType: 'script',
          har: { _resourceType: 'script' } as Partial<InspectorHarEntry>,
        }),
        makeLifecycle({ requestId: 'oh-redir:page::9.3#0' }),
      ),
    );
    expect(entries).toHaveLength(0);
  });

  it('orders by terminal timestamp', () => {
    const entries = deriveXhrLogEntries(
      rows(
        makeLifecycle({ requestId: 'page::9.2', completedAtMs: 5_000 }),
        makeLifecycle({ requestId: 'page::9.1', completedAtMs: 3_000 }),
      ),
    );
    expect(entries.map((e) => e.requestId)).toEqual(['page::9.1', 'page::9.2']);
  });
});
