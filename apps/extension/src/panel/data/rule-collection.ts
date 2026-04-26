import type { V5 } from '@openheaders/core/types';

/** Find the collection a persisted rule lives under, by path-prefix
 *  match. Mirrors the same lookup the workbench `RuleEditor` uses so
 *  `{{collection.X}}` references inside the rule's values resolve
 *  against the right scope. Returns undefined for rules that aren't
 *  slotted into any collection (shouldn't happen for v5 local rules). */
export function findRuleCollectionId(rule: V5.Rule, collections: readonly V5.Collection[]): string | undefined {
  const match = collections.find((c) => rule.path.startsWith(`${c.path}/`));
  return match?.uid;
}
