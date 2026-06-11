import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import {
  classifyRequestState,
  hasObservedResponseData,
  isFailedNetworkRequest,
  isPreservedUnknown,
  isRequestFailed,
  statusCellText,
  supersessionAnchorFromPages,
} from '@openheaders/ui/panel/data/request-state';
import { describe, expect, it } from 'vitest';

function makeLifecycle(
  opts: Omit<Partial<RequestLifecycle>, 'har'> & { har?: Partial<InspectorHarEntry> } = {},
): RequestLifecycle {
  const url = opts.url ?? 'https://api.openheaders.io/x';
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-17T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    ...(opts.har ?? {}),
  } as InspectorHarEntry;
  const { har: _ignored, ...rest } = opts;
  return {
    tabId: 1,
    requestId: 'req-1',
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: 200,
    statusText: 'OK',
    har: [har],
    harBodyByHop: [],
    ...rest,
  };
}

describe('classifyRequestState', () => {
  it('pending when no response is observed yet', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      har: { response: undefined },
    });
    expect(classifyRequestState(lc).kind).toBe('pending');
  });

  it('blocked when status code is 0 and text says blocked', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'net::ERR_BLOCKED_BY_CLIENT' });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('blocked');
    if (s.kind === 'blocked') expect(s.reason).toContain('BLOCKED');
  });

  it('failed when status code is 0 and the text is a non-blocked net error', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'net::ERR_NAME_NOT_RESOLVED' });
    expect(classifyRequestState(lc).kind).toBe('failed');
  });

  it('failed for TLS / cert errors with status code 0', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'net::ERR_CERT_AUTHORITY_INVALID' });
    expect(classifyRequestState(lc).kind).toBe('failed');
  });

  it('cached (disk) when har._fromCache is "disk"', () => {
    const lc = makeLifecycle({
      har: {
        _fromCache: 'disk',
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('disk');
  });

  it('cached (memory) when har._servedFromCache is true without _fromCache', () => {
    const lc = makeLifecycle({
      har: {
        _servedFromCache: true,
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('memory');
  });

  it('cached (service-worker) when har._fetchedViaServiceWorker is true — even over other cache flags', () => {
    const lc = makeLifecycle({
      har: {
        _fromCache: 'disk',
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 0, mimeType: '' },
          _fetchedViaServiceWorker: true,
        },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('service-worker');
  });

  it('cached (memory) when lifecycle.fromCache is true without HAR cache flags', () => {
    const lc = makeLifecycle({ fromCache: true });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('memory');
  });

  it('304 revalidation is success/304, not memory cache, even with webRequest fromCache + 200', () => {
    // webRequest surfaces the cached 200 + fromCache; the devtools HAR
    // carries the authoritative 304 and the 64-byte revalidation transfer.
    const lc = makeLifecycle({
      statusCode: 200,
      fromCache: true,
      har: {
        response: {
          status: 304,
          statusText: '',
          headers: [],
          bodySize: 0,
          _transferSize: 64,
          content: { size: 528, mimeType: 'text/html' },
        },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('success');
    if (s.kind === 'success') expect(s.status).toBe(304);
  });

  it('bare webRequest fromCache with transferred bytes is NOT memory cache', () => {
    const lc = makeLifecycle({
      statusCode: 200,
      fromCache: true,
      har: {
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          _transferSize: 5000,
          content: { size: 8000, mimeType: 'text/css' },
        },
      },
    });
    expect(classifyRequestState(lc).kind).toBe('success');
  });

  it('redirect when status is 3xx with a redirectURL', () => {
    const lc = makeLifecycle({
      statusCode: 302,
      statusText: 'Found',
      har: {
        response: {
          status: 302,
          statusText: 'Found',
          redirectURL: 'https://elsewhere.example/',
          headers: [],
          content: { size: 0, mimeType: '' },
        },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('redirect');
    if (s.kind === 'redirect') {
      expect(s.status).toBe(302);
      expect(s.location).toBe('https://elsewhere.example/');
    }
  });

  it('success for a plain 200', () => {
    const s = classifyRequestState(makeLifecycle());
    expect(s.kind).toBe('success');
    if (s.kind === 'success') expect(s.status).toBe(200);
  });

  it('blocked precedence: blocked beats cached', () => {
    const lc = makeLifecycle({
      statusCode: 0,
      statusText: 'net::ERR_BLOCKED_BY_CLIENT',
      har: { _fromCache: 'disk', response: undefined },
    });
    expect(classifyRequestState(lc).kind).toBe('blocked');
  });

  // Red-row trigger: a wire failure with no HTTP status (blocked / failed),
  // or any 4xx/5xx — driven off the lifecycle's `error`/`phase`/HAR status,
  // not the classified `kind`.
  const blockedLc = makeLifecycle({
    phase: 'failed',
    statusCode: undefined,
    statusText: undefined,
    error: { code: 'net::ERR_BLOCKED_BY_CLIENT', reason: 'net::ERR_BLOCKED_BY_CLIENT' },
    har: { response: undefined },
  });
  const failedLc = makeLifecycle({
    phase: 'failed',
    statusCode: undefined,
    statusText: undefined,
    error: { code: 'net::ERR_NAME_NOT_RESOLVED', reason: 'net::ERR_NAME_NOT_RESOLVED' },
    har: { response: undefined },
  });
  const httpErrorLc = makeLifecycle({
    statusCode: 500,
    statusText: 'Internal Server Error',
    har: {
      response: { status: 500, statusText: 'Internal Server Error', headers: [], content: { size: 0, mimeType: '' } },
    },
  });
  const pendingLc = makeLifecycle({
    phase: 'pending',
    statusCode: undefined,
    statusText: undefined,
    har: { response: undefined },
  });
  const cachedLc = makeLifecycle({
    har: {
      _fromCache: 'disk',
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
    },
  });
  const redirectLc = makeLifecycle({
    statusCode: 302,
    statusText: 'Found',
    har: {
      response: {
        status: 302,
        statusText: 'Found',
        redirectURL: 'https://elsewhere.example/',
        headers: [],
        content: { size: 0, mimeType: '' },
      },
    },
  });

  it('isFailedNetworkRequest true for blocked + failed + httpError, false otherwise', () => {
    expect(isFailedNetworkRequest(blockedLc)).toBe(true);
    expect(isFailedNetworkRequest(failedLc)).toBe(true);
    expect(isFailedNetworkRequest(httpErrorLc)).toBe(true);
    expect(isFailedNetworkRequest(pendingLc)).toBe(false);
    expect(isFailedNetworkRequest(makeLifecycle())).toBe(false);
    expect(isFailedNetworkRequest(cachedLc)).toBe(false);
  });

  it('statusCellText surfaces the right label for each state', () => {
    expect(statusCellText(pendingLc)).toBe('(pending)');
    expect(statusCellText(blockedLc)).toBe('(blocked:other)');
    expect(statusCellText(failedLc)).toBe('(failed) net::ERR_NAME_NOT_RESOLVED');
    expect(statusCellText(httpErrorLc)).toBe('500');
    expect(statusCellText(makeLifecycle())).toBe('200');
    expect(statusCellText(redirectLc)).toBe('302');
    expect(statusCellText(cachedLc)).toBe('200');
  });
});

describe('isRequestFailed — failure independent of status code', () => {
  it('true for a failed phase, an error, or a negative code', () => {
    expect(isRequestFailed(makeLifecycle({ phase: 'failed' }))).toBe(true);
    expect(
      isRequestFailed(makeLifecycle({ statusCode: undefined, error: { code: 'net::ERR_ABORTED', reason: 'aborted' } })),
    ).toBe(true);
    expect(isRequestFailed(makeLifecycle({ statusCode: -1 }))).toBe(true);
  });

  it('false for a plain success and for a pending request', () => {
    expect(isRequestFailed(makeLifecycle())).toBe(false);
    expect(isRequestFailed(makeLifecycle({ phase: 'pending', statusCode: undefined }))).toBe(false);
  });

  it('a 200 that was then aborted stays failed yet still reads 200 in the cell (browser parity)', () => {
    // The wire carried a 200, so the Status cell shows the code; the abort is
    // surfaced only where the body would be (the no-response Response/Preview),
    // matching the browser's `!statusCode && canceled` cell rule.
    const lc = makeLifecycle({ phase: 'failed', error: { code: 'net::ERR_ABORTED', reason: 'aborted' } });
    expect(isRequestFailed(lc)).toBe(true);
    expect(statusCellText(lc)).toBe('200');
  });
});

describe('document teardown failure — bare ERR_FAILED after the response began', () => {
  // The stop()/navigation teardown of a streaming document reports the
  // generic net::ERR_FAILED on webRequest, but a frame navigation is never
  // CORS/ORB-rejected — and the browser's own panel (which never sees a
  // terminal for this shape) keeps showing the response status.
  const teardown = () =>
    makeLifecycle({
      phase: 'failed',
      resourceType: 'main_frame',
      error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
    });

  it('classifies by the wire status, not as a renderer rejection', () => {
    const s = classifyRequestState(teardown());
    expect(s.kind).toBe('success');
    if (s.kind === 'success') expect(s.status).toBe(200);
  });

  it('the Status cell shows the code, never (blocked:other)', () => {
    expect(statusCellText(teardown())).toBe('200');
  });

  it('a sub_frame teardown reads the same', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      resourceType: 'sub_frame',
      error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
    });
    expect(statusCellText(lc)).toBe('200');
  });

  it('a subresource ERR_FAILED with a wire status stays a renderer rejection (ORB shape)', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      resourceType: 'script',
      error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
    });
    expect(classifyRequestState(lc).kind).toBe('failed');
    expect(statusCellText(lc)).toBe('(blocked:other)');
  });

  it('a document ERR_FAILED with no wire status is not a teardown', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      resourceType: 'main_frame',
      statusCode: undefined,
      statusText: undefined,
      har: { response: undefined },
      error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
    });
    expect(statusCellText(lc)).not.toBe('200');
  });
});

describe('statusCellText with a correlator-supplied block reason (CDP)', () => {
  it('prefers error.blockedReason over the net-stack-code vocabulary', () => {
    // The net-stack code collapses CORP to the generic `other`; the CDP
    // path names it precisely via blockedReason, which must win.
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      har: { response: undefined },
      error: { code: 'net::ERR_BLOCKED_BY_RESPONSE', reason: 'corp-not-same-origin', blockedReason: 'corp' },
    });
    expect(statusCellText(lc)).toBe('(blocked:corp)');
  });

  it('falls back to the net-stack vocabulary when blockedReason is absent (heuristic path)', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      har: { response: undefined },
      error: { code: 'net::ERR_BLOCKED_BY_RESPONSE', reason: 'net::ERR_BLOCKED_BY_RESPONSE' },
    });
    expect(statusCellText(lc)).toBe('(blocked:other)');
  });
});

describe('isPreservedUnknown — start-time floor (no loader id)', () => {
  // A newer top-level navigation committed at this wall-clock; rows that
  // started before it and never finished are preserved-unknown. With no loader
  // id on either side (the heuristic page source), the predicate falls back to
  // this start-time floor.
  const floor = { latestNavStartedAtMs: 1_000 };

  it('non-terminal, no-status, started before a newer nav → preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, floor)).toBe(true);
    // Its logical state is still pending — only the cells override the label.
    expect(classifyRequestState(lc).kind).toBe('pending');
  });

  it('non-terminal current-page row (started at/after the nav) → not preserved', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, floor)).toBe(false);
  });

  it('non-terminal with a status (streaming), superseded → still preserved (Time reads unknown)', () => {
    // A row that already received a status but never finished: the Status cell
    // keeps the status, but the Time cell reads "(unknown)", so the predicate
    // (Time-cell truth) is true.
    const lc = makeLifecycle({
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 500,
      completedAtMs: undefined,
    });
    expect(isPreservedUnknown(lc, floor)).toBe(true);
  });

  it('terminal (completed) prior-page row → never preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'completed',
      startedAtMs: 500,
      completedAtMs: 800,
    });
    expect(isPreservedUnknown(lc, floor)).toBe(false);
  });

  it('no navigation observed (floor <= 0) → never preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: -1 })).toBe(false);
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 0 })).toBe(false);
  });
});

describe('isPreservedUnknown — loader-identity binding (CDP)', () => {
  // The latest page committed under loader L2; L1 is the superseded prior page.
  // Both are observed pages, so both loader ids are members of the binding
  // gate. The floor (nav start) is deliberately EARLY so a transition-window
  // row that started AFTER it would pass the time floor — proving loader
  // identity, not time, is what decides supersession here.
  const anchor = { latestNavStartedAtMs: 1_000, latestPageLoaderId: 'L2', pageLoaderIds: ['L1', 'L2'] };

  it('non-terminal row bound to the superseded prior page (L1) → preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      loaderId: 'L1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('transition-window row (old loader L1, started AFTER the new nav) → preserved-unknown', () => {
    // The bug Slice C closes: on a slow nav the old page keeps issuing requests
    // in [nav-start, commit]; they start after the floor but carry the old
    // loader id. Time-floor would read them Pending; loader identity supersedes.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      loaderId: 'L1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('non-terminal current-page row (latest loader L2) → not preserved', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      loaderId: 'L2',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('unfinished old document (old loader, no terminal) → preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      resourceType: 'document',
      startedAtMs: 500,
      completedAtMs: undefined,
      loaderId: 'L1',
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('terminal prior-page row (old loader, completed) → never preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'completed',
      startedAtMs: 500,
      completedAtMs: 800,
      loaderId: 'L1',
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('row carries a loader id but the latest page has none → falls back to the time floor', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      loaderId: 'L1',
      har: { response: undefined },
    });
    // No page loader id → time floor: started after the floor → not preserved.
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000 })).toBe(false);
  });

  it('latest page has a loader id but the row has none (worker request) → time-floor fallback', () => {
    // A worker request carries no loader id; identity binding must not mis-bind
    // it to the page. Started before the floor → preserved via the fallback.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('in-flight iframe subresource (loader id matches no page) → NOT preserved while its page is live', () => {
    // The iframe-loaderId class: a CDP iframe subresource carries the IFRAME
    // document's loader id, which differs from every page's. The raw `!==`
    // law read it superseded the moment it started; the membership gate
    // leaves it unbound, and the time floor (started after the latest nav)
    // says current — the browser shows Pending, so do we.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      loaderId: 'IFRAME-LOADER',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('old-page iframe subresource (non-member, started before the latest nav) → preserved via the floor', () => {
    // After a real navigation the old page's iframe rows die with it; the
    // floor delivers the boundary verdict the browser computes by loader
    // identity at commit time.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      loaderId: 'IFRAME-LOADER',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('anchor without a membership list never binds by loader identity (strict gate)', () => {
    // A hand-built anchor carrying only the latest loader id has no membership
    // info; the loader arm must stay closed (never-mis-bind) and the floor
    // decides — started after the floor → not preserved.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      loaderId: 'L1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000, latestPageLoaderId: 'L2' })).toBe(false);
  });
});

describe('isPreservedUnknown — document-identity binding (heuristic)', () => {
  // The latest page committed as document D2; D1 is the superseded prior page.
  // Same shape as the loader block: the floor is EARLY so a transition-window
  // row that started AFTER it proves document identity, not time, decides.
  const anchor = { latestNavStartedAtMs: 1_000, latestPageDocumentId: 'D2' };

  it('transition-window row (old document D1, started AFTER the new nav) → preserved-unknown', () => {
    // The class Slice U closes on the heuristic leg: a slow nav's old page
    // keeps issuing requests in [nav-start, commit]; the time floor reads them
    // Pending forever, the document binding supersedes them.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('non-terminal current-page row (latest document D2) → not preserved', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      documentId: 'D2',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('terminal prior-page row (old document, completed) → never preserved-unknown', () => {
    const lc = makeLifecycle({
      phase: 'completed',
      startedAtMs: 500,
      completedAtMs: 800,
      documentId: 'D1',
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('row carries a documentId but the latest page has none (pre-resolution window) → time floor', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000 })).toBe(false);
  });

  it('latest page has a documentId but the row has none (iframe subresource / worker) → time floor', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('loader identity outranks document identity when both bindings exist', () => {
    // The two keys never coexist in practice (CDP rows carry loaderId,
    // heuristic rows documentId); the order of authority is pinned anyway so
    // the CDP tier stays byte-identical.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      completedAtMs: undefined,
      loaderId: 'L2',
      documentId: 'D1',
      har: { response: undefined },
    });
    const both = {
      latestNavStartedAtMs: 1_000,
      latestPageLoaderId: 'L2',
      latestPageDocumentId: 'D2',
      pageLoaderIds: ['L1', 'L2'],
    };
    expect(isPreservedUnknown(lc, both)).toBe(false);
  });

  it('a non-member loader id falls through to the document arm', () => {
    // An iframe-shaped loader id closes the loader arm; the document binding
    // (old document D1) still supersedes the row.
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: undefined,
      loaderId: 'IFRAME-LOADER',
      documentId: 'D1',
      har: { response: undefined },
    });
    const both = {
      latestNavStartedAtMs: 1_000,
      latestPageLoaderId: 'L2',
      latestPageDocumentId: 'D2',
      pageLoaderIds: ['L1', 'L2'],
    };
    expect(isPreservedUnknown(lc, both)).toBe(true);
  });
});

describe('isPreservedUnknown — binding-aware abort carve-out (bound rows)', () => {
  const abort = { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' } as const;
  // Page D1 committed at 1000, superseded by D2 committing at 5000 — the
  // anchor a bound aborted row is classified against.
  const anchor = {
    latestNavStartedAtMs: 4_800,
    latestPageDocumentId: 'D2',
    navStartsMs: [900, 4_800],
    pageCommitsMs: [1_000, 5_000],
  };

  it('teardown: superseded binding + commit-coincident terminal → preserved-unknown', () => {
    // The transition class: the row started AFTER the superseding nav began
    // (4900 > 4800), so navStartedDuring misses it — binding + coincidence is
    // what classifies it. Aborted 6ms after D2's commit, within ε.
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 4_900,
      completedAtMs: 5_006,
      error: abort,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('teardown: the abort may land slightly BEFORE the commit instant (net-process abort beats the mint)', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 1_500,
      completedAtMs: 4_993,
      error: abort,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(true);
  });

  it('teardown via the loader-identity arm (CDP-shaped binding, same law)', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 4_900,
      completedAtMs: 5_004,
      error: abort,
      loaderId: 'L1',
      har: { response: undefined },
    });
    const cdpAnchor = { ...anchor, latestPageLoaderId: 'L2', pageLoaderIds: ['L1', 'L2'] };
    expect(isPreservedUnknown(lc, cdpAnchor)).toBe(true);
  });

  it('explicit cancel then navigate: superseded binding, no coincident commit → stays (canceled) forever', () => {
    // Canceled at 3000, mid-page, far from both commits; later navigations
    // supersede its binding but must never flip it to (unknown).
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 1_500,
      completedAtMs: 3_000,
      error: abort,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('explicit cancel ε-near a commit on the still-current page → not preserved (binding wins)', () => {
    // The row belongs to the LATEST page; even a terminal coincident with a
    // commit instant is a live-page cancel, never a teardown.
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 4_900,
      completedAtMs: 5_010,
      error: abort,
      documentId: 'D2',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('a commit that predates the row never reads as its teardown (in-flight-window guard)', () => {
    // Issued 2ms after D2's commit and explicitly canceled 3ms later: the
    // terminal sits within ε of the commit, but the commit is not inside the
    // row's in-flight window, so this is a cancel, not a teardown.
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 5_002,
      completedAtMs: 5_005,
      error: abort,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, anchor)).toBe(false);
  });

  it('superseded binding with no commit list (pre-upgrade anchor) → stays (canceled), strictly no worse', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 4_900,
      completedAtMs: 5_006,
      error: abort,
      documentId: 'D1',
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 4_800, latestPageDocumentId: 'D2' })).toBe(false);
  });
});

describe('isPreservedUnknown — cancellation-abort carve-out (unbound rows, timing fallback)', () => {
  const abort = { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' } as const;

  it('an abort with a navigation inside its in-flight window IS preserved (the nav tore it down)', () => {
    // The nav (1000) committed while the request was in flight (500 → 1200), so
    // it caused the abort → navigation-abandoned.
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: 200,
      startedAtMs: 500,
      completedAtMs: 1_200,
      error: abort,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000, navStartsMs: [1_000] })).toBe(true);
  });

  it('an abort on the still-current page is NOT preserved (a genuine cancel)', () => {
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: 200,
      startedAtMs: 1_500, // started after the nav → no nav in its window
      completedAtMs: 1_800,
      error: abort,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000, navStartsMs: [1_000] })).toBe(false);
  });

  it('an abort that resolved before a later navigation stays NOT preserved (no flip to unknown)', () => {
    // Canceled at 400, entirely before the nav floor (1000). No nav in its
    // in-flight window (200, 400] → a later navigation must not retroactively
    // turn a real cancel into a preserved-unknown.
    const lc = makeLifecycle({
      phase: 'failed',
      statusCode: undefined,
      startedAtMs: 200,
      completedAtMs: 400,
      error: abort,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000, navStartsMs: [1_000] })).toBe(false);
  });

  it('a genuine completion (no abort) superseded by a navigation is NOT preserved', () => {
    // A real terminal outcome — the completedAtMs gate still wins.
    const lc = makeLifecycle({
      phase: 'completed',
      statusCode: 200,
      startedAtMs: 500,
      completedAtMs: 800,
      har: { response: undefined },
    });
    expect(isPreservedUnknown(lc, { latestNavStartedAtMs: 1_000, navStartsMs: [1_000] })).toBe(false);
  });
});

describe('hasObservedResponseData', () => {
  it('is true once a body chunk was observed (lastActivityAtMs / bytesReceivedSoFar)', () => {
    expect(hasObservedResponseData(makeLifecycle({ lastActivityAtMs: 5 }))).toBe(true);
    expect(hasObservedResponseData(makeLifecycle({ bytesReceivedSoFar: 1 }))).toBe(true);
  });

  it('is false for a header-only / data-less row', () => {
    expect(
      hasObservedResponseData(
        makeLifecycle({ phase: 'headers-received', lastActivityAtMs: undefined, bytesReceivedSoFar: undefined }),
      ),
    ).toBe(false);
  });
});

describe('supersessionAnchorFromPages', () => {
  const page = (startedAtMs: number, loaderId?: string, documentId?: string): Page =>
    ({ startedAtMs, ...(loaderId ? { loaderId } : {}), ...(documentId ? { documentId } : {}) }) as Page;

  it('reads the latest page for the floor and loader id, and every nav start', () => {
    const anchor = supersessionAnchorFromPages([page(100, 'L1'), page(500, 'L2')]);
    expect(anchor.latestNavStartedAtMs).toBe(500);
    expect(anchor.latestPageLoaderId).toBe('L2');
    expect(anchor.navStartsMs).toEqual([100, 500]);
    // Every observed page's loader id — the membership gate's universe.
    expect(anchor.pageLoaderIds).toEqual(['L1', 'L2']);
  });

  it('reads the latest page documentId (heuristic binding key)', () => {
    const anchor = supersessionAnchorFromPages([page(100, undefined, 'D1'), page(500, undefined, 'D2')]);
    expect(anchor.latestPageDocumentId).toBe('D2');
    expect(anchor.latestPageLoaderId).toBeUndefined();
    // Heuristic pages carry no loader id — the membership list stays empty.
    expect(anchor.pageLoaderIds).toEqual([]);
  });

  it('falls back to a -1 floor and an empty nav list when there are no pages', () => {
    const anchor = supersessionAnchorFromPages([]);
    expect(anchor.latestNavStartedAtMs).toBe(-1);
    expect(anchor.navStartsMs).toEqual([]);
    expect(anchor.pageCommitsMs).toEqual([]);
    expect(anchor.pageLoaderIds).toEqual([]);
  });

  it('collects every page commit instant, skipping pages with none', () => {
    const withCommit = { ...page(100), committedAtMs: 250 } as Page;
    const withoutCommit = page(500);
    const latest = { ...page(900), committedAtMs: 1_000 } as Page;
    const anchor = supersessionAnchorFromPages([withCommit, withoutCommit, latest]);
    expect(anchor.pageCommitsMs).toEqual([250, 1_000]);
    // The commit list is a sibling of the nav-start list, not a replacement.
    expect(anchor.navStartsMs).toEqual([100, 500, 900]);
  });
});
