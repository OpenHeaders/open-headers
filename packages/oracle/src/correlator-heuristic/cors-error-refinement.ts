/**
 * Pure pre-emit refinement of `phase` updates' `error.code` using the
 * CORS verdict (H6).
 *
 * When the patch carries `error.code === 'net::ERR_FAILED'` AND the
 * verdict indicates a cross-origin rejection, rewrite the code to a
 * more specific `oh:cors-missing-acao` or `oh:cors-origin-mismatch`.
 * The `reason` field is preserved as the original net-stack token so
 * the UI can still surface it for diagnostics.
 *
 * The verdict itself does NOT travel on the patch — it stays inside
 * the correlator (engine-internal facet per design §9). The refined
 * `error.code` IS observable to every downstream consumer; that's the
 * load-bearing signal.
 *
 * Non-`net::ERR_FAILED` errors and same-origin / no-rejection verdicts
 * pass through untouched. Returns a new readonly update — never mutates
 * the input.
 */

import type { RequestError, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import type { CorsVerdict } from './cors-types';

/**
 * Apply CORS-driven refinements to a single update. The correlator
 * calls this on every `phase` update post-mapper, pre-emit. Updates
 * with other `kind`s (`started`, `redirect`, `har-attached`,
 * `body-attached`, `gone`) carry no CORS-influenced fields and are
 * returned as-is.
 */
export function refineUpdateWithCors(
  update: RequestLifecycleUpdate,
  verdict: CorsVerdict | undefined,
): RequestLifecycleUpdate {
  if (verdict === undefined) return update;
  if (update.kind !== 'phase') return update;
  if (update.patch.error === undefined) return update;
  const refinedError = refineError(update.patch.error, verdict);
  if (refinedError === undefined) return update;
  return {
    ...update,
    patch: {
      ...update.patch,
      error: refinedError,
    },
  };
}

/**
 * Refine a `net::ERR_FAILED` error code using the verdict; pass through
 * unchanged when the error is more specific than the catch-all or when
 * the verdict carries no rejection.
 */
function refineError(error: RequestError, verdict: CorsVerdict): RequestError | undefined {
  if (error.code !== 'net::ERR_FAILED') return undefined;
  if (!verdict.isCrossOrigin) return undefined;
  const r = verdict.rejection;
  if (r.kind === 'missing-acao') {
    return { code: 'oh:cors-missing-acao', reason: error.reason };
  }
  if (r.kind === 'origin-mismatch') {
    return { code: 'oh:cors-origin-mismatch', reason: error.reason };
  }
  return undefined;
}
