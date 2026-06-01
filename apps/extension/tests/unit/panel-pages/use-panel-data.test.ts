/**
 * `usePanelData` — composer hook over the three client snapshots. Tests
 * the pure projection behavior: row construction, fire attachment,
 * dangling partition, nav-timing derivation from the latest page,
 * initiator children resolver, status-bar totals.
 *
 * Hook is a `useMemo` over the inputs; renderHook gives us the result
 * shape and lets us assert reference stability across re-renders with
 * identical input identities.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

import type { FireClientSnapshot } from '@openheaders/ui/panel/data/fire-client-store';
import type { LifecycleClientSnapshot } from '@openheaders/ui/panel/data/lifecycle-client-store';
import type { PageClientSnapshot } from '@openheaders/ui/panel/data/page-client-store';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { usePanelData } from '@openheaders/ui/panel/data/use-panel-data';

function har(
  url: string,
  overrides: { initiatorUrl?: string; bodySize?: number; contentSize?: number; status?: number } = {},
): InspectorHarEntry {
  const { initiatorUrl, bodySize, contentSize, status } = overrides;
  return {
    startedDateTime: new Date(0).toISOString(),
    time: 0,
    request: {
      method: 'GET',
      url,
      httpVersion: '',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: status ?? 200,
      statusText: 'OK',
      httpVersion: '',
      headers: [],
      cookies: [],
      content: { size: contentSize ?? 0, mimeType: 'text/plain' },
      headersSize: -1,
      bodySize: bodySize ?? -1,
    },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    ...(initiatorUrl ? { _initiator: { type: 'script', url: initiatorUrl } } : {}),
  } as InspectorHarEntry;
}

function lifecycle(
  requestId: string,
  url: string,
  overrides: {
    startedAtMs?: number;
    completedAtMs?: number;
    initiatorUrl?: string;
    bodySize?: number;
    contentSize?: number;
    resourceType?: string;
    failed?: boolean;
    status?: number;
  } = {},
): RequestLifecycle {
  const startedAtMs = overrides.startedAtMs ?? 1000;
  const phase = overrides.failed ? 'failed' : overrides.completedAtMs != null ? 'completed' : 'pending';
  return {
    tabId: 1,
    requestId,
    url,
    method: 'GET',
    resourceType: overrides.resourceType ?? 'xmlhttprequest',
    phase,
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    ...(overrides.completedAtMs != null ? { completedAtMs: overrides.completedAtMs } : {}),
    har: [
      har(url, {
        ...(overrides.initiatorUrl ? { initiatorUrl: overrides.initiatorUrl } : {}),
        ...(overrides.bodySize != null ? { bodySize: overrides.bodySize } : {}),
        ...(overrides.contentSize != null ? { contentSize: overrides.contentSize } : {}),
        ...(overrides.status != null ? { status: overrides.status } : {}),
      }),
    ],
    harBodyByHop: [],
  };
}

function fire(ruleUid: string, requestId: string | undefined): InspectorFire {
  return {
    ruleUid,
    t: 1000,
    pattern: '*',
    authoritative: true,
    evidence: 'confirmed',
    ...(requestId ? { requestId } : {}),
  };
}

function snapshots(
  lifecycles: readonly RequestLifecycle[],
  pages: readonly Page[] = [],
  fires: readonly InspectorFire[] = [],
): { lifecycle: LifecycleClientSnapshot; page: PageClientSnapshot; fire: FireClientSnapshot } {
  return {
    lifecycle: {
      byRequestId: new Map(lifecycles.map((lc) => [lc.requestId, lc])),
      ordered: lifecycles,
    },
    page: { pages },
    fire: { fires },
  };
}

describe('usePanelData', () => {
  it('returns empty bundle for empty inputs', () => {
    const { result } = renderHook(() => usePanelData(snapshots([])));
    expect(result.current.rows).toEqual([]);
    expect(result.current.dangling).toEqual([]);
    expect(result.current.pages).toEqual([]);
    expect(result.current.navTiming).toBeNull();
    expect(result.current.baselineMs).toBeNull();
    expect(result.current.totalBytesTransferred).toBe(0);
    expect(result.current.totalResourceSize).toBe(0);
    expect(result.current.finishTimeMs).toBe(0);
    expect(result.current.modifiedCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
    expect(result.current.cachedCount).toBe(0);
    expect(result.current.pageCount).toBe(0);
  });

  it('builds rows ordered by startedAtMs and assigns sequential displayIds', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('b', 'https://openheaders.io/b', { startedAtMs: 200 }),
          lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 100 }),
        ]),
      ),
    );
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['a', 'b']);
    expect(result.current.rows.map((r) => r.displayId)).toEqual([1, 2]);
  });

  it('attaches fires by requestId; unattached fires land in dangling', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots(
          [lifecycle('a', 'https://openheaders.io/a')],
          [],
          [fire('rule-1', 'a'), fire('rule-2', 'no-such-request')],
        ),
      ),
    );
    expect(result.current.rows[0].fires).toHaveLength(1);
    expect(result.current.rows[0].fires[0].ruleUid).toBe('rule-1');
    expect(result.current.dangling).toHaveLength(1);
    expect(result.current.dangling[0].ruleUid).toBe('rule-2');
  });

  it('derives navTiming from the latest page', () => {
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 1000, url: 'https://openheaders.io/' },
      {
        id: 'page_2',
        startedAtMs: 5000,
        url: 'https://docs.openheaders.io/intro',
        dclMs: 120,
        loadMs: 480,
      },
    ];
    const { result } = renderHook(() => usePanelData(snapshots([], pages)));
    expect(result.current.navTiming).toEqual({
      pageOrigin: 'https://docs.openheaders.io',
      dclMs: 120,
      loadMs: 480,
    });
  });

  it('builds requestId / url lookup maps; url lookup keeps first arrival', () => {
    const lifecycles = [
      lifecycle('a', 'https://openheaders.io/x', { startedAtMs: 100 }),
      lifecycle('b', 'https://openheaders.io/x', { startedAtMs: 200 }),
    ];
    const { result } = renderHook(() => usePanelData(snapshots(lifecycles)));
    expect(result.current.lookupByRequestId.get('a')?.lifecycle.startedAtMs).toBe(100);
    expect(result.current.lookupByRequestId.get('b')?.lifecycle.startedAtMs).toBe(200);
    expect(result.current.lookupByUrl.get('https://openheaders.io/x')?.lifecycle.requestId).toBe('a');
  });

  it('initiator children resolver returns rows attributed to a parent URL', () => {
    const parent = 'https://openheaders.io/app.js';
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('a', 'https://openheaders.io/x', { initiatorUrl: parent, startedAtMs: 100 }),
          lifecycle('b', 'https://openheaders.io/y', { initiatorUrl: parent, startedAtMs: 200 }),
          lifecycle('c', 'https://openheaders.io/z', { startedAtMs: 300 }),
        ]),
      ),
    );
    const children = result.current.getInitiatorChildren(parent);
    expect(children.map((r) => r.lifecycle.requestId)).toEqual(['a', 'b']);
    expect(result.current.getInitiatorChildren('https://nothing/')).toEqual([]);
  });

  it('totals sum non-positive body and content sizes are ignored', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('a', 'https://openheaders.io/a', { bodySize: 1024, contentSize: 2048 }),
          lifecycle('b', 'https://openheaders.io/b', { bodySize: -1, contentSize: 0 }),
          lifecycle('c', 'https://openheaders.io/c', { bodySize: 512, contentSize: 256 }),
        ]),
      ),
    );
    expect(result.current.totalBytesTransferred).toBe(1024 + 512);
    expect(result.current.totalResourceSize).toBe(2048 + 256);
  });

  it('finishTimeMs spans the earliest request to the last byte when no top-level nav exists', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 0, completedAtMs: 300 }),
          lifecycle('b', 'https://openheaders.io/b', { startedAtMs: 100, completedAtMs: 900 }),
        ]),
      ),
    );
    // No main_frame row → baseline falls back to the earliest start (0);
    // last byte is b's end (900) → 900, not the longest duration (800).
    expect(result.current.finishTimeMs).toBe(900);
  });

  it('finishTimeMs anchors to the latest top-level navigation', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          // First navigation + a slow request from it — must NOT pin Finish.
          lifecycle('nav1', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 0,
            completedAtMs: 200,
          }),
          lifecycle('slow', 'https://openheaders.io/poll', { startedAtMs: 50, completedAtMs: 50_000 }),
          // Second (current) navigation and its own asset.
          lifecycle('nav2', 'https://openheaders.io/dashboard', {
            resourceType: 'main_frame',
            startedAtMs: 60_000,
            completedAtMs: 60_300,
          }),
          lifecycle('asset', 'https://openheaders.io/app.js', { startedAtMs: 60_100, completedAtMs: 61_200 }),
        ]),
      ),
    );
    // baseTime = 60_000 (latest main_frame); maxEnd = 61_200 (asset).
    expect(result.current.finishTimeMs).toBe(1200);
  });

  it('finishTimeMs ignores still-loading requests (no end yet)', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('nav', 'https://openheaders.io/', { resourceType: 'main_frame', startedAtMs: 0, completedAtMs: 400 }),
          // Open connection on the current page — pending, contributes nothing.
          lifecycle('ws', 'https://openheaders.io/socket', { startedAtMs: 100 }),
        ]),
      ),
    );
    expect(result.current.finishTimeMs).toBe(400);
  });

  it('counts modified, failed, and cached rows', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots(
          [
            lifecycle('ok', 'https://openheaders.io/ok', { completedAtMs: 1100 }),
            lifecycle('err', 'https://openheaders.io/err', { status: 500, completedAtMs: 1100 }),
            lifecycle('boom', 'https://openheaders.io/boom', { failed: true }),
            lifecycle('cache', 'https://openheaders.io/cache', { bodySize: -1, contentSize: 2048, completedAtMs: 1100 }),
          ],
          [],
          [fire('rule-1', 'ok')],
        ),
      ),
    );
    expect(result.current.modifiedCount).toBe(1);
    expect(result.current.failedCount).toBe(2);
    expect(result.current.cachedCount).toBe(1);
  });

  it('pageCount reflects the number of observed navigations', () => {
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 1000, url: 'https://openheaders.io/' },
      { id: 'page_2', startedAtMs: 5000, url: 'https://openheaders.io/next' },
    ];
    const { result } = renderHook(() => usePanelData(snapshots([], pages)));
    expect(result.current.pageCount).toBe(2);
  });

  it('baselineMs equals the first row\'s startedAtMs', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('b', 'https://openheaders.io/b', { startedAtMs: 500 }),
          lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 100 }),
        ]),
      ),
    );
    expect(result.current.baselineMs).toBe(100);
  });

  it('returns reference-stable result across re-renders with identical inputs', () => {
    const input = snapshots([lifecycle('a', 'https://openheaders.io/a')]);
    const { result, rerender } = renderHook(({ inp }) => usePanelData(inp), {
      initialProps: { inp: input },
    });
    const first = result.current;
    rerender({ inp: input });
    expect(result.current).toBe(first);
  });

  it('exposes a getConnectionReuse closure over the lifecycle list', () => {
    const a = lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 100 });
    const b = lifecycle('b', 'https://openheaders.io/b', { startedAtMs: 200 });
    // Stamp a shared HAR connection id on both — reuse should detect it.
    const connId = 'CONN-1';
    a.har[0]!.connection = connId;
    b.har[0]!.connection = connId;
    const { result } = renderHook(() => usePanelData(snapshots([a, b])));
    expect(result.current.getConnectionReuse(a).reused).toBe(false);
    expect(result.current.getConnectionReuse(b).reused).toBe(true);
    expect(result.current.getConnectionReuse(b).openedBy?.url).toBe('https://openheaders.io/a');
  });

  it('exposes a getRepeatStats closure over the lifecycle list', () => {
    const a = lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 100, completedAtMs: 200 });
    const b = lifecycle('b', 'https://openheaders.io/a', { startedAtMs: 300, completedAtMs: 500 });
    const { result } = renderHook(() => usePanelData(snapshots([a, b])));
    const stats = result.current.getRepeatStats(a);
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(2);
    expect(stats!.fastestMs).toBe(100);
    expect(stats!.slowestMs).toBe(200);
  });
});
