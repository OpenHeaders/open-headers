/**
 * Invariant scaffolding tests.
 *
 * Each `describe` names the invariant it backs (1, 3, 4, 5, 6). The
 * store and correlator are not implemented yet — these tests cover the
 * pure predicates the rest of the work will compose against, so a
 * regression in the primitive is caught before the engine code lands.
 *
 * Invariants 2 (tab scope), 7 (single webRequest subscriber), and 8
 * (totally-ordered output) are properties of higher layers (store /
 * extension integration / correlator buffer) and are asserted in their
 * own test files when those layers exist.
 */

import { describe, expect, it } from 'vitest';
import {
  isPhaseAdvance,
  isRedirectReset,
  isTerminalPhase,
  lifecycleKey,
  patchRefines,
  refinesField,
  urlChain,
} from '../../src/request-lifecycle/invariants';
import type {
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestPhase,
} from '../../src/request-lifecycle/types';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/v1/items',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    har: new Map(),
    harBodyByHop: new Map(),
    ...overrides,
  };
}

describe('invariant 1 — identity is (tabId, requestId)', () => {
  it('keys equal tuples to the same string', () => {
    expect(lifecycleKey(7, 'r-42')).toBe(lifecycleKey(7, 'r-42'));
  });

  it('distinguishes by tabId', () => {
    expect(lifecycleKey(1, 'r-1')).not.toBe(lifecycleKey(2, 'r-1'));
  });

  it('distinguishes by requestId', () => {
    expect(lifecycleKey(1, 'r-1')).not.toBe(lifecycleKey(1, 'r-2'));
  });
});

describe('invariant 3 — monotonic steady-phase advance', () => {
  const phases: RequestPhase[] = ['pending', 'headers-received', 'completed', 'failed'];

  it('accepts same-phase no-ops', () => {
    for (const p of phases) {
      expect(isPhaseAdvance(p, p)).toBe(true);
    }
  });

  it('accepts forward transitions in the steady machine', () => {
    expect(isPhaseAdvance('pending', 'headers-received')).toBe(true);
    expect(isPhaseAdvance('pending', 'completed')).toBe(true);
    expect(isPhaseAdvance('pending', 'failed')).toBe(true);
    expect(isPhaseAdvance('headers-received', 'completed')).toBe(true);
    expect(isPhaseAdvance('headers-received', 'failed')).toBe(true);
  });

  it('rejects backward transitions', () => {
    expect(isPhaseAdvance('headers-received', 'pending')).toBe(false);
    expect(isPhaseAdvance('completed', 'pending')).toBe(false);
    expect(isPhaseAdvance('failed', 'pending')).toBe(false);
    expect(isPhaseAdvance('completed', 'headers-received')).toBe(false);
    expect(isPhaseAdvance('failed', 'headers-received')).toBe(false);
  });

  it('rejects terminal-to-terminal swaps (once resolved, the outcome is fixed)', () => {
    expect(isPhaseAdvance('completed', 'failed')).toBe(false);
    expect(isPhaseAdvance('failed', 'completed')).toBe(false);
  });

  it('flags terminal phases for the redirect-reset guard', () => {
    expect(isTerminalPhase('pending')).toBe(false);
    expect(isTerminalPhase('headers-received')).toBe(false);
    expect(isTerminalPhase('completed')).toBe(true);
    expect(isTerminalPhase('failed')).toBe(true);
  });
});

describe('invariant 4 — one lifecycle per request including redirects', () => {
  it('projects a single-URL chain when there are no redirects', () => {
    const l = makeLifecycle({ url: 'https://api.openheaders.io/a' });
    expect(urlChain(l)).toEqual(['https://api.openheaders.io/a']);
  });

  it('projects [sourceUrl0, sourceUrl1, …, current] across hops', () => {
    const l = makeLifecycle({
      url: 'https://api.openheaders.io/c',
      redirectHopCount: 2,
      redirectHops: [
        {
          sourceUrl: 'https://api.openheaders.io/a',
          redirectUrl: 'https://api.openheaders.io/b',
          statusCode: 302,
          timestampMs: 1000,
        },
        {
          sourceUrl: 'https://api.openheaders.io/b',
          redirectUrl: 'https://api.openheaders.io/c',
          statusCode: 302,
          timestampMs: 1010,
        },
      ],
    });
    expect(urlChain(l)).toEqual([
      'https://api.openheaders.io/a',
      'https://api.openheaders.io/b',
      'https://api.openheaders.io/c',
    ]);
  });
});

describe('invariant 5 — monotonic information content (fields refine, never disappear)', () => {
  it('refinesField: undefined → anything is a refinement', () => {
    expect(refinesField(undefined, undefined)).toBe(true);
    expect(refinesField(undefined, 200)).toBe(true);
    expect(refinesField<string>(undefined, 'x')).toBe(true);
  });

  it('refinesField: set → set is a refinement (value MAY change — e.g. error code refinement)', () => {
    expect(refinesField('net::ERR_FAILED', 'oh:cors-missing-acao')).toBe(true);
    expect(refinesField(200, 200)).toBe(true);
  });

  it('refinesField: set → undefined is NOT a refinement (information disappeared)', () => {
    expect(refinesField(200, undefined)).toBe(false);
    expect(refinesField<string>('present', undefined)).toBe(false);
  });

  it('patchRefines: empty patch trivially refines', () => {
    const prev = makeLifecycle({ statusCode: 200 });
    expect(patchRefines(prev, {})).toBe(true);
  });

  it('patchRefines: refining a previously-unset field is allowed', () => {
    const prev = makeLifecycle();
    const patch: RequestLifecyclePatch = { statusCode: 200, phase: 'completed' };
    expect(patchRefines(prev, patch)).toBe(true);
  });

  it('patchRefines: changing an already-set value to a different defined value is allowed (refinement)', () => {
    const prev = makeLifecycle({ error: { code: 'net::ERR_FAILED', reason: 'failed' } });
    const patch: RequestLifecyclePatch = { error: { code: 'oh:cors-missing-acao', reason: 'missing ACAO' } };
    expect(patchRefines(prev, patch)).toBe(true);
  });

  it('patchRefines: explicitly setting a previously-defined field to undefined is rejected', () => {
    const prev = makeLifecycle({ statusCode: 200 });
    const patch = { statusCode: undefined } as unknown as RequestLifecyclePatch;
    expect(patchRefines(prev, patch)).toBe(false);
  });

  it('patchRefines: rejects unsetting the cors verdict once classified', () => {
    const prev = makeLifecycle({ cors: { isCrossOrigin: true, rejection: { kind: 'missing-acao' } } });
    const patch = { cors: undefined } as unknown as RequestLifecyclePatch;
    expect(patchRefines(prev, patch)).toBe(false);
  });
});

describe('invariant 6 — redirect is the only retrograde transition', () => {
  it('accepts a hop-count increment from pending', () => {
    expect(isRedirectReset('pending', 0, 1)).toBe(true);
  });

  it('accepts a hop-count increment from headers-received', () => {
    expect(isRedirectReset('headers-received', 1, 2)).toBe(true);
  });

  it('rejects redirects from terminal phases (Chrome cannot redirect a resolved request)', () => {
    expect(isRedirectReset('completed', 0, 1)).toBe(false);
    expect(isRedirectReset('failed', 0, 1)).toBe(false);
  });

  it('rejects multi-step hop-count jumps (one redirect = one increment)', () => {
    expect(isRedirectReset('pending', 0, 2)).toBe(false);
    expect(isRedirectReset('pending', 1, 3)).toBe(false);
  });

  it('rejects no-op or backward hop counts', () => {
    expect(isRedirectReset('pending', 1, 1)).toBe(false);
    expect(isRedirectReset('pending', 2, 1)).toBe(false);
  });
});
