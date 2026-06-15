import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { MATERIAL_DEBUG_PAUSE_MS } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import type { SupersessionAnchor } from '@openheaders/ui/panel/data/request-state';
import { classifyRowAnnotations, type RowAnnotationContext } from '@openheaders/ui/panel/data/row-annotations';
import { describe, expect, it } from 'vitest';

function makeLifecycle(
  opts: Omit<Partial<RequestLifecycle>, 'har'> & { har?: Partial<InspectorHarEntry> | null } = {},
): RequestLifecycle {
  const url = opts.url ?? 'https://app.openheaders.io/';
  const har: InspectorHarEntry | null =
    opts.har === null
      ? null
      : ({
          startedDateTime: '2026-06-10T00:00:00.000Z',
          request: { method: 'GET', url, headers: [], queryString: [] },
          response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/html' } },
          ...(opts.har ?? {}),
        } as InspectorHarEntry);
  const { har: _ignored, ...rest } = opts;
  return {
    tabId: 1,
    requestId: 'req-1',
    url,
    method: 'GET',
    resourceType: 'main_frame',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    statusCode: 200,
    statusText: 'OK',
    har: [har],
    harBodyByHop: [],
    ...rest,
  };
}

const NO_NAV: SupersessionAnchor = { latestNavStartedAtMs: -1 };

function ctx(overrides: Partial<RowAnnotationContext> = {}): RowAnnotationContext {
  return { anchor: NO_NAV, source: 'heuristic', ...overrides };
}

function kinds(lc: RequestLifecycle, c: RowAnnotationContext): string[] {
  return classifyRowAnnotations(lc, c).map((a) => a.kind);
}

describe('classifyRowAnnotations — routine rows stay blank', () => {
  it('clean 200', () => {
    expect(kinds(makeLifecycle({ completedAtMs: 2_000 }), ctx())).toEqual([]);
  });

  it('clean 404 (visible in the parity cells)', () => {
    const lc = makeLifecycle({
      statusCode: 404,
      statusText: 'Not Found',
      completedAtMs: 2_000,
      har: { response: { status: 404, statusText: 'Not Found', headers: [], content: { size: 0, mimeType: '' } } },
    });
    expect(kinds(lc, ctx())).toEqual([]);
  });

  it('plain (canceled) with no status (visible in the parity cells)', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      error: { code: 'net::ERR_ABORTED', reason: 'canceled' },
      completedAtMs: 1_500,
      har: null,
    });
    expect(kinds(lc, ctx())).toEqual([]);
  });

  it('in-flight streaming row (no terminal, no frame stop)', () => {
    const lc = makeLifecycle({
      phase: 'headers-received',
      bytesReceivedSoFar: 4_096,
      lastActivityAtMs: 1_400,
      har: null,
    });
    expect(kinds(lc, ctx({ source: 'cdp' }))).toEqual([]);
  });
});

describe('classifyRowAnnotations — transfer interrupted', () => {
  it('heuristic canceled-mid-stream doc (abort terminal + 200, no bytes/body) → interrupted + fidelity gap', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      error: { code: 'net::ERR_ABORTED', reason: 'canceled' },
      completedAtMs: 2_500,
      har: { response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/html' } } },
    });
    const annotations = classifyRowAnnotations(lc, ctx());
    expect(annotations.map((a) => a.kind)).toEqual(['interrupted', 'fidelity-gap']);
    expect(annotations[0].severity).toBe('warn');
  });

  it('document-teardown failure (bare ERR_FAILED on a frame hop with a wire status) → interrupted', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
      completedAtMs: 2_500,
    });
    expect(kinds(lc, ctx())).toContain('interrupted');
  });

  it('CDP canceled-mid-stream doc (no terminal, frame-stop fact) → interrupted only', () => {
    const lc = makeLifecycle({
      phase: 'headers-received',
      loadingStoppedAtMs: 2_500,
      bytesReceivedSoFar: 131_072,
      lastActivityAtMs: 2_400,
      har: null,
    });
    expect(kinds(lc, ctx({ source: 'cdp' }))).toEqual(['interrupted']);
  });

  it('no interrupted annotation without a successful status', () => {
    const lc = makeLifecycle({
      phase: 'headers-received',
      statusCode: undefined,
      statusText: undefined,
      loadingStoppedAtMs: 2_500,
      har: null,
    });
    expect(kinds(lc, ctx({ source: 'cdp' }))).toEqual([]);
  });

  it('CDP path reports no fidelity gap (its bytes/body are recordable)', () => {
    const lc = makeLifecycle({
      phase: 'headers-received',
      loadingStoppedAtMs: 2_500,
      har: null,
    });
    expect(kinds(lc, ctx({ source: 'cdp' }))).toEqual(['interrupted']);
  });
});

describe('classifyRowAnnotations — never finished (preserved unknown)', () => {
  const NAV_ANCHOR: SupersessionAnchor = {
    latestNavStartedAtMs: 5_000,
    latestPageLoaderId: 'L-new',
    navStartsMs: [5_000],
    pageLoaderIds: ['L-old', 'L-new'],
  };

  it('superseded non-terminal row with no data → never-finished (+ fidelity gap on heuristic)', () => {
    const lc = makeLifecycle({ phase: 'headers-received', loaderId: 'L-old', har: null });
    expect(kinds(lc, ctx({ anchor: NAV_ANCHOR }))).toEqual(['never-finished', 'fidelity-gap']);
    expect(kinds(lc, ctx({ anchor: NAV_ANCHOR, source: 'cdp' }))).toEqual(['never-finished']);
  });

  it('navigation-abort with streamed data keeps its status → interrupted, not never-finished', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      error: { code: 'net::ERR_ABORTED', reason: 'canceled' },
      completedAtMs: 6_000,
      lastActivityAtMs: 5_500,
      bytesReceivedSoFar: 2_048,
      har: { response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/html' } } },
    });
    expect(kinds(lc, ctx({ anchor: NAV_ANCHOR }))).toContain('interrupted');
    expect(kinds(lc, ctx({ anchor: NAV_ANCHOR }))).not.toContain('never-finished');
  });
});

describe('classifyRowAnnotations — debug-mode interception hold', () => {
  it('material hold on a clean 200 → debug-paused (info); detail names the ms, click lands on timing', () => {
    const lc = makeLifecycle({ completedAtMs: 2_000, pausedByDebugMs: 42 });
    const annotations = classifyRowAnnotations(lc, ctx({ source: 'cdp' }));
    expect(annotations.map((a) => a.kind)).toEqual(['debug-paused']);
    expect(annotations[0].severity).toBe('info');
    expect(annotations[0].detail).toContain('42 ms');
    expect(annotations[0].section).toBe('timing');
  });

  it('immaterial sub-threshold hold → no annotation', () => {
    const lc = makeLifecycle({ completedAtMs: 2_000, pausedByDebugMs: MATERIAL_DEBUG_PAUSE_MS - 1 });
    expect(kinds(lc, ctx({ source: 'cdp' }))).toEqual([]);
  });

  it('no hold recorded → no annotation', () => {
    expect(kinds(makeLifecycle({ completedAtMs: 2_000 }), ctx({ source: 'cdp' }))).toEqual([]);
  });

  it('rides alongside a warn annotation — interrupted keeps the lead glyph', () => {
    const lc = makeLifecycle({
      phase: 'headers-received',
      loadingStoppedAtMs: 2_500,
      pausedByDebugMs: 30,
      har: null,
    });
    expect(kinds(lc, ctx({ source: 'cdp' }))).toEqual(['interrupted', 'debug-paused']);
  });
});

describe('classifyRowAnnotations — synthesized rows', () => {
  it('oh-har: synthesized (canceled) row', () => {
    const lc = makeLifecycle({
      requestId: 'oh-har:3',
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      error: { code: 'net::ERR_ABORTED', reason: 'canceled' },
      completedAtMs: 2_000,
      har: null,
    });
    const annotations = classifyRowAnnotations(lc, ctx());
    expect(annotations.map((a) => a.kind)).toEqual(['synthetic']);
    expect(annotations[0].detail).toContain('never joined');
  });

  it('oh-mem: memory-cache row', () => {
    const lc = makeLifecycle({ requestId: 'oh-mem:1', completedAtMs: 1_200 });
    const annotations = classifyRowAnnotations(lc, ctx());
    expect(annotations.map((a) => a.kind)).toEqual(['synthetic']);
    expect(annotations[0].detail).toContain('Resource Timing');
  });
});
