import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import {
  classifyRequestState,
  isFailedNetworkRequest,
  isPreservedUnknown,
  statusCellText,
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
  // The floor (nav start) is deliberately EARLY so a transition-window row that
  // started AFTER it would pass the time floor — proving loader identity, not
  // time, is what decides supersession here.
  const anchor = { latestNavStartedAtMs: 1_000, latestPageLoaderId: 'L2' };

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
});
