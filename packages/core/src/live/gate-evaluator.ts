/**
 * Pure gate evaluator for Live Workflow step gates (Phase I).
 *
 * A `StepGate` is an AND-of-clauses predicate over prior-step captures
 * and statuses. The evaluator returns:
 *
 *   - `true`  — gate passes, step is eligible to run
 *   - `false` — gate fails, step is skipped (no cache write)
 *
 * Absent captures / statuses (from a skipped ancestor step) make every
 * clause evaluate to false by construction; the skip cascades naturally
 * downstream via `capture-exists` / `capture-equals` / status clauses.
 *
 * Invalid regex patterns (`capture-matches`) and overflow inputs are
 * treated as clause-false — the evaluator prefers "skip cleanly" over
 * "abort the run" for degraded gate metadata. The validator is the
 * right layer for rejecting bad patterns at save time.
 */

import type { StatusMatch, StepGate, StepGateClause } from '../types/live';

// ── Public API ────────────────────────────────────────────────────

/**
 * Evaluate a gate against the run's completed-step state. Returns
 * `true` iff every clause matches. Empty gate (`all: []`) → `true`
 * (equivalent to no gate).
 */
export function evaluateGate(
  gate: StepGate,
  captures: ReadonlyMap<string, ReadonlyMap<string, string>>,
  statuses: ReadonlyMap<string, number>,
): boolean {
  for (const clause of gate.all) {
    if (!evaluateClause(clause, captures, statuses)) return false;
  }
  return true;
}

/**
 * Evaluate a single clause. Exposed for tests + for the editor's
 * per-clause validation preview.
 */
export function evaluateClause(
  clause: StepGateClause,
  captures: ReadonlyMap<string, ReadonlyMap<string, string>>,
  statuses: ReadonlyMap<string, number>,
): boolean {
  switch (clause.kind) {
    case 'status': {
      const status = statuses.get(clause.stepId);
      if (status === undefined) return false; // step was skipped or didn't run
      return matchStatus(status, clause.match);
    }
    case 'capture-exists': {
      const stepCaps = captures.get(clause.stepId);
      if (!stepCaps) return false;
      return stepCaps.has(clause.captureName);
    }
    case 'capture-equals': {
      const value = captures.get(clause.stepId)?.get(clause.captureName);
      return value === clause.value;
    }
    case 'capture-matches': {
      const value = captures.get(clause.stepId)?.get(clause.captureName);
      if (value === undefined) return false;
      const regex = safeCompileRegex(clause.pattern);
      if (!regex) return false;
      return regex.test(value);
    }
  }
}

// ── Status matching ───────────────────────────────────────────────

/**
 * Match a concrete numeric status against a `StatusMatch` expression.
 * Exposed so the editor's per-clause preview can reuse the same logic
 * against a hypothetical status from the user's pre-flight test run.
 */
export function matchStatus(status: number, match: StatusMatch): boolean {
  if (typeof match === 'string') {
    // Class literal: '2xx' / '3xx' / '4xx' / '5xx'.
    const leadingDigit = status >= 100 && status < 600 ? Math.floor(status / 100) : -1;
    switch (match) {
      case '2xx':
        return leadingDigit === 2;
      case '3xx':
        return leadingDigit === 3;
      case '4xx':
        return leadingDigit === 4;
      case '5xx':
        return leadingDigit === 5;
    }
  }
  // Tuple form: ['eq', N] | ['ne', N] | ['in', N[]]
  const [op, arg] = match;
  switch (op) {
    case 'eq':
      return status === arg;
    case 'ne':
      return status !== arg;
    case 'in':
      return (arg as readonly number[]).includes(status);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Compile a regex pattern, returning `null` on any SyntaxError. The
 * runner treats an invalid pattern as "gate fails" — skipping is
 * preferable to aborting the whole chain over a stray pattern. The
 * editor's save-time validator is where users get told the pattern is
 * broken; runtime is defensive.
 */
function safeCompileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}
