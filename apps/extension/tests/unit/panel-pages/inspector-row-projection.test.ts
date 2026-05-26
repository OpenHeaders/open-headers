import { describe, expect, it } from 'vitest';

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

import type { InspectorRow } from '@openheaders/ui/panel/data/inspector-facet';
import {
  attachFiresToRows,
  currentHarEntry,
  currentResponseBody,
  isFailedLifecycle,
  isPendingLifecycle,
  resolvePageref,
} from '@openheaders/ui/panel/data/inspector-row-projection';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';

function harEntry(url: string): InspectorHarEntry {
  return {
    startedDateTime: new Date(0).toISOString(),
    time: 0,
    request: { method: 'GET', url, httpVersion: '', headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
  };
}

function harBody(content: string): InspectorHarBody {
  return { method: 'GET', url: 'https://openheaders.io', startedDateTime: new Date(0).toISOString(), content, encoding: '' };
}

function lifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'r1',
    url: 'https://openheaders.io',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    har: new Map(),
    harBodyByHop: new Map(),
    ...over,
  };
}

function fire(over: Partial<InspectorFire> = {}): InspectorFire {
  return {
    ruleUid: 'rule_a',
    t: 1,
    pattern: '*',
    authoritative: true,
    requestId: 'r1',
    evidence: 'confirmed',
    ...over,
  };
}

function row(lc: RequestLifecycle, displayId = 1): InspectorRow {
  return { lifecycle: lc, displayId, consolidatedRetryOf: [] };
}

describe('currentHarEntry / currentResponseBody', () => {
  it('returns null when no har on the current hop', () => {
    expect(currentHarEntry(lifecycle())).toBeNull();
    expect(currentResponseBody(lifecycle())).toBeNull();
  });

  it('returns the current hop entry/body, not hop 0', () => {
    const har = new Map<number, InspectorHarEntry>([
      [0, harEntry('https://openheaders.io/a')],
      [1, harEntry('https://openheaders.io/b')],
    ]);
    const bodies = new Map<number, InspectorHarBody>([[1, harBody('hop1')]]);
    const lc = lifecycle({ redirectHopCount: 1, har, harBodyByHop: bodies });
    expect(currentHarEntry(lc)?.request?.url).toBe('https://openheaders.io/b');
    expect(currentResponseBody(lc)?.content).toBe('hop1');
  });
});

describe('isPendingLifecycle / isFailedLifecycle', () => {
  it('pending is true only in `pending` phase with no statusCode', () => {
    expect(isPendingLifecycle(lifecycle({ phase: 'pending' }))).toBe(true);
    expect(isPendingLifecycle(lifecycle({ phase: 'pending', statusCode: 200 }))).toBe(false);
    expect(isPendingLifecycle(lifecycle({ phase: 'completed' }))).toBe(false);
  });

  it('failed type guard narrows phase', () => {
    const lc = lifecycle({ phase: 'failed' });
    expect(isFailedLifecycle(lc)).toBe(true);
    expect(isFailedLifecycle(lifecycle({ phase: 'completed' }))).toBe(false);
  });
});

describe('resolvePageref', () => {
  const pages: Page[] = [
    { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/a' },
    { id: 'page_2', startedAtMs: 1000, url: 'https://openheaders.io/b' },
  ];

  it('returns the page that was in flight when the lifecycle started', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 500 }), pages)).toBe('page_1');
    expect(resolvePageref(lifecycle({ startedAtMs: 1500 }), pages)).toBe('page_2');
  });

  it('returns null when no page predates the lifecycle', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: -1 }), pages)).toBeNull();
    expect(resolvePageref(lifecycle({ startedAtMs: 500 }), [])).toBeNull();
  });
});

describe('attachFiresToRows', () => {
  it('returns rows-with-empty-fires + empty dangling when no fires', () => {
    const result = attachFiresToRows([row(lifecycle())], []);
    expect(result.rows[0].fires).toEqual([]);
    expect(result.dangling).toEqual([]);
  });

  it('attaches matching fires by exact requestId join', () => {
    const r = row(lifecycle({ requestId: 'r1' }));
    const result = attachFiresToRows([r], [fire({ requestId: 'r1' })]);
    expect(result.rows[0].fires).toHaveLength(1);
    expect(result.dangling).toEqual([]);
  });

  it('routes non-matching fires to dangling', () => {
    const r = row(lifecycle({ requestId: 'r1' }));
    const result = attachFiresToRows([r], [fire({ requestId: 'r2' })]);
    expect(result.rows[0].fires).toEqual([]);
    expect(result.dangling).toHaveLength(1);
  });

  it('scriptable-only fires (no requestId) always dangle', () => {
    const r = row(lifecycle({ requestId: 'r1' }));
    const result = attachFiresToRows([r], [fire({ requestId: undefined })]);
    expect(result.rows[0].fires).toEqual([]);
    expect(result.dangling).toHaveLength(1);
  });

  it('groups multiple fires onto the same row in arrival order', () => {
    const r = row(lifecycle({ requestId: 'r1' }));
    const fires = [fire({ requestId: 'r1', t: 1 }), fire({ requestId: 'r1', t: 2 })];
    const result = attachFiresToRows([r], fires);
    expect(result.rows[0].fires.map((f) => f.t)).toEqual([1, 2]);
  });
});
