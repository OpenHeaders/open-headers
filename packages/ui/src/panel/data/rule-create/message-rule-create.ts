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
 * The draft's captured payload is the VERBATIM frame/event text; the
 * popover edits a formatted VIEW of it (`formatBody` at seed, once),
 * and every exit — Save and the workspace hand-off — re-encodes
 * through `encodeBodyForWire`: untouched view ⇒ the original bytes
 * exactly, edited view ⇒ the original's serialization profile.
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
import { encodeBodyForWire, formatBody } from '@openheaders/ui/shared/body-format';

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
 *  opens as its formatted view. */
export function seedMessageQuickDraft(draft: MessageRuleDraft): MessageQuickDraft {
  const base: MessageQuickDraftBase = {
    operation: draft.operation ?? 'modify',
    filterType: draft.messageFilter?.matchType ?? 'none',
    filterValue: draft.messageFilter?.value ?? '',
    payload: formatBody(draft.payload ?? ''),
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
 *  workspace" link carries the CURRENT form state — with the payload
 *  re-encoded to the wire profile so every downstream surface sees
 *  canonical text. The draft and the quick draft always describe the
 *  same rule type — the quick draft was seeded from the draft and the
 *  kind is not editable. */
export function mergeQuickIntoMessageDraft(draft: MessageRuleDraft, quick: MessageQuickDraft): MessageRuleDraft {
  const shared = {
    operation: quick.operation,
    messageFilter: quickFilter(quick),
    payload: quick.operation === 'drop' ? undefined : encodeBodyForWire(draft.payload ?? '', quick.payload),
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

/** `originalPayload` is the captured wire text the quick payload was
 *  seeded from — the encode baseline, so an untouched view stores the
 *  frame/event bytes exactly. */
export function buildMessageRuleSeed(
  quick: MessageQuickDraft,
  name: string,
  conditions: RuleCondition[],
  originalPayload: string,
): WsRuleSeed | SseRuleSeed {
  const filter = quickFilter(quick);
  const shared = {
    ...(filter ? { messageFilter: filter } : {}),
    ...(quick.operation !== 'drop' ? { payload: encodeBodyForWire(originalPayload, quick.payload) } : {}),
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
