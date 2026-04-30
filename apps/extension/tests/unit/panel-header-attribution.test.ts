import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { attributeHeaders } from '@/panel/data/header-attribution';
import type { InspectorFire } from '@/panel/data/types';
import type { RuleSnapshot, RuleSnapshotHeaderMod } from '@/types/telemetry';

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
      [{ uid: 'thm00037', operation: 'override', headerName: 'Content-Type', value: 'application/json' }],
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
      expect(r.attribution.ctx.ruleUid).toBe('r1');
    }
  });

  it('emits an `added` row when an override targets a header the server did not send', () => {
    const rule = headerRule(
      'r1',
      'CORS',
      [{ uid: 'thm00038', operation: 'override', headerName: 'Access-Control-Allow-Origin', value: '*' }],
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

  it('marks a server header as `removed` (source: server) when a rule removes it', () => {
    const rule = headerRule(
      'r1',
      'Strip CSP',
      [{ uid: 'thm00039', operation: 'remove', headerName: 'Content-Security-Policy' }],
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
    if (result[0].attribution.kind === 'removed') {
      expect(result[0].attribution.source).toBe('server');
      expect(result[0].attribution.originalValue).toBe("default-src 'self'");
      expect(result[0].attribution.injectingRule).toBeUndefined();
    }
    expect(result[1].attribution.kind).toBe('server');
  });

  it('drops `remove` silently when the server did not send the named header', () => {
    const rule = headerRule('r1', 'Strip', [{ uid: 'thm00040', operation: 'remove', headerName: 'X-Missing' }], 'response');
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
      [{ uid: 'thm00041', operation: 'add', headerName: 'Set-Cookie', value: 'extra=1' }],
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
      [{ uid: 'thm00042', operation: 'override', headerName: 'content-type', value: 'application/json' }],
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
      [{ uid: 'thm00043', operation: 'merge', headerName: 'Cookie', value: 'k=v' }],
      'request',
    );
    const otherRule = headerRule(
      'r2',
      'Merge accept',
      [{ uid: 'thm00044', operation: 'merge', headerName: 'Accept', value: 'text/html' }],
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
      [{ uid: 'thm00045', operation: 'merge', headerName: 'X-Multi', value: 'b', mergeSeparator: ' | ' }],
      'request',
    );
    const result = attributeHeaders([{ name: 'X-Multi', value: 'a' }], [fire('r1')], 'request', byUid(rule));
    expect(result[0].value).toBe('a | b');
  });

  it('dedupes multiple evidence rows for the same rule (authoritative + inferred)', () => {
    // The same rule often appears twice in `fires` — once from
    // Chrome's `onRuleMatchedDebug` (authoritative) and once from
    // URL-pattern inference. Treat as a single application.
    const rule = headerRule('r1', 'Debug', [{ uid: 'thm00046', operation: 'override', headerName: 'X-Debug', value: 'on' }], 'response');
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
    const a = headerRule('r1', 'A', [{ uid: 'thm00047', operation: 'override', headerName: 'X-Foo', value: 'a' }], 'response');
    const b = headerRule('r2', 'B', [{ uid: 'thm00048', operation: 'override', headerName: 'X-Foo', value: 'b' }], 'response');
    const result = attributeHeaders([], [fire('r1'), fire('r2')], 'response', byUid(a, b));
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('b');
    if (result[0].attribution.kind === 'added') {
      expect(result[0].attribution.ctx.ruleUid).toBe('r2');
    }
  });

  it('preserves the server original value across multiple overrides', () => {
    // Two rules both override an existing server header. The
    // `originalValue` must stay the *server* value — not whatever the
    // previous override wrote.
    const a = headerRule('r1', 'A', [{ uid: 'thm00049', operation: 'override', headerName: 'X-Foo', value: 'a' }], 'response');
    const b = headerRule('r2', 'B', [{ uid: 'thm00050', operation: 'override', headerName: 'X-Foo', value: 'b' }], 'response');
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

  it('a later `remove` keeps a cancelled-injection row visible (attributed to the remover)', () => {
    // When one rule injects a header and another rule then removes it,
    // the row stays in the list — without it the user has no signal
    // either rule fired. Attribution points at the remover (DNR's
    // winner); the injecting rule is recorded so the popover can
    // explain the chain.
    const adder = headerRule('r1', 'Add', [{ uid: 'thm00051', operation: 'override', headerName: 'X-Foo', value: 'x' }], 'response');
    const remover = headerRule('r2', 'Rm', [{ uid: 'thm00052', operation: 'remove', headerName: 'X-Foo' }], 'response');
    const result = attributeHeaders([], [fire('r1'), fire('r2')], 'response', byUid(adder, remover));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('X-Foo');
    expect(result[0].value).toBe('x');
    if (result[0].attribution.kind === 'removed') {
      expect(result[0].attribution.source).toBe('injection');
      expect(result[0].attribution.ctx.ruleUid).toBe('r2');
      expect(result[0].attribution.injectingRule?.ruleUid).toBe('r1');
      expect(result[0].attribution.originalValue).toBe('x');
    }
  });

  it('later fires win when multiple rules touch the same header', () => {
    const first = headerRule(
      'r1',
      'First',
      [{ uid: 'thm00053', operation: 'override', headerName: 'X-Foo', value: 'first' }],
      'response',
    );
    const second = headerRule(
      'r2',
      'Second',
      [{ uid: 'thm00054', operation: 'override', headerName: 'X-Foo', value: 'second' }],
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
      expect(result[0].attribution.ctx.ruleUid).toBe('r2');
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
      action: { redirectTo: 'y' },
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

  // ── Snapshot behavior ────────────────────────────────────────────
  //
  // A fire's `ruleSnapshot` is the immutable record of what the rule
  // looked like at fire-emit time in the background. Once attached, the
  // panel must render from it — never from the live rule — so that
  // editing the rule afterwards does not retroactively rewrite the
  // value displayed for a past request. These tests pin that contract.

  function snapshotOf(rule: V5.HeaderRule, overrides?: Partial<RuleSnapshot>): RuleSnapshot {
    const headerMods: RuleSnapshotHeaderMod[] = [];
    for (const m of rule.action.requestHeaders) {
      headerMods.push({
        direction: 'request',
        operation: m.operation,
        headerName: m.headerName,
        ...(m.operation !== 'remove' && m.value !== undefined
          ? { valueTemplate: m.value, valueResolved: m.value }
          : {}),
        ...(m.operation === 'merge' && m.mergeSeparator !== undefined ? { mergeSeparator: m.mergeSeparator } : {}),
      });
    }
    for (const m of rule.action.responseHeaders) {
      headerMods.push({
        direction: 'response',
        operation: m.operation,
        headerName: m.headerName,
        ...(m.operation !== 'remove' && m.value !== undefined
          ? { valueTemplate: m.value, valueResolved: m.value }
          : {}),
        ...(m.operation === 'merge' && m.mergeSeparator !== undefined ? { mergeSeparator: m.mergeSeparator } : {}),
      });
    }
    return {
      ruleUid: rule.uid,
      name: rule.name,
      type: 'header',
      enabled: true,
      headerMods,
      ...overrides,
    };
  }

  function fireWithSnapshot(snap: RuleSnapshot): InspectorFire {
    return { ruleUid: snap.ruleUid, t: 0, pattern: '', authoritative: true, evidence: 'matched', ruleSnapshot: snap };
  }

  it('renders the snapshot value, not the live rule, when the rule has been edited since the fire', () => {
    // Past fire applied "v1"; user has since edited the rule to "v2".
    // The row must still show "v1" because that's what hit the wire.
    const liveRule = headerRule(
      'r1',
      'X',
      [{ uid: 'thm00055', operation: 'override', headerName: 'X-Foo', value: 'v2' }],
      'response',
    ) as V5.HeaderRule;
    const snapshot = snapshotOf({
      ...liveRule,
      action: {
        requestHeaders: [],
        responseHeaders: [{ uid: 'thm00056', operation: 'override', headerName: 'X-Foo', value: 'v1' }],
      },
    } as V5.HeaderRule);
    const result = attributeHeaders(
      [{ name: 'X-Foo', value: 'server' }],
      [fireWithSnapshot(snapshot)],
      'response',
      byUid(liveRule),
    );
    expect(result[0].value).toBe('v1');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.ctx.edited).toBe(true);
      expect(result[0].attribution.ctx.snapshotMod.valueResolved).toBe('v1');
      expect(result[0].attribution.ctx.currentMod?.value).toBe('v2');
    }
  });

  it('marks edited=false when snapshot matches live rule', () => {
    const liveRule = headerRule(
      'r1',
      'X',
      [{ uid: 'thm00057', operation: 'override', headerName: 'X-Foo', value: 'v1' }],
      'response',
    ) as V5.HeaderRule;
    const snapshot = snapshotOf(liveRule);
    const result = attributeHeaders(
      [{ name: 'X-Foo', value: 'server' }],
      [fireWithSnapshot(snapshot)],
      'response',
      byUid(liveRule),
    );
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.ctx.edited).toBe(false);
    }
  });

  it('marks edited=true when the rule has been deleted since the fire', () => {
    const snapshot: RuleSnapshot = {
      ruleUid: 'r1',
      name: 'Deleted',
      type: 'header',
      enabled: true,
      headerMods: [
        { direction: 'response', operation: 'override', headerName: 'X-Foo', valueTemplate: 'v1', valueResolved: 'v1' },
      ],
    };
    const result = attributeHeaders(
      [{ name: 'X-Foo', value: 'server' }],
      [fireWithSnapshot(snapshot)],
      'response',
      byUid(),
    );
    expect(result[0].value).toBe('v1');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.ctx.currentRule).toBeNull();
      expect(result[0].attribution.ctx.currentMod).toBeNull();
      expect(result[0].attribution.ctx.edited).toBe(true);
      expect(result[0].attribution.ctx.ruleName).toBe('Deleted');
    }
  });

  it('uses valueResolved on the row but exposes valueTemplate in the snapshot for popover hint', () => {
    // Variable resolution is captured at fire time. Row sees the wire
    // value; popover can reconstruct the template the user wrote.
    const liveRule = headerRule(
      'r1',
      'X',
      [{ uid: 'thm00058', operation: 'override', headerName: 'X-Foo', value: '{{env.foo}}' }],
      'response',
    ) as V5.HeaderRule;
    const snapshot: RuleSnapshot = {
      ruleUid: 'r1',
      name: 'X',
      type: 'header',
      enabled: true,
      headerMods: [
        {
          direction: 'response',
          operation: 'override',
          headerName: 'X-Foo',
          valueTemplate: '{{env.foo}}',
          valueResolved: 'resolved-at-fire',
        },
      ],
    };
    const result = attributeHeaders(
      [{ name: 'X-Foo', value: 'server' }],
      [fireWithSnapshot(snapshot)],
      'response',
      byUid(liveRule),
    );
    expect(result[0].value).toBe('resolved-at-fire');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.ctx.snapshotMod.valueTemplate).toBe('{{env.foo}}');
      expect(result[0].attribution.ctx.snapshotMod.valueResolved).toBe('resolved-at-fire');
    }
  });

  it('falls back to live rule when the fire predates the snapshotter (legacy)', () => {
    // Fires emitted before the snapshotter wiring carry no
    // `ruleSnapshot`. The attributor synthesizes one from the live rule
    // so the row still renders — but never marks it edited (no
    // baseline to compare against).
    const rule = headerRule('r1', 'X', [{ uid: 'thm00059', operation: 'override', headerName: 'X-Foo', value: 'live' }], 'response');
    const result = attributeHeaders([{ name: 'X-Foo', value: 'server' }], [fire('r1')], 'response', byUid(rule));
    expect(result[0].value).toBe('live');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.ctx.edited).toBe(false);
    }
  });

  it('matches a templated header-name snapshot to its HAR row using the resolved name', () => {
    // Live rule's header-name field is `X-{{env.suffix}}`; the SW
    // resolved it to `X-Debug` at fire time. The snapshot stores the
    // *resolved* name as `headerName` (so attribution can match the
    // HAR row) and the raw template separately as `headerNameTemplate`.
    const liveRule: V5.Rule = {
      ...(headerRule(
        'r1',
        'Tpl name',
        [{ uid: 'thm00060', operation: 'override', headerName: 'X-{{env.suffix}}', value: 'v' }],
        'request',
      ) as object),
    } as V5.Rule;
    const snapshot: RuleSnapshot = {
      ruleUid: 'r1',
      name: 'Tpl name',
      type: 'header',
      enabled: true,
      headerMods: [
        {
          direction: 'request',
          operation: 'override',
          headerName: 'X-Debug',
          headerNameTemplate: 'X-{{env.suffix}}',
          valueTemplate: 'v',
          valueResolved: 'v',
        },
      ],
    };
    const result = attributeHeaders(
      [{ name: 'X-Debug', value: 'server' }],
      [fireWithSnapshot(snapshot)],
      'request',
      byUid(liveRule),
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('X-Debug');
    expect(result[0].value).toBe('v');
    expect(result[0].attribution.kind).toBe('modified');
    if (result[0].attribution.kind === 'modified') {
      expect(result[0].attribution.ctx.edited).toBe(false);
      expect(result[0].attribution.ctx.snapshotMod.headerName).toBe('X-Debug');
      expect(result[0].attribution.ctx.snapshotMod.headerNameTemplate).toBe('X-{{env.suffix}}');
      expect(result[0].attribution.ctx.currentMod?.headerName).toBe('X-{{env.suffix}}');
    }
  });

  it('positionally matches multi-append snapshot mods to live mods of same name', () => {
    // Two `add Set-Cookie` mods on the same rule. Each snapshot mod must
    // map to its own live counterpart by position so editing one doesn't
    // shadow the other in the popover.
    const rule = headerRule(
      'r1',
      'Multi',
      [
        { uid: 'thm00061', operation: 'add', headerName: 'Set-Cookie', value: 'a=1' },
        { uid: 'thm00062', operation: 'add', headerName: 'Set-Cookie', value: 'b=2' },
      ],
      'response',
    ) as V5.HeaderRule;
    const snapshot = snapshotOf(rule);
    const result = attributeHeaders([], [fireWithSnapshot(snapshot)], 'response', byUid(rule));
    expect(result).toHaveLength(2);
    if (result[0].attribution.kind === 'added' && result[1].attribution.kind === 'added') {
      expect(result[0].attribution.ctx.currentMod?.value).toBe('a=1');
      expect(result[1].attribution.ctx.currentMod?.value).toBe('b=2');
    }
  });

  it('applies only the direction asked for — a request-header rule does not touch response headers', () => {
    const rule = headerRule(
      'r1',
      'Auth',
      [{ uid: 'thm00063', operation: 'override', headerName: 'Authorization', value: 'Bearer X' }],
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
