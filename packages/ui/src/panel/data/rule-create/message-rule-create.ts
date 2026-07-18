/**
 * Pure builders for the message quick-create popover (ws frames and sse
 * events) — counterpart of `url-rule-create.ts` / `payload-rule-create.ts`
 * for the per-frame "Override" action: the popover's Save is the
 * publication gesture — the caller creates the rule from this seed and
 * publishes it in the same flow. Conditions pass through unchanged from
 * the popover's Conditions row (seeded via `buildDraftConditions`,
 * edited in place).
 *
 * The two rule types share the operation / filter / payload / trigger
 * vocabulary; ws adds a direction selector, sse an event-name gate —
 * the same split as the workbench's `MessageRuleFields`. The quick
 * draft is kind-discriminated so one builder set serves both grids.
 *
 * The payload plane is WIRE-space (response parity): the payload field
 * is a `FormatAwareBodyEditor`, whose form value is already wire text
 * (encoded per edit, Raw mode verbatim). Seeds carry the captured
 * frame/event bytes AS IS and every exit — Save and the workspace
 * hand-off — stores the field verbatim; a re-encode here would
 * re-profile a deliberate Raw-mode edit.
 */

import type {
  InjectTrigger,
  MessageFilter,
  MessageOperation,
  RuleCondition,
  SseRule,
  SseRuleDraft,
  WsDirection,
  WsRule,
  WsRuleDraft,
} from '@openheaders/core/types';

export type WsRuleSeed = Omit<WsRule, 'uid' | 'path' | 'schemaVersion'>;
export type SseRuleSeed = Omit<SseRule, 'uid' | 'path' | 'schemaVersion'>;

/** The two draft shapes the message popover edits. */
export type MessageRuleDraft = WsRuleDraft | SseRuleDraft;

/** `none` is the popover's "match every frame/event" choice — the
 *  persisted action simply omits `messageFilter`. */
export type MessageFilterType = MessageFilter['matchType'] | 'none';

export interface MessageQuickDraftBase {
  operation: MessageOperation;
  filterType: MessageFilterType;
  filterValue: string;
  payload: string;
  injectTrigger: InjectTrigger;
}

export type MessageQuickDraft =
  | (MessageQuickDraftBase & { kind: 'ws'; direction: WsDirection })
  | (MessageQuickDraftBase & { kind: 'sse'; eventName: string });

/** Seed the editable fields from the captured draft — absent fields
 *  fall back to the type's create defaults (`buildEmptyRule` parity:
 *  modify, ws receive, sse default `message` events). The payload
 *  carries the captured wire bytes verbatim (the editor formats its
 *  own view). */
export function seedMessageQuickDraft(draft: MessageRuleDraft): MessageQuickDraft {
  const base: MessageQuickDraftBase = {
    operation: draft.operation ?? 'modify',
    filterType: draft.messageFilter?.matchType ?? 'none',
    filterValue: draft.messageFilter?.value ?? '',
    payload: draft.payload ?? '',
    injectTrigger: draft.injectTrigger ?? 'open',
  };
  if (draft.type === 'ws') return { ...base, kind: 'ws', direction: draft.direction ?? 'receive' };
  return { ...base, kind: 'sse', eventName: draft.eventName ?? '' };
}

function quickFilter(quick: MessageQuickDraft): MessageFilter | undefined {
  if (quick.filterType === 'none' || !quick.filterValue) return undefined;
  return { matchType: quick.filterType, value: quick.filterValue };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. Wire in, wire out.
 *  The draft and the quick draft always describe the same rule type —
 *  the quick draft was seeded from the draft and the kind is not
 *  editable. */
export function mergeQuickIntoMessageDraft(draft: MessageRuleDraft, quick: MessageQuickDraft): MessageRuleDraft {
  const shared = {
    operation: quick.operation,
    messageFilter: quickFilter(quick),
    payload: quick.operation === 'drop' ? undefined : quick.payload,
    injectTrigger: quick.operation === 'inject' ? quick.injectTrigger : undefined,
  };
  if (quick.kind === 'ws') {
    return { ...draft, ...shared, type: 'ws', direction: quick.direction };
  }
  return { ...draft, ...shared, type: 'sse', eventName: quick.eventName.trim() || undefined };
}

/** A draft is savable when its filter, if enabled, has a value — the
 *  payload may be empty (replace-with-empty is a legal modify). */
export function messageQuickDraftValid(quick: MessageQuickDraft): boolean {
  return quick.filterType === 'none' || quick.filterValue.trim().length > 0;
}

/** The quick payload is wire text — it stores AS IS (see the file
 *  header), so an untouched draft stores the frame/event bytes exactly. */
export function buildMessageRuleSeed(
  quick: MessageQuickDraft,
  name: string,
  conditions: RuleCondition[],
): WsRuleSeed | SseRuleSeed {
  const filter = quickFilter(quick);
  const shared = {
    ...(filter ? { messageFilter: filter } : {}),
    ...(quick.operation !== 'drop' ? { payload: quick.payload } : {}),
    ...(quick.operation === 'inject' ? { injectTrigger: quick.injectTrigger } : {}),
  };
  if (quick.kind === 'ws') {
    return {
      name,
      enabled: true,
      type: 'ws',
      conditions,
      action: { operation: quick.operation, direction: quick.direction, ...shared },
    };
  }
  const eventName = quick.eventName.trim();
  return {
    name,
    enabled: true,
    type: 'sse',
    conditions,
    action: { operation: quick.operation, ...(eventName ? { eventName } : {}), ...shared },
  };
}
