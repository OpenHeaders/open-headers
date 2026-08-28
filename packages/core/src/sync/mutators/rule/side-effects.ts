/**
 * Side-effect intent factories for rule mutations.
 *
 * Today there's exactly one side effect: DNR recompile. The runner
 * (S2 — not landed yet) will coalesce by `(kind, key)` with
 * latest-HLC wins, then read the materialized snapshot at execution
 * time (S4) so it picks up every batched change.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import { COLLECTION_ENTITY_TYPE } from '../collection/types';
import { FOLDER_CHILDREN_PATH, FOLDER_ENTITY_TYPE, FOLDER_ITEMS_PATH } from '../folder/types';
import type { SideEffectIntent } from '../types';
import { RULE_ENTITY_TYPE } from './types';

export const RECOMPILE_DNR = 'recompile-dnr';

/**
 * Intent: re-derive DNR rule list for `ruleUid` and push it through
 * `chrome.declarativeNetRequest.updateDynamicRules`. Coalescing key
 * is `ruleUid` so a flurry of edits collapses into one recompile.
 */
export function recompileDnrIntent(ruleUid: string, hlc: HLC): SideEffectIntent {
  return { kind: RECOMPILE_DNR, key: ruleUid, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed rule envelope. Every rule mutation reshapes the effective
 * DNR rule set, so each emits one `RECOMPILE_DNR` intent keyed by the
 * rule uid.
 *
 * Used receive-side by `deriveSideEffectsForEnvelope` so a peer's rule
 * edit drives the DNR recompile on every host that applies it — not
 * only the host that minted it. Mint-side, the rule mutators emit the
 * identical intent inline.
 */
export function deriveRuleSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  if (envelope.body.type !== RULE_ENTITY_TYPE) return [];
  return [recompileDnrIntent(envelope.body.id, envelope.hlc)];
}

/**
 * Containment writes on the rule tree that change which pause markers
 * a rule sits under: a rule slot landing on a collection or folder
 * (the add half of a cross-parent move; a rehome), or a folder slot
 * landing anywhere (its whole subtree changes chain). A same-parent
 * `moveBefore` keeps the chain and emits nothing. Keyed by the moved
 * child's uid so a flurry on one child coalesces.
 */
export function deriveRuleTreeContainmentSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const body = envelope.body;
  if (body.type !== COLLECTION_ENTITY_TYPE && body.type !== FOLDER_ENTITY_TYPE) return [];
  if (body.kind !== 'addToSet') return [];
  if (body.path === FOLDER_CHILDREN_PATH) return [recompileDnrIntent(body.itemId, envelope.hlc)];
  if (body.path === FOLDER_ITEMS_PATH && isRuleSlot(body.item)) return [recompileDnrIntent(body.itemId, envelope.hlc)];
  return [];
}

function isRuleSlot(item: unknown): boolean {
  return typeof item === 'object' && item !== null && (item as { type?: unknown }).type === RULE_ENTITY_TYPE;
}
