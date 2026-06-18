import type { Page } from '@openheaders/core/page-stream';
import type { RedirectHop, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRow } from '@openheaders/ui/panel/data/inspector-facet';
import {
  attachFiresToRows,
  currentHarEntry,
  currentResponseBody,
  type InspectorRowWithFires,
  isFailedLifecycle,
  isPendingLifecycle,
  resolvePageref,
  stampRedirectRewrites,
} from '@openheaders/ui/panel/data/inspector-row-projection';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

function harEntry(url: string): InspectorHarEntry {
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
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
  };
}

function harBody(content: string): InspectorHarBody {
  return {
    method: 'GET',
    url: 'https://openheaders.io',
    startedDateTime: new Date(0).toISOString(),
    content,
    encoding: '',
  };
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
    har: [],
    harBodyByHop: [],
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
    const har: (InspectorHarEntry | null)[] = [
      harEntry('https://openheaders.io/a'),
      harEntry('https://openheaders.io/b'),
    ];
    const bodies: (InspectorHarBody | null)[] = [null, harBody('hop1')];
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

  it('attributes a request just before the first page to that first page', () => {
    // A page's startedAtMs is the queue-adjusted document-request start, so
    // that defining request begins marginally before its own page.
    expect(resolvePageref(lifecycle({ startedAtMs: -1 }), pages)).toBe('page_1');
  });

  it('still binds a later request to the later page', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 2000 }), pages)).toBe('page_2');
  });

  it('falls back to the earliest page for a pre-first-page request with multiple pages', () => {
    const three: Page[] = [...pages, { id: 'page_3', startedAtMs: 3000, url: 'https://openheaders.io/c' }];
    expect(resolvePageref(lifecycle({ startedAtMs: -100 }), three)).toBe('page_1');
  });

  it('returns null only when there are no pages', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 500 }), [])).toBeNull();
  });
});

describe('resolvePageref — loader join (authoritative)', () => {
  // Two navigations whose loader ids the requests carry. page_2 started while
  // a late subresource of page_1 was still issuing — the transition window.
  const pages: Page[] = [
    { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/a', loaderId: 'L1' },
    { id: 'page_2', startedAtMs: 1000, url: 'https://openheaders.io/b', loaderId: 'L2' },
  ];

  it('binds a row to the page whose loader id it carries', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 200, loaderId: 'L1' }), pages)).toBe('page_1');
    expect(resolvePageref(lifecycle({ startedAtMs: 1200, loaderId: 'L2' }), pages)).toBe('page_2');
  });

  it('keeps a transition-window subresource on its own (old) page despite a newer start', () => {
    // Start-time proximity would mis-bin this to page_2 (started 1500 > 1000);
    // the loader id pins it to page_1, the page it actually belongs to.
    expect(resolvePageref(lifecycle({ startedAtMs: 1500, loaderId: 'L1' }), pages)).toBe('page_1');
  });

  it('falls back to start-time proximity when the row carries no loader id', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 1500 }), pages)).toBe('page_2');
  });

  it('falls back to start-time proximity when no known page carries the row loader id', () => {
    // CDP attached mid-flight: the row's page is not yet observed.
    expect(resolvePageref(lifecycle({ startedAtMs: 1500, loaderId: 'L9' }), pages)).toBe('page_2');
  });

  it('returns null for an empty page list even with a loader id', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 200, loaderId: 'L1' }), [])).toBeNull();
  });
});

describe('resolvePageref — document join (heuristic sibling)', () => {
  const pages: Page[] = [
    { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/a', documentId: 'D1' },
    { id: 'page_2', startedAtMs: 1000, url: 'https://openheaders.io/b', documentId: 'D2' },
  ];

  it('binds a row to the page whose committed documentId it carries', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 200, documentId: 'D1' }), pages)).toBe('page_1');
    expect(resolvePageref(lifecycle({ startedAtMs: 1200, documentId: 'D2' }), pages)).toBe('page_2');
  });

  it('keeps a transition-window subresource on its own (old) page despite a newer start', () => {
    expect(resolvePageref(lifecycle({ startedAtMs: 1500, documentId: 'D1' }), pages)).toBe('page_1');
  });

  it('the LAST page with the documentId wins (a BFCache restore revives the id)', () => {
    const restored: Page[] = [
      ...pages,
      { id: 'page_3', startedAtMs: 2000, url: 'https://openheaders.io/a', documentId: 'D1' },
    ];
    expect(resolvePageref(lifecycle({ startedAtMs: 2500, documentId: 'D1' }), restored)).toBe('page_3');
  });

  it('falls back to start-time proximity when no known page carries the documentId', () => {
    // The heuristic resolution still in flight, or an iframe-issued binding.
    expect(resolvePageref(lifecycle({ startedAtMs: 1500, documentId: 'D9' }), pages)).toBe('page_2');
  });

  it('loader join outranks the document join', () => {
    const both: Page[] = [
      { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/a', loaderId: 'L1', documentId: 'D1' },
      { id: 'page_2', startedAtMs: 1000, url: 'https://openheaders.io/b', loaderId: 'L2', documentId: 'D2' },
    ];
    expect(resolvePageref(lifecycle({ startedAtMs: 1500, loaderId: 'L1', documentId: 'D2' }), both)).toBe('page_1');
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

describe('stampRedirectRewrites', () => {
  function rowWithFires(lc: RequestLifecycle, fires: InspectorFire[] = []): InspectorRowWithFires {
    return { lifecycle: lc, displayId: 1, consolidatedRetryOf: [], fires };
  }

  function rewriteFire(type: 'query-param' | 'redirect', over: Partial<InspectorFire> = {}): InspectorFire {
    return fire({
      ruleUid: `rule_${type}`,
      requestId: 'r1',
      ruleSnapshot: { ruleUid: `rule_${type}`, name: type, type, enabled: true },
      ...over,
    });
  }

  // A rule's own internal redirect — only hops the real lifecycle marks
  // `internal` carry the rewrite label, never a server redirect leg.
  function internalHop(): RedirectHop {
    return {
      sourceUrl: 'https://openheaders.io',
      redirectUrl: 'https://openheaders.io/x',
      statusCode: 307,
      timestampMs: 1000,
      internal: true,
    };
  }

  it('marks a synthetic hop row when its real request carries a query-param fire', () => {
    const real = rowWithFires(lifecycle({ requestId: 'r1', redirectHopCount: 1, redirectHops: [internalHop()] }), [
      rewriteFire('query-param'),
    ]);
    const hop = rowWithFires(lifecycle({ requestId: 'oh-redir:r1#0', statusCode: 307 }));
    const out = stampRedirectRewrites([real, hop]);
    expect(out.find((r) => r.lifecycle.requestId === 'oh-redir:r1#0')?.redirectRewrite).toBe('query-param');
    // The real row that carried the fire is not itself a rewrite hop.
    expect(out.find((r) => r.lifecycle.requestId === 'r1')?.redirectRewrite).toBeUndefined();
  });

  it('marks the hop with the redirect kind for a redirect-rule fire', () => {
    const real = rowWithFires(lifecycle({ requestId: 'r1', redirectHopCount: 1, redirectHops: [internalHop()] }), [
      rewriteFire('redirect'),
    ]);
    const hop = rowWithFires(lifecycle({ requestId: 'oh-redir:r1#0', statusCode: 307 }));
    const out = stampRedirectRewrites([real, hop]);
    expect(out.find((r) => r.lifecycle.requestId === 'oh-redir:r1#0')?.redirectRewrite).toBe('redirect');
  });

  it('ignores a shadowed fire — the rule did not actually apply', () => {
    const shadowed = rewriteFire('query-param', {
      shadowedBy: { uid: 'rule_block', name: 'block', kind: 'block-terminal' },
    });
    const real = rowWithFires(lifecycle({ requestId: 'r1' }), [shadowed]);
    const hop = rowWithFires(lifecycle({ requestId: 'oh-redir:r1#0', statusCode: 307 }));
    const out = stampRedirectRewrites([real, hop]);
    expect(out.find((r) => r.lifecycle.requestId === 'oh-redir:r1#0')?.redirectRewrite).toBeUndefined();
  });

  it('leaves a genuine server redirect hop unmarked (no redirect-class fire)', () => {
    const real = rowWithFires(lifecycle({ requestId: 'r1' }), [
      fire({ requestId: 'r1', ruleSnapshot: { ruleUid: 'h', name: 'h', type: 'header', enabled: true } }),
    ]);
    const hop = rowWithFires(lifecycle({ requestId: 'oh-redir:r1#0', statusCode: 301 }));
    const out = stampRedirectRewrites([real, hop]);
    expect(out.find((r) => r.lifecycle.requestId === 'oh-redir:r1#0')?.redirectRewrite).toBeUndefined();
  });

  it('returns the same array reference when nothing matches', () => {
    const rows = [rowWithFires(lifecycle({ requestId: 'r1' }))];
    expect(stampRedirectRewrites(rows)).toBe(rows);
  });
});
