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

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import type { FireClientSnapshot } from '@openheaders/ui/panel/data/fire-client-store';
import type { LifecycleClientSnapshot } from '@openheaders/ui/panel/data/lifecycle-client-store';
import type { PageClientSnapshot } from '@openheaders/ui/panel/data/page-client-store';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { usePanelData } from '@openheaders/ui/panel/data/use-panel-data';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

  it('orders rows by startedAtMs but numbers displayId by discovery (log) order', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          // Log order is [b, a]; b started later. Request # follows the log
          // (b=1, a=2), the rows come back time-sorted [a, b] → numbers scramble.
          lifecycle('b', 'https://openheaders.io/b', { startedAtMs: 200 }),
          lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 100 }),
        ]),
      ),
    );
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['a', 'b']);
    expect(result.current.rows.map((r) => r.displayId)).toEqual([2, 1]);
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

  it('footer totals + Finish grow live from an in-flight row’s running bytes (the browser advances them)', () => {
    const nav = lifecycle('nav', 'https://openheaders.io/', {
      resourceType: 'main_frame',
      startedAtMs: 1000,
      completedAtMs: 1200,
      bodySize: 400,
      contentSize: 500,
    });
    // Streaming asset: no terminal, running first-class counts + last-activity.
    const streaming: RequestLifecycle = {
      ...lifecycle('big', 'https://openheaders.io/big.bin', { startedAtMs: 1100 }),
      bytesTransferredSoFar: 5000,
      bytesReceivedSoFar: 8000,
      lastActivityAtMs: 3000,
    };
    const { result } = renderHook(() => usePanelData(snapshots([nav, streaming])));
    // Totals include the streaming row's LIVE running bytes (not its frozen
    // HAR floor): 400 + 5000 transferred, 500 + 8000 resources.
    expect(result.current.totalBytesTransferred).toBe(5400);
    expect(result.current.totalResourceSize).toBe(8500);
    // Finish spans the doc's network start (1000) to the streaming row's live
    // last byte (3000) → 2000; without the live span it would read 200 (doc only).
    expect(result.current.finishTimeMs).toBe(2000);
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

  it('aggregate timings span the whole preserve-log timeline across same-URL navigations', () => {
    // Two navigations to the same URL (the Preserve-log reload case): the
    // per-page footer anchors to the latest nav, the aggregate set spans from
    // the first nav like the browser summary bar. Each document's raw start
    // sits marginally *before* its page start (the queue leg), so a
    // request→page join would mis-bin the later document onto the first page;
    // the aggregate anchors off the page starts directly to avoid that.
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 100, url: 'https://openheaders.io/', dclMs: 380, loadMs: 383 },
      { id: 'page_2', startedAtMs: 4100, url: 'https://openheaders.io/', dclMs: 143, loadMs: 143 },
    ];
    const nav1: RequestLifecycle = {
      ...lifecycle('nav1', 'https://openheaders.io/', {
        resourceType: 'main_frame',
        startedAtMs: 95,
        completedAtMs: 400,
      }),
      hopNetworkStartMs: 100,
    };
    const nav2: RequestLifecycle = {
      ...lifecycle('nav2', 'https://openheaders.io/', {
        resourceType: 'main_frame',
        startedAtMs: 4095,
        completedAtMs: 4300,
      }),
      hopNetworkStartMs: 4100,
    };
    const { result } = renderHook(() => usePanelData(snapshots([nav1, nav2], pages)));
    // Per-page (latest nav): anchored to nav2 network start (4100).
    expect(result.current.finishTimeMs).toBe(200);
    expect(result.current.footerDclMs).toBe(143);
    expect(result.current.footerLoadMs).toBe(143);
    // Aggregate: anchored to nav1's page start (100), spanning to nav2's last byte.
    expect(result.current.aggregateFinishMs).toBe(4200);
    expect(result.current.aggregateDclMs).toBe(4143);
    expect(result.current.aggregateLoadMs).toBe(4143);
  });

  it('aggregate timings coincide with the per-page footer for a single navigation', () => {
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 1000, url: 'https://openheaders.io/', dclMs: 120, loadMs: 480 },
    ];
    const { result } = renderHook(() =>
      usePanelData(
        snapshots(
          [
            lifecycle('doc', 'https://openheaders.io/', {
              resourceType: 'main_frame',
              startedAtMs: 1000,
              completedAtMs: 1400,
            }),
          ],
          pages,
        ),
      ),
    );
    expect(result.current.aggregateFinishMs).toBe(result.current.finishTimeMs);
    expect(result.current.aggregateDclMs).toBe(result.current.footerDclMs);
    expect(result.current.aggregateLoadMs).toBe(result.current.footerLoadMs);
  });

  it('finishTimeMs ignores still-loading requests (no end yet)', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots([
          lifecycle('nav', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 0,
            completedAtMs: 400,
          }),
          // Open connection on the current page — pending, contributes nothing.
          lifecycle('ws', 'https://openheaders.io/socket', { startedAtMs: 100 }),
        ]),
      ),
    );
    expect(result.current.finishTimeMs).toBe(400);
  });

  it('footer milestones equal the root-anchored navTiming for a non-redirected navigation', () => {
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 1000, url: 'https://openheaders.io/', dclMs: 120, loadMs: 480 },
    ];
    const { result } = renderHook(() =>
      usePanelData(
        snapshots(
          [
            lifecycle('doc', 'https://openheaders.io/', {
              resourceType: 'main_frame',
              startedAtMs: 1000,
              completedAtMs: 1400,
            }),
          ],
          pages,
        ),
      ),
    );
    // No redirect → leg is 0; the footer coincides with the HAR pageTimings.
    expect(result.current.footerDclMs).toBe(120);
    expect(result.current.footerLoadMs).toBe(480);
    expect(result.current.navTiming?.dclMs).toBe(120);
  });

  it('re-anchors the footer to the final hop on a redirected navigation', () => {
    const rootHop = {
      ...har('https://openheaders.io/'),
      startedDateTime: new Date(38_740).toISOString(),
      timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0, _blocked_queueing: 4 },
    } as InspectorHarEntry;
    const finalHop = {
      ...har('https://openheaders.io/ro'),
      startedDateTime: new Date(38_853).toISOString(),
      timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    } as InspectorHarEntry;
    const redirected: RequestLifecycle = {
      tabId: 1,
      requestId: 'doc',
      url: 'https://openheaders.io/ro',
      method: 'GET',
      // CDP path reports the main document as 'document', not 'main_frame' —
      // the footer re-anchor must recognize both (regression: leg stayed 0).
      resourceType: 'document',
      phase: 'completed',
      redirectHopCount: 1,
      redirectHops: [
        {
          sourceUrl: 'https://openheaders.io/',
          redirectUrl: 'https://openheaders.io/ro',
          statusCode: 302,
          timestampMs: 38_740,
        },
      ],
      startedAtMs: 38_740,
      hopStartedAtMs: 38_853,
      completedAtMs: 40_500,
      har: [rootHop, finalHop],
      harBodyByHop: [],
    };
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 38_744, url: 'https://openheaders.io/', dclMs: 556.7, loadMs: 1638 },
    ];
    const { result } = renderHook(() => usePanelData(snapshots([redirected], pages)));
    // Leg = finalDoc.hopStartedAtMs(38_853) − page.startedAtMs(38_744) = 109.
    expect(result.current.footerDclMs).toBeCloseTo(447.7, 5);
    expect(result.current.footerLoadMs).toBeCloseTo(1529, 5);
    // navTiming keeps the root-anchored HAR values; only the footer re-anchors.
    expect(result.current.navTiming?.dclMs).toBe(556.7);
    // Finish = maxEnd 40_500 − finalDoc.hopStartedAtMs 38_853 = 1647.
    expect(result.current.finishTimeMs).toBe(1647);
  });

  it('re-anchors an un-folded redirect (CDP mid-attach: redirectHopCount 0, final URL ≠ page root)', () => {
    // CDP attached mid-navigation and missed the 3xx linkage, so the final
    // document arrives as a standalone request (`redirectHopCount` 0, no
    // folded hops). The page stream still recorded the navigation root, so the
    // leg derives from `Page.startedAtMs` and the document's `hopStartedAtMs`,
    // not the absent `har[]` redirect hops — the live `crypto.com → /ro` bug.
    const finalDoc = lifecycle('doc', 'https://openheaders.io/ro', {
      resourceType: 'document',
      startedAtMs: 38_853,
      completedAtMs: 40_500,
    });
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 38_744, url: 'https://openheaders.io/', dclMs: 556.7, loadMs: 1638 },
    ];
    const { result } = renderHook(() => usePanelData(snapshots([finalDoc], pages)));
    // page.url (root) ≠ doc.url (/ro) → redirected, even with no folded hops.
    // Leg = hopStartedAtMs(38_853) − page.startedAtMs(38_744) = 109.
    expect(result.current.footerDclMs).toBeCloseTo(447.7, 5);
    expect(result.current.footerLoadMs).toBeCloseTo(1529, 5);
    expect(result.current.finishTimeMs).toBe(1647);
  });

  it('anchors the footer to the final hop network start, not its issue instant', () => {
    // The final hop queued for 3 ms before going on the wire: issue at 38_850,
    // network start at 38_853. The footer's zero is the network start (the
    // browser's baseTime), so the leg, Finish, and re-anchored milestones all
    // measure from 38_853 — anchoring to the issue instant would read ~3 ms
    // large on Load / Finish (the live +1 ms footer gap).
    const redirected: RequestLifecycle = {
      tabId: 1,
      requestId: 'doc',
      url: 'https://openheaders.io/ro',
      method: 'GET',
      resourceType: 'document',
      phase: 'completed',
      redirectHopCount: 1,
      redirectHops: [
        {
          sourceUrl: 'https://openheaders.io/',
          redirectUrl: 'https://openheaders.io/ro',
          statusCode: 302,
          timestampMs: 38_740,
        },
      ],
      startedAtMs: 38_740,
      hopStartedAtMs: 38_850,
      hopNetworkStartMs: 38_853,
      completedAtMs: 40_500,
      har: [har('https://openheaders.io/'), har('https://openheaders.io/ro')],
      harBodyByHop: [],
    };
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 38_744, url: 'https://openheaders.io/', dclMs: 556.7, loadMs: 1638 },
    ];
    const { result } = renderHook(() => usePanelData(snapshots([redirected], pages)));
    // Anchor = network start (38_853), not the issue instant (38_850).
    expect(result.current.footerAnchorMs).toBe(38_853);
    // Leg = networkStart(38_853) − page.startedAtMs(38_744) = 109 (not 106).
    expect(result.current.legMs).toBe(109);
    expect(result.current.footerDclMs).toBeCloseTo(447.7, 5);
    expect(result.current.footerLoadMs).toBeCloseTo(1529, 5);
    // Finish = maxEnd 40_500 − networkStart 38_853 = 1647 (not 1650).
    expect(result.current.finishTimeMs).toBe(1647);
  });

  it('falls the footer anchor back to the hop issue instant when no network start is known', () => {
    // Heuristic / pre-timing state: hopNetworkStartMs unset → anchor degrades
    // to hopStartedAtMs, the value the footer used before network-start anchoring.
    const finalDoc = lifecycle('doc', 'https://openheaders.io/ro', {
      resourceType: 'document',
      startedAtMs: 38_853,
      completedAtMs: 40_500,
    });
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 38_744, url: 'https://openheaders.io/', dclMs: 556.7, loadMs: 1638 },
    ];
    const { result } = renderHook(() => usePanelData(snapshots([finalDoc], pages)));
    expect(result.current.footerAnchorMs).toBe(38_853);
    expect(result.current.legMs).toBe(109);
    expect(result.current.finishTimeMs).toBe(1647);
  });

  it('counts modified, failed, and cached rows', () => {
    const { result } = renderHook(() =>
      usePanelData(
        snapshots(
          [
            lifecycle('ok', 'https://openheaders.io/ok', { completedAtMs: 1100 }),
            lifecycle('err', 'https://openheaders.io/err', { status: 500, completedAtMs: 1100 }),
            lifecycle('boom', 'https://openheaders.io/boom', { failed: true }),
            lifecycle('cache', 'https://openheaders.io/cache', {
              bodySize: -1,
              contentSize: 2048,
              completedAtMs: 1100,
            }),
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

  it('navClearFloorMs scopes the view to requests at or after the floor', () => {
    const { result } = renderHook(() =>
      usePanelData({
        ...snapshots([
          lifecycle('nav1', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 0,
            completedAtMs: 200,
          }),
          lifecycle('old', 'https://openheaders.io/old.js', { startedAtMs: 50, completedAtMs: 150 }),
          lifecycle('nav2', 'https://openheaders.io/next', {
            resourceType: 'main_frame',
            startedAtMs: 1000,
            completedAtMs: 1200,
          }),
          lifecycle('new', 'https://openheaders.io/new.js', { startedAtMs: 1050, completedAtMs: 1100 }),
        ]),
        navClearFloorMs: 1000,
      }),
    );
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['nav2', 'new']);
  });

  it('recordingWindows drop requests that started while recording was stopped', () => {
    const { result } = renderHook(() =>
      usePanelData({
        ...snapshots([
          lifecycle('a', 'https://openheaders.io/a', { startedAtMs: 50 }),
          lifecycle('paused', 'https://openheaders.io/p', { startedAtMs: 150 }),
          lifecycle('b', 'https://openheaders.io/b', { startedAtMs: 250 }),
        ]),
        recordingWindows: [
          { startMs: 0, endMs: 100 },
          { startMs: 200, endMs: null },
        ],
      }),
    );
    // 'paused' started in the [100, 200) gap → dropped; the others survive.
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['a', 'b']);
  });

  it('recording stopped before a refresh freezes the footer on the recorded page', () => {
    // Page 1 fully recorded; user stops recording at t=2000; then refreshes at
    // t=3000. Chrome (recording off) records nothing new — the summary bar keeps
    // page 1's DCL/Load. The new navigation must be scoped out of the page list
    // exactly like its requests, so the footer does NOT recompute onto page 2.
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 1000, url: 'https://openheaders.io/', dclMs: 120, loadMs: 480 },
      { id: 'page_2', startedAtMs: 3000, url: 'https://openheaders.io/', dclMs: 90, loadMs: 200 },
    ];
    const { result } = renderHook(() =>
      usePanelData({
        ...snapshots(
          [
            lifecycle('nav1', 'https://openheaders.io/', {
              resourceType: 'main_frame',
              startedAtMs: 1000,
              completedAtMs: 1400,
            }),
            // The refresh's document started while recording was stopped.
            lifecycle('nav2', 'https://openheaders.io/', {
              resourceType: 'main_frame',
              startedAtMs: 3000,
              completedAtMs: 3400,
            }),
          ],
          pages,
        ),
        recordingWindows: [{ startMs: 0, endMs: 2000 }],
      }),
    );
    // Rows: only the recorded navigation (nav2 started in the stopped gap).
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['nav1']);
    // Page list + count scoped to the recorded navigation.
    expect(result.current.pages.map((p) => p.id)).toEqual(['page_1']);
    expect(result.current.pageCount).toBe(1);
    // Footer frozen on page 1 — the bug was these recomputing to 90 / 200.
    expect(result.current.footerDclMs).toBe(120);
    expect(result.current.footerLoadMs).toBe(480);
    expect(result.current.navTiming?.dclMs).toBe(120);
  });

  it('navClearFloorMs scopes the page list consistently with the rows', () => {
    // Preserve-log OFF across a navigation: the floor advances past page 1, so
    // its requests AND its page entry clear together — the page block must not
    // list a navigation whose rows are gone.
    const pages: Page[] = [
      { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/' },
      { id: 'page_2', startedAtMs: 1000, url: 'https://openheaders.io/next' },
    ];
    const { result } = renderHook(() =>
      usePanelData({
        ...snapshots(
          [
            lifecycle('nav1', 'https://openheaders.io/', {
              resourceType: 'main_frame',
              startedAtMs: 0,
              completedAtMs: 200,
            }),
            lifecycle('nav2', 'https://openheaders.io/next', {
              resourceType: 'main_frame',
              startedAtMs: 1000,
              completedAtMs: 1200,
            }),
          ],
          pages,
        ),
        navClearFloorMs: 1000,
      }),
    );
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['nav2']);
    expect(result.current.pages.map((p) => p.id)).toEqual(['page_2']);
    expect(result.current.pageCount).toBe(1);
    expect(result.current.navTiming?.pageOrigin).toBe('https://openheaders.io');
  });

  it('navClearFloorMs -1 keeps every request across repeated navigations', () => {
    const { result } = renderHook(() =>
      usePanelData({
        ...snapshots([
          lifecycle('nav1', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 0,
            completedAtMs: 200,
          }),
          lifecycle('nav2', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 1000,
            completedAtMs: 1200,
          }),
          lifecycle('nav3', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 2000,
            completedAtMs: 2200,
          }),
        ]),
        navClearFloorMs: -1,
      }),
    );
    expect(result.current.rows.map((r) => r.lifecycle.requestId)).toEqual(['nav1', 'nav2', 'nav3']);
  });

  it('merges Resource Timing memory-cache hits as synthetic rows', () => {
    const { result } = renderHook(() =>
      usePanelData({
        ...snapshots([
          lifecycle('nav', 'https://openheaders.io/', {
            resourceType: 'main_frame',
            startedAtMs: 1000,
            completedAtMs: 1100,
          }),
          // app.js was fetched over the wire — has a real row.
          lifecycle('js', 'https://openheaders.io/app.js', { startedAtMs: 1010, completedAtMs: 1050 }),
        ]),
        resourceTiming: {
          groups: [
            {
              timeOriginMs: 1000,
              entries: [
                // Matches the real app.js row → not duplicated.
                {
                  name: 'https://openheaders.io/app.js',
                  initiatorType: 'script',
                  nextHopProtocol: 'h2',
                  startTime: 10,
                  duration: 40,
                  transferSize: 5000,
                  encodedBodySize: 4000,
                  decodedBodySize: 8000,
                  deliveryType: '',
                },
                // logo.svg has no real row → served from memory cache.
                {
                  name: 'https://openheaders.io/logo.svg',
                  initiatorType: 'img',
                  nextHopProtocol: '',
                  startTime: 20,
                  duration: 0,
                  transferSize: 0,
                  encodedBodySize: 0,
                  decodedBodySize: 3000,
                  deliveryType: 'cache',
                },
              ],
            },
          ],
        },
      }),
    );
    const urls = result.current.rows.map((r) => r.lifecycle.url);
    expect(urls).toContain('https://openheaders.io/logo.svg');
    // app.js appears once (real row), not duplicated by its RT entry.
    expect(urls.filter((u) => u === 'https://openheaders.io/app.js')).toHaveLength(1);
    // The synthetic hit counts toward cached + resource totals.
    expect(result.current.cachedCount).toBe(1);
    expect(result.current.totalResourceSize).toBe(3000);
  });

  it("preserveLog keeps a prior navigation's memory-cache rows after navigating away", () => {
    // github.com (with a memory-cache hit) then a navigation to example.com.
    const rt = {
      groups: [
        {
          timeOriginMs: 1000,
          entries: [
            {
              name: 'https://github.com/bundle.js',
              initiatorType: 'script',
              nextHopProtocol: 'h2',
              startTime: 10,
              duration: 0,
              transferSize: 0,
              encodedBodySize: 0,
              decodedBodySize: 4000,
              deliveryType: 'cache',
            },
          ],
        },
        // example.com document — not a resource-timing entry; its group is empty.
        { timeOriginMs: 5000, entries: [] },
      ],
    };
    const lifecycles = [
      lifecycle('g', 'https://github.com/', { resourceType: 'main_frame', startedAtMs: 999, completedAtMs: 1100 }),
      lifecycle('e', 'https://example.com/', { resourceType: 'main_frame', startedAtMs: 4999, completedAtMs: 5100 }),
    ];
    const { result, rerender } = renderHook(
      ({ floor }) => usePanelData({ ...snapshots(lifecycles), navClearFloorMs: floor, resourceTiming: rt }),
      { initialProps: { floor: -1 } },
    );
    // No floor (Preserve-log ON): the github.com cache row survives the nav.
    expect(result.current.rows.map((r) => r.lifecycle.url)).toContain('https://github.com/bundle.js');

    // Floor at the example.com navigation: only the current nav's rows show.
    rerender({ floor: 4999 });
    expect(result.current.rows.map((r) => r.lifecycle.url)).not.toContain('https://github.com/bundle.js');
  });

  it('manual Clear floor drops a cleared request’s still-cached RT entry instead of resurfacing it', () => {
    // A request fetched over the wire (RT entry at wall-clock 1000+1000=2000),
    // deduped against its real row pre-Clear. After Clear at t=3000 the real
    // rows are gone (engine-floored) — its RT entry must NOT become a
    // `(memory cache)` row.
    const rt = {
      groups: [
        {
          timeOriginMs: 1000,
          entries: [
            {
              name: 'https://openheaders.io/api/ticker',
              initiatorType: 'fetch',
              nextHopProtocol: 'h2',
              startTime: 1000,
              duration: 50,
              transferSize: 0,
              encodedBodySize: 0,
              decodedBodySize: 2000,
              deliveryType: 'cache',
            },
          ],
        },
      ],
    };

    // Bug repro: real rows cleared, no Clear floor → the cached entry resurfaces.
    const bug = renderHook(() => usePanelData({ ...snapshots([]), resourceTiming: rt }));
    expect(bug.result.current.rows.map((r) => r.lifecycle.url)).toContain('https://openheaders.io/api/ticker');

    // Fix: a manual Clear floor past the entry drops it — empty view.
    const fixed = renderHook(() => usePanelData({ ...snapshots([]), resourceTiming: rt, clearFloorMs: 3000 }));
    expect(fixed.result.current.rows).toHaveLength(0);
  });

  it('manual Clear floor keeps memory-cache hits that occur after the Clear', () => {
    const rt = {
      groups: [
        {
          timeOriginMs: 1000,
          entries: [
            // wall-clock 2000 — before the Clear → dropped.
            {
              name: 'https://openheaders.io/pre.svg',
              initiatorType: 'img',
              nextHopProtocol: '',
              startTime: 1000,
              duration: 0,
              transferSize: 0,
              encodedBodySize: 0,
              decodedBodySize: 100,
              deliveryType: 'cache',
            },
            // wall-clock 6000 — after the Clear → kept.
            {
              name: 'https://openheaders.io/post.svg',
              initiatorType: 'img',
              nextHopProtocol: '',
              startTime: 5000,
              duration: 0,
              transferSize: 0,
              encodedBodySize: 0,
              decodedBodySize: 200,
              deliveryType: 'cache',
            },
          ],
        },
      ],
    };
    const { result } = renderHook(() => usePanelData({ ...snapshots([]), resourceTiming: rt, clearFloorMs: 3000 }));
    expect(result.current.rows.map((r) => r.lifecycle.url)).toEqual(['https://openheaders.io/post.svg']);
  });

  it("baselineMs equals the first row's startedAtMs", () => {
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
