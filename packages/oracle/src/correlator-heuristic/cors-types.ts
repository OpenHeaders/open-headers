/**
 * Internal CORS classification produced by the heuristic correlator
 * before update emission. Engine-internal — not part of the shared
 * `RequestLifecycle` shape in `@openheaders/core/request-lifecycle`.
 *
 * The verdict drives one observable refinement: `net::ERR_FAILED` →
 * `oh:cors-missing-acao` / `oh:cors-origin-mismatch` on the lifecycle's
 * `error.code` field (see `cors-error-refinement.ts`). That refined
 * `error.code` IS observable to every downstream consumer; the verdict
 * itself stays inside the correlator, consistent with design §9
 * (parallel-indices facets: consumer-owned derived state lives next to
 * its consumer, not on the shared shape).
 */

export type CorsRejection =
  | { kind: 'no-rejection' }
  | { kind: 'missing-acao' }
  | { kind: 'origin-mismatch'; acao: string };

export interface CorsVerdict {
  isCrossOrigin: boolean;
  rejection: CorsRejection;
}
