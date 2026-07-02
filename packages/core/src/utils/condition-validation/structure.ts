import type { ConditionType, RuleCondition } from '../../types/rule';
import { CONDITION_META, getConditionSlotKey } from '../condition-metadata';

// ── Structural validation across the condition list ─────────────
//
// The per-value `validateDomainValues` above looks inside one row.
// `validateConditionStructure` looks at the SHAPE of the rows together.
// The model is "one row per DNR slot" (see `condition-metadata.ts`):
//
//   - duplicate-slot: two rows whose slot keys are equal. For most types
//     that means same type; for header types, same `(type, headerName)`
//     pair. Only the last row's value reaches Chrome — the duplicate is
//     dead weight.
//   - mutex-conflict: two rows of DIFFERENT types that share a slot key
//     via their mutex group (today only `url-filter` + `url-regex` share
//     the `'url-pattern'` slot). Same outcome as duplicate-slot but the
//     message tells the user to pick ONE rather than merge.
//   - unsupported-by-dnr: condition types Chrome MV3 DNR has no matching
//     field for. The compiler drops them silently; the validator
//     surfaces the issue so the user knows the row ships nothing.
//
// Same contract as the domain-value validator: pure, platform-agnostic,
// suitable for the editor (inline warnings) and the SW (compile-time
// observability log + future hard gates).

export type ConditionStructuralIssueKind = 'duplicate-slot' | 'mutex-conflict' | 'unsupported-by-dnr';

export interface ConditionStructuralIssue {
  /** Row index in the condition list. */
  index: number;
  /** Index of the row that "wins" — the one whose value reaches Chrome. */
  winningIndex: number;
  type: ConditionType;
  kind: ConditionStructuralIssueKind;
  /**
   * For `duplicate-slot` and `mutex-conflict`: the slot key the rows
   * share. For header types, the key includes the lowercased header name
   * (`'response-header::set-cookie'`). For `unsupported-by-dnr`:
   * `undefined`.
   */
  slotKey?: string;
  /** Human-readable explanation suitable for inline display. */
  message: string;
}

/**
 * Walk the condition list and report every structural issue.
 *
 * Slot-conflict semantics match the compiler's `buildDnrCondition`:
 * later rows overwrite earlier rows for any given slot, so the LAST row
 * of a conflicting slot is the winner; every earlier row of the same
 * slot is reported as the loser.
 */
export function validateConditionStructure(conditions: readonly RuleCondition[]): ConditionStructuralIssue[] {
  const issues: ConditionStructuralIssue[] = [];

  // Walk once to find the last CONTRIBUTING index per slot key — that's
  // the winner. Rows that haven't claimed a slot yet (empty values, or
  // header rows with no header name) cannot be winners or losers; they're
  // mid-edit states. Otherwise an empty second row would falsely flag
  // the prior real row as overwritten.
  const lastIndexBySlot = new Map<string, number>();
  for (let i = 0; i < conditions.length; i++) {
    if (!contributesToSlot(conditions[i])) continue;
    const key = getConditionSlotKey(conditions[i]);
    if (key) lastIndexBySlot.set(key, i);
  }

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const meta = CONDITION_META[cond.type];

    // 1. Unsupported by DNR — independent of slot identity and value
    // emptiness. The user authored the row; tell them it ships nothing.
    if (meta && !meta.supportedByDnr) {
      issues.push({
        index: i,
        winningIndex: i,
        type: cond.type,
        kind: 'unsupported-by-dnr',
        message:
          'This condition type is not supported by Chrome DNR yet — the rule still saves but this row ships nothing on the wire.',
      });
      continue;
    }

    // 2. Slot conflict — same slot key as a later row. Empty rows are
    // not contestants; they can never be the loser of a slot they didn't
    // try to claim.
    if (!contributesToSlot(cond)) continue;
    const key = getConditionSlotKey(cond);
    if (!key) continue;
    const winningIndex = lastIndexBySlot.get(key);
    if (winningIndex === undefined || winningIndex === i) continue;

    const winningType = conditions[winningIndex]?.type;
    const isSameType = winningType === cond.type;
    issues.push({
      index: i,
      winningIndex,
      type: cond.type,
      slotKey: key,
      kind: isSameType ? 'duplicate-slot' : 'mutex-conflict',
      message: isSameType
        ? `Only the last ${cond.type} row applies — this row's value won't reach Chrome. Remove this row, or move its values into the row that wins.`
        : `${cond.type} and ${winningType} share a DNR slot — only the last one applies. Pick one.`,
    });
  }

  return issues;
}

/**
 * Mirror the compiler's "skip empty values" behavior. A row with no
 * non-blank values doesn't write anything to its DNR slot. Header
 * conditions also need a non-empty `headerName` to claim a slot —
 * a row with values but no name has no identity to collide on.
 */
function contributesToSlot(cond: RuleCondition): boolean {
  if (CONDITION_META[cond.type]?.perHeader && !cond.headerName?.trim()) return false;
  return cond.values.some((v) => v.trim());
}
