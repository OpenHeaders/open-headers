/**
 * Pure priority evaluator for Live Workflow step ordering (Phase I).
 *
 * When multiple steps are eligible to run at the same time (their
 * `dependsOn` set is complete AND their `runIf` gate passed), the
 * runner sorts them by the value of a capture from an ancestor step.
 * Lower values run first.
 *
 * Degradation policy — both tiers are explicit non-errors:
 *
 *   - Missing capture (ancestor was skipped, or the extractor didn't
 *     produce the field) → `+Infinity` equivalent → step runs last
 *     in the eligible set.
 *   - Non-parseable numeric under `numeric` sort mode → fall back to
 *     lexicographic comparison of the raw string.
 *
 * The runner also applies declared-list position as a deterministic
 * tiebreak AFTER priority; that belongs in the runner's ordering helper,
 * not here.
 */

import type { WorkflowStep } from '../types/live';

/** Sentinel for "run last" in comparator chains. */
export const PRIORITY_LAST = Number.POSITIVE_INFINITY;

export type PriorityValue = number | string;

/**
 * Resolve the priority value for a step against the current captures.
 *
 *   - Step has no `priorityFrom` → `+Infinity` (no-ordering-signal;
 *     declared order breaks ties).
 *   - `priorityFrom` target is absent → `+Infinity`.
 *   - `sort: 'lexicographic'` → return the raw string.
 *   - `sort: 'numeric'` (default) → parse via `parseFloat`; if NaN,
 *     fall back to the raw string for lexicographic comparison.
 */
export function priorityValue(
  step: WorkflowStep,
  captures: ReadonlyMap<string, ReadonlyMap<string, string>>,
): PriorityValue {
  const ref = step.priorityFrom;
  if (!ref) return PRIORITY_LAST;

  const raw = captures.get(ref.stepId)?.get(ref.captureName);
  if (raw === undefined) return PRIORITY_LAST;

  const sort = ref.sort ?? 'numeric';
  if (sort === 'lexicographic') return raw;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return raw; // fall back to lexicographic on non-numeric
  return parsed;
}

/**
 * Comparator compatible with `Array.prototype.sort`. Primary key is the
 * priority value (numbers sort ascending; strings sort lexicographically;
 * missing → last). Secondary key is the caller-supplied declared-index
 * tiebreak — two eligible steps with the same priority keep the
 * declared order, which is what users see in the editor.
 *
 * Numbers and strings never compare against each other across steps:
 * in a well-formed workflow every `priorityFrom` capture is the same
 * source, so sort modes agree step-to-step. The defensive fallback
 * (number vs string) treats the string as "later" so mixed-state
 * ready-sets stay deterministic.
 */
export function comparePriority(
  a: { value: PriorityValue; declaredIndex: number },
  b: { value: PriorityValue; declaredIndex: number },
): number {
  const av = a.value;
  const bv = b.value;

  if (typeof av === 'number' && typeof bv === 'number') {
    if (av < bv) return -1;
    if (av > bv) return 1;
    return a.declaredIndex - b.declaredIndex;
  }
  if (typeof av === 'string' && typeof bv === 'string') {
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    if (cmp !== 0) return cmp;
    return a.declaredIndex - b.declaredIndex;
  }
  // Mixed: number beats string (number = "has a real priority",
  // string = "fell back via non-numeric parse or lexicographic mode"
  // — ties to back).
  return typeof av === 'number' ? -1 : 1;
}
