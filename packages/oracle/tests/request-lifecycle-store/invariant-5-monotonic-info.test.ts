/**
 * T5 — invariant 5 (monotonic information content) as a fast-check
 * property over arbitrary phase-patch sequences.
 *
 * The predicate-level + single-shot reducer assertions live in:
 *   - `packages/core/tests/request-lifecycle/invariants.test.ts`
 *   - `./reducer.test.ts`
 *
 * This file is a separate property-style assertion: for ANY sequence of
 * additive phase patches the reducer accepts, every field that was ever
 * defined remains defined in the post-reduce state. Additionally, an
 * explicit-undefined patch on a previously-set field is always rejected
 * as `patch-disappearance`, and the rejection leaves prev untouched (the
 * reducer never mutates).
 *
 * Patches are drawn from a small, exhaustive value space — fast-check
 * shrinks counterexamples to the smallest patch that violates the
 * invariant.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type {
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestPhase,
} from '@openheaders/core/request-lifecycle';

import { reduce } from '../../src/request-lifecycle-store/reducer';
import { makeLifecycle } from './factories';

/**
 * Refining fields tracked for the invariant. `phase` is excluded — it
 * is monotonic via invariant 3 and never undefined; the property focuses
 * on the optional fields where "disappearance" is even expressible.
 */
const TRACKED_FIELDS = [
  'statusCode',
  'statusText',
  'fromCache',
  'error',
  'completedAtMs',
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

/** Generators for each field's value space; each pick lands a defined value. */
const arbStatusCode = fc.constantFrom(200, 201, 301, 400, 500);
const arbStatusText = fc.constantFrom('OK', 'Created', 'Moved Permanently', 'Bad Request');
const arbFromCache = fc.boolean();
const arbError = fc.constantFrom(
  { code: 'net::ERR_FAILED', reason: 'failed' },
  { code: 'net::ERR_CONNECTION_RESET', reason: 'reset' },
  { code: 'oh:cors-missing-acao', reason: 'missing ACAO' },
);
const arbCompletedAtMs = fc.integer({ min: 1_000, max: 10_000 });

/** Phase advances respect invariant 3 — generate only forward steps. */
function phaseAdvancesFrom(p: RequestPhase): readonly RequestPhase[] {
  switch (p) {
    case 'pending':
      return ['pending', 'headers-received', 'completed', 'failed'];
    case 'headers-received':
      return ['headers-received', 'completed', 'failed'];
    case 'completed':
      return ['completed'];
    case 'failed':
      return ['failed'];
  }
}

/**
 * One additive patch: a non-empty subset of fields each carrying a
 * defined value plus an optional valid phase step. Every value is a
 * refinement; no field is ever set to `undefined`.
 */
function arbAdditivePatch(prevPhase: RequestPhase): fc.Arbitrary<RequestLifecyclePatch> {
  return fc
    .record(
      {
        phase: fc.option(fc.constantFrom(...phaseAdvancesFrom(prevPhase)), { nil: undefined }),
        statusCode: fc.option(arbStatusCode, { nil: undefined }),
        statusText: fc.option(arbStatusText, { nil: undefined }),
        fromCache: fc.option(arbFromCache, { nil: undefined }),
        error: fc.option(arbError, { nil: undefined }),
        completedAtMs: fc.option(arbCompletedAtMs, { nil: undefined }),
      },
      { requiredKeys: [] },
    )
    .map((rec) => {
      const patch: RequestLifecyclePatch = {};
      if (rec.phase !== undefined) patch.phase = rec.phase;
      if (rec.statusCode !== undefined) patch.statusCode = rec.statusCode;
      if (rec.statusText !== undefined) patch.statusText = rec.statusText;
      if (rec.fromCache !== undefined) patch.fromCache = rec.fromCache;
      if (rec.error !== undefined) patch.error = rec.error;
      if (rec.completedAtMs !== undefined) patch.completedAtMs = rec.completedAtMs;
      return patch;
    });
}

function definedFields(state: RequestLifecycle): Set<TrackedField> {
  const out = new Set<TrackedField>();
  for (const f of TRACKED_FIELDS) if (state[f] !== undefined) out.add(f);
  return out;
}

describe('invariant 5 — monotonic information content (property)', () => {
  it('any sequence of additive phase patches keeps previously-set fields defined', () => {
    // Generator is parameterised against a `pending` baseline; the
    // walker adapts each patch's `phase` to a valid advance from the
    // current state so invariant-3 rejections do not occlude the
    // invariant-5 property under test.
    fc.assert(
      fc.property(fc.array(arbAdditivePatch('pending'), { minLength: 0, maxLength: 12 }), (patches) => {
        let state: RequestLifecycle = makeLifecycle({
          phase: 'pending',
          redirectHopCount: 0,
          redirectHops: [],
        });
        let setSoFar = new Set<TrackedField>();

        for (const basePatch of patches) {
          const adapted: RequestLifecyclePatch = { ...basePatch };
          if (adapted.phase !== undefined) {
            const allowed = phaseAdvancesFrom(state.phase);
            if (!allowed.includes(adapted.phase)) delete (adapted as { phase?: RequestPhase }).phase;
          }

          const result = reduce(state, {
            kind: 'phase',
            tabId: state.tabId,
            requestId: state.requestId,
            patch: adapted,
          });

          if (result.kind === 'update') {
            for (const f of setSoFar) {
              expect(result.next[f], `field "${f}" disappeared after additive patch`).toBeDefined();
            }
            state = result.next;
            setSoFar = definedFields(state);
          }
        }
      }),
      { numRuns: 96 },
    );
  });

  it('explicit-undefined on a previously-set field is rejected as patch-disappearance', () => {
    fc.assert(
      fc.property(fc.constantFrom<TrackedField>(...TRACKED_FIELDS), (field) => {
        const seed: Partial<RequestLifecycle> = {
          statusCode: 200,
          statusText: 'OK',
          fromCache: false,
          error: { code: 'net::ERR_FAILED', reason: 'failed' },
          completedAtMs: 2_000,
          phase: 'headers-received',
        };
        const state = makeLifecycle(seed);
        const patch = { [field]: undefined } as unknown as RequestLifecyclePatch;
        const result = reduce(state, {
          kind: 'phase',
          tabId: state.tabId,
          requestId: state.requestId,
          patch,
        });
        expect(result.kind).toBe('reject');
        if (result.kind !== 'reject') return;
        expect(result.reason).toBe('patch-disappearance');
        // Reducer is pure — prev untouched.
        expect(state[field]).toBeDefined();
      }),
      { numRuns: TRACKED_FIELDS.length * 4 },
    );
  });
});
