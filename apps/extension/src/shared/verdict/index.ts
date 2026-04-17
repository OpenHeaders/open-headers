/**
 * Shared rule-verdict vocabulary — used by the background (to compute
 * verdicts via the engine) and the popup / devtools panel / workspace
 * (to render them via the UI metadata). The canonical `RuleVerdict`
 * type lives in `@/types/browser` and is re-exported here so a single
 * import covers type + engine + UI concerns.
 */

export type { RuleVerdict } from '@/types/browser';
export { computeVerdict, registrableDomainOf, type VerdictInput, type VerdictResult } from './engine';
export { VERDICT_COLOR, VERDICT_LABEL, VERDICT_RANK, VERDICT_TOOLTIP } from './ui';
