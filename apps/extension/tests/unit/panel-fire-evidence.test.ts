/**
 * `fire-evidence` — wire-header corroboration of claimed rule mods.
 *
 * The suite mirrors the observability map: per capture point (effective /
 * raw / none) × direction × operation, each claim classifies as
 * corroborated, contradicted, or unobservable — never guessed.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, InspectorHarHeaderCapture, RuleSnapshotHeaderMod } from '@openheaders/core/types';
import {
  deriveFireEvidence,
  deriveFireEvidenceByRule,
  deriveModEvidence,
  fireTier,
  rowFireTier,
} from '@openheaders/ui/panel/data/fire-evidence';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

interface LifecycleOpts {
  requestHeaders?: Array<{ name: string; value: string }>;
  responseHeaders?: Array<{ name: string; value: string }>;
  capture?: InspectorHarHeaderCapture;
  /** Omit the HAR entry entirely (pre-response row). */
  noHar?: boolean;
  lifecycleRequestHeaders?: Array<{ name: string; value: string }>;
  requestHeadersProvisional?: boolean;
}

function makeLifecycle(opts: LifecycleOpts = {}): RequestLifecycle {
  const url = 'https://app.openheaders.io/';
  const har: InspectorHarEntry | null = opts.noHar
    ? null
    : {
        startedDateTime: '2026-06-10T00:00:00.000Z',
        request: { method: 'GET', url, headers: opts.requestHeaders ?? [], queryString: [] },
        response: {
          status: 200,
          statusText: 'OK',
          headers: opts.responseHeaders ?? [],
          content: { size: 0, mimeType: 'text/html' },
        },
        ...(opts.capture !== undefined ? { _ohHeaderCapture: opts.capture } : {}),
      };
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
    ...(opts.lifecycleRequestHeaders !== undefined ? { requestHeaders: opts.lifecycleRequestHeaders } : {}),
    ...(opts.requestHeadersProvisional !== undefined
      ? { requestHeadersProvisional: opts.requestHeadersProvisional }
      : {}),
  };
}

const EFFECTIVE: InspectorHarHeaderCapture = { request: 'effective', response: 'effective' };
const RAW: InspectorHarHeaderCapture = { request: 'raw', response: 'raw' };

function mod(overrides: Partial<RuleSnapshotHeaderMod> = {}): RuleSnapshotHeaderMod {
  return {
    direction: 'request',
    operation: 'override',
    headerName: 'X-OH-Test',
    valueTemplate: 'v1',
    valueResolved: 'v1',
    ...overrides,
  };
}

function snapshotFire(mods: RuleSnapshotHeaderMod[], overrides: Partial<InspectorFire> = {}): InspectorFire {
  return {
    ruleUid: 'r1',
    t: 0,
    pattern: '*://app.openheaders.io/*',
    authoritative: false,
    evidence: 'matched',
    ruleSnapshot: { ruleUid: 'r1', name: 'Test rule', type: 'header', enabled: true, headerMods: mods },
    ...overrides,
  };
}

describe('deriveModEvidence — capture gating', () => {
  it('no header set held for the direction → no-capture', () => {
    const lc = makeLifecycle({ noHar: true });
    expect(deriveModEvidence(lc, mod())).toMatchObject({ verdict: 'unobservable', reason: 'no-capture' });
  });

  it('raw capture (pre-rewrite sets) → raw-capture, even when the claim is absent', () => {
    const lc = makeLifecycle({ capture: RAW, requestHeaders: [{ name: 'Accept', value: '*/*' }] });
    expect(deriveModEvidence(lc, mod())).toMatchObject({ verdict: 'unobservable', reason: 'raw-capture' });
  });

  it('a HAR without a capture stamp is treated as raw (never contradicts)', () => {
    const lc = makeLifecycle({ requestHeaders: [{ name: 'Accept', value: '*/*' }] });
    expect(deriveModEvidence(lc, mod())).toMatchObject({ verdict: 'unobservable', reason: 'raw-capture' });
  });

  it('the lifecycle request headers stand in pre-HAR — effective once non-provisional', () => {
    const wire = makeLifecycle({
      noHar: true,
      lifecycleRequestHeaders: [{ name: 'X-OH-Test', value: 'v1' }],
      requestHeadersProvisional: false,
    });
    expect(deriveModEvidence(wire, mod())).toMatchObject({ verdict: 'corroborated', reason: 'value-on-wire' });

    const cooked = makeLifecycle({
      noHar: true,
      lifecycleRequestHeaders: [{ name: 'X-OH-Test', value: 'v1' }],
      requestHeadersProvisional: true,
    });
    expect(deriveModEvidence(cooked, mod())).toMatchObject({ verdict: 'unobservable', reason: 'raw-capture' });
  });
});

describe('deriveModEvidence — override / add on an effective capture', () => {
  it('claimed value present (case-insensitive name) → corroborated', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'x-oh-test', value: 'v1' }] });
    expect(deriveModEvidence(lc, mod())).toMatchObject({
      verdict: 'corroborated',
      reason: 'value-on-wire',
      observed: ['v1'],
    });
  });

  it('name present with a different value → contradicted with the observed values', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-OH-Test', value: 'other' }] });
    expect(deriveModEvidence(lc, mod())).toMatchObject({
      verdict: 'contradicted',
      reason: 'value-mismatch',
      observed: ['other'],
    });
  });

  it('name absent → contradicted (absent-from-wire)', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'Accept', value: '*/*' }] });
    expect(deriveModEvidence(lc, mod())).toMatchObject({ verdict: 'contradicted', reason: 'absent-from-wire' });
  });

  it('an append folded into a comma-combined list header still corroborates', () => {
    const lc = makeLifecycle({
      capture: EFFECTIVE,
      responseHeaders: [{ name: 'Vary', value: 'Accept-Encoding, X-OH-Var' }],
    });
    const m = mod({ direction: 'response', operation: 'add', headerName: 'Vary', valueResolved: 'X-OH-Var' });
    expect(deriveModEvidence(lc, m)).toMatchObject({ verdict: 'corroborated', reason: 'value-on-wire' });
  });

  it('a claim that never resolved cannot be checked', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-OH-Test', value: 'v1' }] });
    expect(deriveModEvidence(lc, mod({ valueResolved: undefined }))).toMatchObject({
      verdict: 'unobservable',
      reason: 'unresolved-claim',
    });
    expect(deriveModEvidence(lc, mod({ headerName: 'X-{{env.x}}' }))).toMatchObject({
      verdict: 'unobservable',
      reason: 'unresolved-claim',
    });
  });
});

describe('deriveModEvidence — remove (falsifiable only)', () => {
  it('the removed name still present → contradicted', () => {
    const lc = makeLifecycle({
      capture: EFFECTIVE,
      responseHeaders: [{ name: 'Content-Security-Policy', value: "default-src 'self'" }],
    });
    const m = mod({ direction: 'response', operation: 'remove', headerName: 'Content-Security-Policy' });
    expect(deriveModEvidence(lc, m)).toMatchObject({ verdict: 'contradicted', reason: 'present-despite-remove' });
  });

  it('the removed name absent → unobservable (absence is weak evidence)', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, responseHeaders: [{ name: 'Content-Type', value: 'text/html' }] });
    const m = mod({ direction: 'response', operation: 'remove', headerName: 'Content-Security-Policy' });
    expect(deriveModEvidence(lc, m)).toMatchObject({ verdict: 'unobservable', reason: 'absent-after-remove' });
  });
});

describe('deriveModEvidence — merge', () => {
  const merged = mod({ operation: 'merge', headerName: 'X-Trace', valueResolved: 'oh', mergeSeparator: ', ' });

  it('base + separator + claim on the wire → corroborated', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-Trace', value: 'base, oh' }] });
    expect(deriveModEvidence(lc, merged)).toMatchObject({ verdict: 'corroborated', reason: 'merge-on-wire' });
  });

  it('the claim alone on the wire (no base value existed) → corroborated', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-Trace', value: 'oh' }] });
    expect(deriveModEvidence(lc, merged)).toMatchObject({ verdict: 'corroborated', reason: 'merge-on-wire' });
  });

  it('name present without the merged suffix → contradicted', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-Trace', value: 'base' }] });
    expect(deriveModEvidence(lc, merged)).toMatchObject({ verdict: 'contradicted', reason: 'value-mismatch' });
  });

  it('a response merge is invisible to every capture plane', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, responseHeaders: [{ name: 'X-Trace', value: 'base, oh' }] });
    const m = mod({ direction: 'response', operation: 'merge', headerName: 'X-Trace', valueResolved: 'oh' });
    expect(deriveModEvidence(lc, m)).toMatchObject({ verdict: 'unobservable', reason: 'invisible-to-capture' });
  });
});

describe('deriveFireEvidence — aggregation', () => {
  it('any contradicted mod makes the fire contradicted', () => {
    const lc = makeLifecycle({
      capture: EFFECTIVE,
      requestHeaders: [
        { name: 'X-OH-Test', value: 'v1' },
        { name: 'X-Other', value: 'wrong' },
      ],
    });
    const fire = snapshotFire([mod(), mod({ headerName: 'X-Other', valueResolved: 'right' })]);
    expect(deriveFireEvidence(lc, fire).verdict).toBe('contradicted');
  });

  it('corroborated beats unobservable; unobservable stands alone', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-OH-Test', value: 'v1' }] });
    const fire = snapshotFire([
      mod(),
      mod({ direction: 'response', operation: 'merge', headerName: 'X-Trace', valueResolved: 'oh' }),
    ]);
    expect(deriveFireEvidence(lc, fire).verdict).toBe('corroborated');

    const rawLc = makeLifecycle({ capture: RAW, requestHeaders: [] });
    expect(deriveFireEvidence(rawLc, fire).verdict).toBe('unobservable');
  });

  it('a non-header fire (or one without a snapshot) carries no checkable claim', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE });
    const noSnapshot = snapshotFire([]);
    expect(deriveFireEvidence(lc, { ...noSnapshot, ruleSnapshot: undefined })).toEqual({
      verdict: 'unobservable',
      mods: [],
    });
  });
});

describe('fireTier / rowFireTier — dot semantics', () => {
  const corroboratedLc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-OH-Test', value: 'v1' }] });
  const contradictedLc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-OH-Test', value: 'nope' }] });
  const rawLc = makeLifecycle({ capture: RAW });

  it('wire corroboration reaches the applied tier without engine feedback', () => {
    expect(fireTier(corroboratedLc, snapshotFire([mod()]))).toBe('applied');
  });

  it('contradiction outranks even an authoritative fire', () => {
    expect(fireTier(contradictedLc, snapshotFire([mod()], { authoritative: true }))).toBe('contradicted');
  });

  it('authoritative / confirmed fires stay applied when the wire is silent', () => {
    expect(fireTier(rawLc, snapshotFire([mod()], { authoritative: true }))).toBe('applied');
    expect(fireTier(rawLc, snapshotFire([mod()], { evidence: 'confirmed' }))).toBe('applied');
  });

  it('an unverifiable match stays inferred', () => {
    expect(fireTier(rawLc, snapshotFire([mod()]))).toBe('inferred');
  });

  it('a captured response override upgrades a page-reported fire to applied', () => {
    const lc: RequestLifecycle = {
      ...rawLc,
      responseOverride: {
        ruleUid: 'r1',
        served: { body: { content: 'served', encoding: '' } },
        original: { body: { content: 'server', encoding: '' } },
      },
    };
    expect(fireTier(lc, snapshotFire([], { evidence: 'matched', authoritative: false }))).toBe('applied');
  });

  it('a captured request override upgrades by rule too', () => {
    const lc: RequestLifecycle = {
      ...rawLc,
      requestOverride: { ruleUid: 'r1', sent: { body: { content: 'sent', encoding: '' } } },
    };
    expect(fireTier(lc, snapshotFire([], { evidence: 'matched', authoritative: false }))).toBe('applied');
  });

  it('an override for a different rule does not upgrade the fire', () => {
    const lc: RequestLifecycle = {
      ...rawLc,
      responseOverride: { ruleUid: 'r2', served: { body: { content: 'served', encoding: '' } } },
    };
    expect(fireTier(lc, snapshotFire([], { evidence: 'matched', authoritative: false }))).toBe('inferred');
  });

  it('a stream message capture upgrades a page-reported fire to applied', () => {
    const lc: RequestLifecycle = {
      ...rawLc,
      messageCaptures: [
        {
          ruleUid: 'r1',
          direction: 'receive',
          op: 'replaced',
          eventName: 'message',
          original: '{"seq":2}',
          delivered: '{"replaced":true}',
          atMs: 1_000,
        },
      ],
    };
    expect(fireTier(lc, snapshotFire([], { evidence: 'matched', authoritative: false }))).toBe('applied');
  });

  it('a message capture for a different rule does not upgrade the fire', () => {
    const lc: RequestLifecycle = {
      ...rawLc,
      messageCaptures: [{ ruleUid: 'r2', direction: 'receive', op: 'dropped', original: 'x', atMs: 1_000 }],
    };
    expect(fireTier(lc, snapshotFire([], { evidence: 'matched', authoritative: false }))).toBe('inferred');
  });

  it('rowFireTier: contradicted > applied > inferred; null without fires', () => {
    expect(rowFireTier(rawLc, [])).toBeNull();
    expect(rowFireTier(rawLc, [snapshotFire([mod()])])).toBe('inferred');
    expect(rowFireTier(corroboratedLc, [snapshotFire([mod()]), snapshotFire([], { ruleUid: 'r2' })])).toBe('applied');
    expect(
      rowFireTier(contradictedLc, [
        snapshotFire([mod()], { authoritative: true }),
        snapshotFire([], { ruleUid: 'r2' }),
      ]),
    ).toBe('contradicted');
  });
});

describe('deriveFireEvidenceByRule', () => {
  it('keeps the first fire per rule, matching the attribution dedup', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE, requestHeaders: [{ name: 'X-OH-Test', value: 'v1' }] });
    const first = snapshotFire([mod()]);
    const dupe = snapshotFire([mod({ valueResolved: 'nope' })]);
    const map = deriveFireEvidenceByRule(lc, [first, dupe]);
    expect(map.size).toBe(1);
    expect(map.get('r1')?.verdict).toBe('corroborated');
  });
});
