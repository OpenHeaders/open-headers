/**
 * Pure tabId extraction over the two `RuleFireUpdate` variants. Sibling
 * of the lifecycle hub's `tabIdOf` — kept as its own function so future
 * variants stay an obvious one-line addition.
 */

import type { RuleFireUpdate } from '@openheaders/core/rule-fire-stream';

export function tabIdOf(update: RuleFireUpdate): number {
  return update.tabId;
}
