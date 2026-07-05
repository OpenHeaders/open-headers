/**
 * Pure builders for the Messages grid's ws quick-create popover —
 * counterpart of `url-rule-create.ts` / `payload-rule-create.ts` for the
 * per-frame "Add rule" action: the popover's Save is the publication
 * gesture — the caller creates the rule from this seed and publishes it
 * in the same flow. Conditions pass through unchanged from the popover's
 * Conditions row (seeded via `buildDraftConditions`, edited in place).
 */

import type {
  InjectTrigger,
  MessageFilter,
  MessageOperation,
  RuleCondition,
  WsDirection,
  WsRule,
  WsRuleDraft,
} from '@openheaders/core/types';

export type WsRuleSeed = Omit<WsRule, 'uid' | 'path' | 'schemaVersion'>;

/** `none` is the popover's "match every frame in direction" choice —
 *  the persisted action simply omits `messageFilter`. */
export type MessageFilterType = MessageFilter['matchType'] | 'none';

export interface MessageQuickDraft {
  operation: MessageOperation;
  direction: WsDirection;
  filterType: MessageFilterType;
  filterValue: string;
  payload: string;
  injectTrigger: InjectTrigger;
}

/** Seed the editable fields from the captured draft — absent fields
 *  fall back to the type's create defaults (`buildEmptyRule` parity:
 *  modify + receive). */
export function seedMessageQuickDraft(draft: WsRuleDraft): MessageQuickDraft {
  return {
    operation: draft.operation ?? 'modify',
    direction: draft.direction ?? 'receive',
    filterType: draft.messageFilter?.matchType ?? 'none',
    filterValue: draft.messageFilter?.value ?? '',
    payload: draft.payload ?? '',
    injectTrigger: draft.injectTrigger ?? 'open',
  };
}

function quickFilter(quick: MessageQuickDraft): MessageFilter | undefined {
  if (quick.filterType === 'none' || !quick.filterValue) return undefined;
  return { matchType: quick.filterType, value: quick.filterValue };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. */
export function mergeQuickIntoWsDraft(draft: WsRuleDraft, quick: MessageQuickDraft): WsRuleDraft {
  const filter = quickFilter(quick);
  return {
    ...draft,
    operation: quick.operation,
    direction: quick.direction,
    messageFilter: filter,
    payload: quick.operation === 'drop' ? undefined : quick.payload,
    injectTrigger: quick.operation === 'inject' ? quick.injectTrigger : undefined,
  };
}

/** A draft is savable when its filter, if enabled, has a value — the
 *  payload may be empty (replace-with-empty is a legal modify). */
export function messageQuickDraftValid(quick: MessageQuickDraft): boolean {
  return quick.filterType === 'none' || quick.filterValue.trim().length > 0;
}

export function buildWsRuleSeed(quick: MessageQuickDraft, name: string, conditions: RuleCondition[]): WsRuleSeed {
  const filter = quickFilter(quick);
  return {
    name,
    enabled: true,
    type: 'ws',
    conditions,
    action: {
      operation: quick.operation,
      direction: quick.direction,
      ...(filter ? { messageFilter: filter } : {}),
      ...(quick.operation !== 'drop' ? { payload: quick.payload } : {}),
      ...(quick.operation === 'inject' ? { injectTrigger: quick.injectTrigger } : {}),
    },
  };
}
