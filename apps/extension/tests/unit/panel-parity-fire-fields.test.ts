/**
 * `parityFireFields` — the fire-evidence plane of the parity dump.
 *
 * The probe script (playground/scripts/probe-fire-evidence.mjs) joins
 * these fields against backend-observed truth, so the projection must
 * carry: raw evidence inputs (authoritative / evidence) separate from
 * the derived tier, per-mod verdicts, the capture-point stamps as the
 * verdicts read them, and only marker-named headers.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, InspectorHarHeaderCapture, RuleSnapshotHeaderMod } from '@openheaders/core/types';
import { parityFireFields } from '@openheaders/ui/panel/data/parity-debug-hook';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

interface LifecycleOpts {
  requestHeaders?: Array<{ name: string; value: string }>;
  responseHeaders?: Array<{ name: string; value: string }>;
  capture?: InspectorHarHeaderCapture;
  noHar?: boolean;
}

function makeLifecycle(opts: LifecycleOpts = {}): RequestLifecycle {
  const url = 'https://app.openheaders.io/api/secure/echo';
  const har: InspectorHarEntry | null = opts.noHar
    ? null
    : {
        startedDateTime: '2026-06-10T00:00:00.000Z',
        request: { method: 'GET', url, headers: opts.requestHeaders ?? [], queryString: [] },
        response: {
          status: 200,
          statusText: 'OK',
          headers: opts.responseHeaders ?? [],
          content: { size: 0, mimeType: 'application/json' },
        },
        ...(opts.capture !== undefined ? { _ohHeaderCapture: opts.capture } : {}),
      };
  return {
    tabId: 1,
    requestId: 'req-1',
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    statusCode: 200,
    statusText: 'OK',
    har: [har],
    harBodyByHop: [],
  };
}

const EFFECTIVE: InspectorHarHeaderCapture = { request: 'effective', response: 'effective' };
const RAW: InspectorHarHeaderCapture = { request: 'raw', response: 'raw' };

function mod(overrides: Partial<RuleSnapshotHeaderMod> = {}): RuleSnapshotHeaderMod {
  return {
    direction: 'request',
    operation: 'override',
    headerName: 'Authorization',
    valueTemplate: 'Bearer t',
    valueResolved: 'Bearer t',
    ...overrides,
  };
}

function fire(mods: RuleSnapshotHeaderMod[], overrides: Partial<InspectorFire> = {}): InspectorFire {
  return {
    ruleUid: 'rule-a',
    t: 0,
    pattern: '*://app.openheaders.io/*',
    authoritative: false,
    evidence: 'matched',
    requestId: 'req-1',
    ruleSnapshot: { ruleUid: 'rule-a', name: 'Bearer rule', type: 'header', enabled: true, headerMods: mods },
    ...overrides,
  };
}

describe('parityFireFields — capture stamps + marker headers (fire-free rows)', () => {
  it('reports the capture point per direction as the verdicts read it', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE });
    const fields = parityFireFields(lc, []);
    expect(fields._headerCapture).toEqual({ request: 'effective', response: 'effective' });
    expect(fields._fires).toBeUndefined();
    expect(fields._rowFireTier).toBeUndefined();
  });

  it('a missing stamp reads raw; a missing HAR reads null', () => {
    expect(parityFireFields(makeLifecycle(), [])._headerCapture).toEqual({ request: 'raw', response: 'raw' });
    expect(parityFireFields(makeLifecycle({ noHar: true }), [])._headerCapture).toEqual({
      request: null,
      response: null,
    });
  });

  it('keeps only marker-named headers (Authorization, X-OH-*, X-Forwarded-For, Vary)', () => {
    const lc = makeLifecycle({
      capture: EFFECTIVE,
      requestHeaders: [
        { name: 'Authorization', value: 'Bearer t' },
        { name: 'Accept', value: '*/*' },
        { name: 'X-Forwarded-For', value: '203.0.113.7' },
        { name: 'x-oh-merge', value: 'base, extra' },
      ],
      responseHeaders: [
        { name: 'Vary', value: 'X-OH-Added' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'X-OH-Resp', value: 'modified' },
      ],
    });
    const fields = parityFireFields(lc, []);
    expect(fields._markerHeaders?.request.map((h) => h.name)).toEqual([
      'Authorization',
      'X-Forwarded-For',
      'x-oh-merge',
    ]);
    expect(fields._markerHeaders?.response.map((h) => h.name)).toEqual(['Vary', 'X-OH-Resp']);
  });
});

describe('parityFireFields — fires and verdicts', () => {
  it('corroborated claim: tier applied, verdict + per-mod reason exposed', () => {
    const lc = makeLifecycle({
      capture: EFFECTIVE,
      requestHeaders: [{ name: 'Authorization', value: 'Bearer t' }],
    });
    const fields = parityFireFields(lc, [fire([mod()])]);
    expect(fields._fires).toEqual([
      {
        ruleUid: 'rule-a',
        authoritative: false,
        evidence: 'matched',
        requestId: 'req-1',
        tier: 'applied',
        verdict: 'corroborated',
      },
    ]);
    expect(fields._rowFireTier).toBe('applied');
    expect(fields._modEvidence).toEqual([
      {
        ruleUid: 'rule-a',
        direction: 'request',
        operation: 'override',
        headerName: 'Authorization',
        verdict: 'corroborated',
        reason: 'value-on-wire',
        observed: ['Bearer t'],
      },
    ]);
  });

  it('keeps the raw evidence inputs separate from the derived tier (unpacked-install probe)', () => {
    const lc = makeLifecycle({ capture: RAW, requestHeaders: [{ name: 'Accept', value: '*/*' }] });
    const fields = parityFireFields(lc, [fire([mod()], { authoritative: true })]);
    // Authoritative makes the dot blue, but the wire verdict stays its own signal.
    expect(fields._fires?.[0]).toMatchObject({ authoritative: true, tier: 'applied', verdict: 'unobservable' });
    expect(fields._modEvidence?.[0]).toMatchObject({ verdict: 'unobservable', reason: 'raw-capture' });
  });

  it('contradicted claim outranks: row tier contradicted', () => {
    const lc = makeLifecycle({
      capture: EFFECTIVE,
      requestHeaders: [{ name: 'Authorization', value: 'Bearer something-else' }],
    });
    const fields = parityFireFields(lc, [fire([mod()])]);
    expect(fields._fires?.[0]).toMatchObject({ tier: 'contradicted', verdict: 'contradicted' });
    expect(fields._rowFireTier).toBe('contradicted');
    expect(fields._modEvidence?.[0]).toMatchObject({ verdict: 'contradicted', reason: 'value-mismatch' });
  });

  it('non-header fires carry no checkable claim — fires listed, no mod evidence', () => {
    const lc = makeLifecycle({ capture: EFFECTIVE });
    const blockFire: InspectorFire = {
      ruleUid: 'rule-b',
      t: 0,
      pattern: '*',
      authoritative: false,
      evidence: 'matched',
      requestId: 'req-1',
    };
    const fields = parityFireFields(lc, [blockFire]);
    expect(fields._fires).toHaveLength(1);
    expect(fields._fires?.[0]).toMatchObject({ verdict: 'unobservable', tier: 'inferred' });
    expect(fields._modEvidence).toEqual([]);
  });
});
