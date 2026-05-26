/**
 * `refineUpdateWithCors` — pure pre-emit refinement of phase updates'
 * `error.code` using the CORS verdict. The verdict itself is
 * engine-internal and does not travel on the patch.
 */

import { describe, expect, it } from 'vitest';

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import { refineUpdateWithCors } from '../../src/correlator-heuristic/cors-error-refinement';
import type { CorsVerdict } from '../../src/correlator-heuristic/cors-types';

const TAB = 4;
const REQ = 'wr-7';

function phaseUpdate(
  patch: Partial<Extract<RequestLifecycleUpdate, { kind: 'phase' }>['patch']> = {},
): RequestLifecycleUpdate {
  return { kind: 'phase', tabId: TAB, requestId: REQ, patch };
}

const sameOrigin: CorsVerdict = { isCrossOrigin: false, rejection: { kind: 'no-rejection' } };
const missingAcao: CorsVerdict = { isCrossOrigin: true, rejection: { kind: 'missing-acao' } };
const originMismatch: CorsVerdict = {
  isCrossOrigin: true,
  rejection: { kind: 'origin-mismatch', acao: 'https://x.openheaders.io' },
};
const crossOriginAllowed: CorsVerdict = {
  isCrossOrigin: true,
  rejection: { kind: 'no-rejection' },
};

describe('refineUpdateWithCors — passthroughs', () => {
  it('returns the update unchanged when verdict is undefined', () => {
    const u = phaseUpdate({ phase: 'completed' });
    expect(refineUpdateWithCors(u, undefined)).toBe(u);
  });

  it('returns non-phase updates unchanged even with a verdict', () => {
    const u: RequestLifecycleUpdate = { kind: 'gone', tabId: TAB, requestId: REQ };
    expect(refineUpdateWithCors(u, missingAcao)).toBe(u);
  });

  it('returns a phase update with no error unchanged', () => {
    const u = phaseUpdate({ phase: 'headers-received', statusCode: 200 });
    expect(refineUpdateWithCors(u, missingAcao)).toBe(u);
  });

  it('returns a completed phase update unchanged (no error to refine)', () => {
    const u = phaseUpdate({ phase: 'completed', statusCode: 200, completedAtMs: 1 });
    expect(refineUpdateWithCors(u, sameOrigin)).toBe(u);
  });
});

describe('refineUpdateWithCors — error code refinement', () => {
  it('net::ERR_FAILED + missing-acao → oh:cors-missing-acao (reason preserved)', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({
        phase: 'failed',
        completedAtMs: 1,
        error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
      }),
      missingAcao,
    );
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.error).toEqual({
      code: 'oh:cors-missing-acao',
      reason: 'net::ERR_FAILED',
    });
  });

  it('net::ERR_FAILED + origin-mismatch → oh:cors-origin-mismatch', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({
        phase: 'failed',
        completedAtMs: 1,
        error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
      }),
      originMismatch,
    );
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.error?.code).toBe('oh:cors-origin-mismatch');
  });

  it('net::ERR_FAILED + cross-origin-allowed leaves code untouched', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({
        phase: 'failed',
        completedAtMs: 1,
        error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
      }),
      crossOriginAllowed,
    );
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.error?.code).toBe('net::ERR_FAILED');
  });

  it('non-ERR_FAILED errors pass through untouched even with missing-acao', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({
        phase: 'failed',
        completedAtMs: 1,
        error: { code: 'net::ERR_CONNECTION_REFUSED', reason: 'net::ERR_CONNECTION_REFUSED' },
      }),
      missingAcao,
    );
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.error?.code).toBe('net::ERR_CONNECTION_REFUSED');
  });

  it('same-origin verdict never refines the error code', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({
        phase: 'failed',
        completedAtMs: 1,
        error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
      }),
      sameOrigin,
    );
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.error?.code).toBe('net::ERR_FAILED');
  });

  it('does not mutate the input update', () => {
    const original = phaseUpdate({
      phase: 'failed',
      completedAtMs: 1,
      error: { code: 'net::ERR_FAILED', reason: 'net::ERR_FAILED' },
    });
    const frozenError = original.kind === 'phase' ? original.patch.error : undefined;
    refineUpdateWithCors(original, missingAcao);
    if (original.kind !== 'phase') throw new Error('expected phase');
    expect(original.patch.error).toBe(frozenError);
  });
});
