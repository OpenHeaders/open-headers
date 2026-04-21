import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { attributeHeaders } from '@/panel/data/header-attribution';
import type { InspectorFire } from '@/panel/data/types';

function headerRule(
  uid: string,
  name: string,
  mods: V5.HeaderModification[],
  direction: 'request' | 'response',
): V5.Rule {
  return {
    uid,
    type: 'header',
    name,
    enabled: true,
    conditions: [],
    action: {
      requestHeaders: direction === 'request' ? mods : [],
      responseHeaders: direction === 'response' ? mods : [],
    },
    // Fields required by V5.RuleBase — fill with empty defaults where
    // the attribution logic doesn't touch them.
  } as unknown as V5.Rule;
}

function fire(ruleUid: string): InspectorFire {
  return {
    ruleUid,
    t: 0,
    pattern: '',
    authoritative: true,
    evidence: 'matched',
  };
}

function byUid(...rules: V5.Rule[]): ReadonlyMap<string, V5.Rule> {
  const m = new Map<string, V5.Rule>();
  for (const r of rules) m.set(r.uid, r);
  return m;
}

describe('attributeHeaders', () => {
  it('passes server headers through unchanged when no rules fired', () => {
    const result = attributeHeaders(
      [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Cache-Control', value: 'no-store' },
      ],
      [],
      'response',
      byUid(),
    );
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.attribution.kind === 'server')).toBe(true);
  });

  it('marks an existing header as `modified` when a rule overrides it', () => {
    const rule = headerRule(
      'r1',
      'Force JSON',
      [{ operation: 'override', headerName: 'Content-Type', value: 'application/json' }],
      'response',
    );
    const result = attributeHeaders(
      [{ name: 'Content-Type', value: 'text/html' }],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.value).toBe('application/json');
    expect(r.attribution.kind).toBe('modified');
    if (r.attribution.kind === 'modified') {
      expect(r.attribution.originalValue).toBe('text/html');
      expect(r.attribution.rule.uid).toBe('r1');
    }
  });

  it('emits an `added` row when an override targets a header the server did not send', () => {
    const rule = headerRule(
      'r1',
      'CORS',
      [{ operation: 'override', headerName: 'Access-Control-Allow-Origin', value: '*' }],
      'response',
    );
    const result = attributeHeaders(
      [{ name: 'Content-Type', value: 'application/json' }],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(result).toHaveLength(2);
    expect(result[0].attribution.kind).toBe('server'); // Content-Type first
    expect(result[1].attribution.kind).toBe('added');
    expect(result[1].name).toBe('Access-Control-Allow-Origin');
    expect(result[1].value).toBe('*');
  });

  it('marks a server header as `removed` when a rule removes it', () => {
    const rule = headerRule(
      'r1',
      'Strip CSP',
      [{ operation: 'remove', headerName: 'Content-Security-Policy' }],
      'response',
    );
    const result = attributeHeaders(
      [
        { name: 'Content-Security-Policy', value: "default-src 'self'" },
        { name: 'Content-Type', value: 'text/html' },
      ],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(result[0].attribution.kind).toBe('removed');
    expect(result[1].attribution.kind).toBe('server');
  });

  it('drops `remove` silently when the server did not send the named header', () => {
    const rule = headerRule('r1', 'Strip', [{ operation: 'remove', headerName: 'X-Missing' }], 'response');
    const result = attributeHeaders(
      [{ name: 'Content-Type', value: 'text/html' }],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(result).toHaveLength(1);
    expect(result[0].attribution.kind).toBe('server');
  });

  it('emits a duplicate `added` row for `add` (append) even when server sent the same header', () => {
    const rule = headerRule(
      'r1',
      'Dup',
      [{ operation: 'add', headerName: 'Set-Cookie', value: 'extra=1' }],
      'response',
    );
    const result = attributeHeaders(
      [{ name: 'Set-Cookie', value: 'session=abc' }],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(result).toHaveLength(2);
    expect(result[0].attribution.kind).toBe('server');
    expect(result[0].value).toBe('session=abc');
    expect(result[1].attribution.kind).toBe('added');
    expect(result[1].value).toBe('extra=1');
  });

  it('matches header names case-insensitively', () => {
    const rule = headerRule(
      'r1',
      'Override',
      [{ operation: 'override', headerName: 'content-type', value: 'application/json' }],
      'response',
    );
    const result = attributeHeaders(
      [{ name: 'Content-Type', value: 'text/html' }],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(result[0].attribution.kind).toBe('modified');
    expect(result[0].value).toBe('application/json');
  });

  it('merge concatenates with the right default separator', () => {
    const cookieRule = headerRule(
      'r1',
      'Merge cookie',
      [{ operation: 'merge', headerName: 'Cookie', value: 'k=v' }],
      'request',
    );
    const otherRule = headerRule(
      'r2',
      'Merge accept',
      [{ operation: 'merge', headerName: 'Accept', value: 'text/html' }],
      'request',
    );
    const cookie = attributeHeaders([{ name: 'Cookie', value: 'a=b' }], [fire('r1')], 'request', byUid(cookieRule));
    expect(cookie[0].value).toBe('a=b; k=v');

    const accept = attributeHeaders(
      [{ name: 'Accept', value: 'text/plain' }],
      [fire('r2')],
      'request',
      byUid(otherRule),
    );
    expect(accept[0].value).toBe('text/plain, text/html');
  });

  it('honours a custom mergeSeparator when provided', () => {
    const rule = headerRule(
      'r1',
      'Merge pipe',
      [{ operation: 'merge', headerName: 'X-Multi', value: 'b', mergeSeparator: ' | ' }],
      'request',
    );
    const result = attributeHeaders([{ name: 'X-Multi', value: 'a' }], [fire('r1')], 'request', byUid(rule));
    expect(result[0].value).toBe('a | b');
  });

  it('dedupes multiple evidence rows for the same rule (authoritative + inferred)', () => {
    // The same rule often appears twice in `fires` — once from
    // Chrome's `onRuleMatchedDebug` (authoritative) and once from
    // URL-pattern inference. Treat as a single application.
    const rule = headerRule('r1', 'Debug', [{ operation: 'override', headerName: 'X-Debug', value: 'on' }], 'response');
    const result = attributeHeaders(
      [{ name: 'Content-Type', value: 'text/html' }],
      [
        { ruleUid: 'r1', t: 0, pattern: '', authoritative: true, evidence: 'confirmed' },
        { ruleUid: 'r1', t: 0, pattern: '*://example.com/*', authoritative: false, evidence: 'matched' },
      ],
      'response',
      byUid(rule),
    );
    expect(result).toHaveLength(2); // server + one injection
    expect(result[1].attribution.kind).toBe('added');
    expect(result[1].name).toBe('X-Debug');
  });

  it('collapses `override` from two distinct rules adding the same header into one row (last wins)', () => {
    // Two rules both inject X-Foo with override. In DNR this is
    // "last registered / highest priority wins" — we show one row
    // attributed to the later fire, not two duplicates.
    const a = headerRule('r1', 'A', [{ operation: 'override', headerName: 'X-Foo', value: 'a' }], 'response');
    const b = headerRule('r2', 'B', [{ operation: 'override', headerName: 'X-Foo', value: 'b' }], 'response');
    const result = attributeHeaders([], [fire('r1'), fire('r2')], 'response', byUid(a, b));
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('b');
    if (result[0].attribution.kind === 'added') {
      expect(result[0].attribution.rule.uid).toBe('r2');
    }
  });

  it('preserves the server original value across multiple overrides', () => {
    // Two rules both override an existing server header. The
    // `originalValue` must stay the *server* value — not whatever the
    // previous override wrote.
    const a = headerRule('r1', 'A', [{ operation: 'override', headerName: 'X-Foo', value: 'a' }], 'response');
    const b = headerRule('r2', 'B', [{ operation: 'override', headerName: 'X-Foo', value: 'b' }], 'response');
    const result = attributeHeaders(
      [{ name: 'X-Foo', value: 'server' }],
      [fire('r1'), fire('r2')],
      'response',
      byUid(a, b),
    );
    expect(result[0].value).toBe('b');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.originalValue).toBe('server');
    }
  });

  it('a later `remove` annihilates an earlier-injected added row', () => {
    const adder = headerRule('r1', 'Add', [{ operation: 'override', headerName: 'X-Foo', value: 'x' }], 'response');
    const remover = headerRule('r2', 'Rm', [{ operation: 'remove', headerName: 'X-Foo' }], 'response');
    const result = attributeHeaders([], [fire('r1'), fire('r2')], 'response', byUid(adder, remover));
    // Neither server- nor rule-injected X-Foo survives — the remove
    // wipes the previous injection.
    expect(result).toHaveLength(0);
  });

  it('later fires win when multiple rules touch the same header', () => {
    const first = headerRule(
      'r1',
      'First',
      [{ operation: 'override', headerName: 'X-Foo', value: 'first' }],
      'response',
    );
    const second = headerRule(
      'r2',
      'Second',
      [{ operation: 'override', headerName: 'X-Foo', value: 'second' }],
      'response',
    );
    const result = attributeHeaders(
      [{ name: 'X-Foo', value: 'server' }],
      [fire('r1'), fire('r2')],
      'response',
      byUid(first, second),
    );
    expect(result[0].value).toBe('second');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.rule.uid).toBe('r2');
    }
  });

  it('ignores fires whose rule the lookup cannot resolve (rule deleted since)', () => {
    const result = attributeHeaders(
      [{ name: 'Content-Type', value: 'text/html' }],
      [fire('missing')],
      'response',
      byUid(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].attribution.kind).toBe('server');
  });

  it('ignores non-header rules (redirect/mock/block) — they do not produce header attributions', () => {
    const nonHeader: V5.Rule = {
      uid: 'r1',
      type: 'redirect',
      name: 'Redir',
      enabled: true,
      conditions: [],
      action: { matchPattern: 'x', redirectTo: 'y' },
    } as unknown as V5.Rule;
    const result = attributeHeaders([{ name: 'Location', value: '/old' }], [fire('r1')], 'response', byUid(nonHeader));
    expect(result[0].attribution.kind).toBe('server');
  });

  it('tags request-side cache-control / pragma as system when Disable Cache is on', () => {
    // Panel's Disable Cache toggle installs a DNR rule that adds
    // `Cache-Control: no-cache` to request headers. The attributor
    // tags these so the UI renders them yellow (system) instead of
    // plain server.
    const result = attributeHeaders(
      [
        { name: 'Host', value: 'example.com' },
        { name: 'Cache-Control', value: 'no-cache' },
        { name: 'Pragma', value: 'no-cache' },
      ],
      [],
      'request',
      byUid(),
      { cacheBypassEnabled: true },
    );
    expect(result).toHaveLength(3);
    expect(result[0].attribution.kind).toBe('server');
    expect(result[1].attribution.kind).toBe('system');
    expect(result[2].attribution.kind).toBe('system');
    if (result[1].attribution.kind === 'system') {
      expect(result[1].attribution.source).toBe('cache-bypass');
      expect(result[1].attribution.label).toBe('Bypass HTTP Cache');
    }
  });

  it('does NOT apply system tagging on response headers even when cache bypass is on', () => {
    // The DNR rule only modifies REQUEST headers. A server that
    // happens to reply with `Cache-Control` headers is unrelated.
    const result = attributeHeaders([{ name: 'Cache-Control', value: 'no-cache' }], [], 'response', byUid(), {
      cacheBypassEnabled: true,
    });
    expect(result[0].attribution.kind).toBe('server');
  });

  it('does NOT system-tag when Disable Cache is off', () => {
    const result = attributeHeaders([{ name: 'Cache-Control', value: 'no-cache' }], [], 'request', byUid(), {
      cacheBypassEnabled: false,
    });
    expect(result[0].attribution.kind).toBe('server');
  });

  it('tags request-side cache-control / pragma as system/live-rules when liveRulesFired=true', () => {
    // Live Rules Mode: a user header rule fired on this request and did
    // not itself touch Cache-Control, so the DNR synthesizer prepended
    // cache-bypass headers. Attribute them as yellow (system/live-rules)
    // rather than plain server.
    const result = attributeHeaders(
      [
        { name: 'Host', value: 'example.com' },
        { name: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { name: 'Pragma', value: 'no-cache' },
      ],
      [],
      'request',
      byUid(),
      { liveRulesFired: true },
    );
    expect(result[0].attribution.kind).toBe('server');
    expect(result[1].attribution.kind).toBe('system');
    expect(result[2].attribution.kind).toBe('system');
    if (result[1].attribution.kind === 'system') {
      expect(result[1].attribution.source).toBe('live-rules');
      expect(result[1].attribution.label).toBe('Live Rules');
    }
  });

  it('panel Disable Cache wins the label when both flags are set simultaneously', () => {
    // The toolbar toggle is a more specific user action than the
    // implicit Live Rules gate, so it owns the attribution label.
    const result = attributeHeaders([{ name: 'Cache-Control', value: 'no-cache' }], [], 'request', byUid(), {
      cacheBypassEnabled: true,
      liveRulesFired: true,
    });
    expect(result[0].attribution.kind).toBe('system');
    if (result[0].attribution.kind === 'system') {
      expect(result[0].attribution.source).toBe('cache-bypass');
    }
  });

  it('does not system-tag response-side cache-control even when liveRulesFired', () => {
    // Layer 1 only injects on REQUEST headers. Server-sent
    // Cache-Control on the response is unrelated.
    const result = attributeHeaders([{ name: 'Cache-Control', value: 'no-cache' }], [], 'response', byUid(), {
      liveRulesFired: true,
    });
    expect(result[0].attribution.kind).toBe('server');
  });

  it('does not system-tag a Cache-Control value that does not contain "no-cache"', () => {
    // Narrow the signature: the tag only fires when the value actually
    // looks like our cache-bypass injection. Protects against confusing
    // a server-sent `Cache-Control: max-age=0` with our injection.
    const result = attributeHeaders([{ name: 'Cache-Control', value: 'max-age=0' }], [], 'request', byUid(), {
      liveRulesFired: true,
    });
    expect(result[0].attribution.kind).toBe('server');
  });

  it('applies only the direction asked for — a request-header rule does not touch response headers', () => {
    const rule = headerRule(
      'r1',
      'Auth',
      [{ operation: 'override', headerName: 'Authorization', value: 'Bearer X' }],
      'request',
    );
    const response = attributeHeaders(
      [{ name: 'Content-Type', value: 'text/html' }],
      [fire('r1')],
      'response',
      byUid(rule),
    );
    expect(response).toHaveLength(1);
    expect(response[0].attribution.kind).toBe('server');

    const request = attributeHeaders([], [fire('r1')], 'request', byUid(rule));
    expect(request).toHaveLength(1);
    expect(request[0].attribution.kind).toBe('added');
  });
});
