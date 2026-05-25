/**
 * `refineUpdateWithCors` — pure pre-emit augmentation of phase updates
 * with a CORS verdict.
 */

import { describe, expect, it } from 'vitest';

import type {
  CorsVerdict,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';

import { refineUpdateWithCors } from '../../src/correlator-heuristic/cors-error-refinement';

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
});

describe('refineUpdateWithCors — cors stamping', () => {
  it('stamps cors on a headers-received patch', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({ phase: 'headers-received', statusCode: 200 }),
      missingAcao,
    );
    expect(refined.kind).toBe('phase');
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.cors).toEqual(missingAcao);
    expect(refined.patch.phase).toBe('headers-received');
    expect(refined.patch.statusCode).toBe(200);
  });

  it('stamps cors on a completed patch and leaves error untouched', () => {
    const refined = refineUpdateWithCors(
      phaseUpdate({ phase: 'completed', statusCode: 200, completedAtMs: 1 }),
      sameOrigin,
    );
    if (refined.kind !== 'phase') throw new Error('expected phase');
    expect(refined.patch.cors).toEqual(sameOrigin);
    expect(refined.patch.error).toBeUndefined();
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
    expect(refined.patch.cors).toEqual(missingAcao);
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
    expect(original.patch.cors).toBeUndefined();
  });
});
