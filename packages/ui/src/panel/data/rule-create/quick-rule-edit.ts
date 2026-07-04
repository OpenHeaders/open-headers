/**
 * Pure builders for the inspector quick-editors' EDIT-mode Save
 * payloads — delay, block, query-param, request-body, inject, ws/sse,
 * auth. Same contract as
 * `response-rule-edit.ts` / `redirect-rule-edit.ts`: the popover is an
 * ATOMIC edit — the full new value is committed in one gesture, never
 * streamed per-keystroke — so a published rule must carry
 * `published: true` in the SAME batch. An explicit `published` in the
 * update is read as the publication gesture, skipping
 * `applyRuleUpdate`'s streaming-edit auto-unpublish, so the tweaked
 * rule takes effect on the next request instead of silently dropping
 * to draft.
 *
 * `conditions` joins each batch only when the popover's Conditions row
 * is dirty — an untouched row never clobbers a concurrent conditions
 * edit from another surface.
 */

import type {
  AuthRule,
  BlockRule,
  DelayRule,
  InjectRule,
  QueryParamAction,
  QueryParamRule,
  RequestBodyRule,
  Rule,
  RuleCondition,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import { type QueryParamQuickRow, queryParamEntryFromRow } from './payload-rule-create';

/** The shared tail of every quick-edit payload — the conditions-when-
 *  dirty rule and the publication carry (see file header). */
function quickEditBase(rule: Rule, conditions?: RuleCondition[]): Partial<Pick<Rule, 'conditions' | 'published'>> {
  return {
    ...(conditions ? { conditions } : {}),
    ...(rule.published === true ? { published: true } : {}),
  };
}

// ── Delay ───────────────────────────────────────────────────────────

export interface DelayQuickEditDraft {
  /** Null while the number input is cleared — the save gate blocks. */
  delayMs: number | null;
}

export function buildDelayRuleUpdate(
  rule: DelayRule,
  draft: DelayQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<DelayRule> {
  return {
    // The save gate guarantees delayMs is set when Save is reachable;
    // the fallback only satisfies the narrower action type.
    action: { ...rule.action, delayMs: draft.delayMs ?? rule.action.delayMs },
    ...quickEditBase(rule, conditions),
  };
}

// ── Block ───────────────────────────────────────────────────────────

/** Block has no action fields — the quick edit is conditions-only. */
export function buildBlockRuleUpdate(rule: BlockRule, conditions?: RuleCondition[]): Partial<BlockRule> {
  return quickEditBase(rule, conditions);
}

// ── Query params ────────────────────────────────────────────────────

/** Rows for the edit popover, seeded from the live rule's entries.
 *  Entry uids carry through so an edit preserves entry identity. */
export function seedQueryParamRowsFromAction(action: QueryParamAction): QueryParamQuickRow[] {
  return action.params.map((p) => ({
    uid: p.uid,
    operation: p.operation,
    param: p.param,
    value: p.value ?? '',
  }));
}

export function buildQueryParamRuleUpdate(
  rule: QueryParamRule,
  rows: readonly QueryParamQuickRow[],
  conditions?: RuleCondition[],
): Partial<QueryParamRule> {
  return {
    action: { params: rows.map((row) => ({ uid: row.uid, ...queryParamEntryFromRow(row) })) },
    ...quickEditBase(rule, conditions),
  };
}

// ── Request body ────────────────────────────────────────────────────

export interface RequestBodyQuickEditDraft {
  requestBody: string;
}

/** The action rebuild preserves the fields the compact editor doesn't
 *  surface (body type, resource type, GraphQL filter). */
export function buildRequestBodyRuleUpdate(
  rule: RequestBodyRule,
  draft: RequestBodyQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<RequestBodyRule> {
  return {
    action: { ...rule.action, requestBody: draft.requestBody },
    ...quickEditBase(rule, conditions),
  };
}

// ── Inject ──────────────────────────────────────────────────────────

/** The popover surfaces exactly one field, picked by the rule's code
 *  source — `code` when the rule inlines it, `sourceUrl` when it loads
 *  from a URL. The other field never appears in the draft. */
export interface InjectQuickEditDraft {
  code?: string;
  sourceUrl?: string;
}

export function seedInjectDraft(rule: InjectRule): InjectQuickEditDraft {
  return rule.action.source === 'url' ? { sourceUrl: rule.action.sourceUrl ?? '' } : { code: rule.action.code };
}

/** The action rebuild preserves the fields the compact editor doesn't
 *  surface (language, code source, position, CSP bypass). */
export function buildInjectRuleUpdate(
  rule: InjectRule,
  draft: InjectQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<InjectRule> {
  const actionPatch =
    rule.action.source === 'url' ? { sourceUrl: draft.sourceUrl ?? '' } : { code: draft.code ?? '' };
  return {
    action: { ...rule.action, ...actionPatch },
    ...quickEditBase(rule, conditions),
  };
}

// ── WS / SSE messages ───────────────────────────────────────────────

/** Null payload = a `drop` rule — the operation has no payload (the
 *  workbench strips it on save), so the quick edit is conditions-only
 *  and the action is left untouched. */
export interface MessageQuickEditDraft {
  payload: string | null;
}

export function seedMessageDraft(rule: WsRule | SseRule): MessageQuickEditDraft {
  return { payload: rule.action.operation === 'drop' ? null : (rule.action.payload ?? '') };
}

/** The action rebuild preserves the fields the compact editor doesn't
 *  surface (operation, direction, message filter, inject trigger). */
export function buildWsRuleUpdate(
  rule: WsRule,
  draft: MessageQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<WsRule> {
  if (draft.payload === null) return quickEditBase(rule, conditions);
  return {
    action: { ...rule.action, payload: draft.payload },
    ...quickEditBase(rule, conditions),
  };
}

/** The action rebuild preserves the fields the compact editor doesn't
 *  surface (operation, event name, message filter, inject trigger). */
export function buildSseRuleUpdate(
  rule: SseRule,
  draft: MessageQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<SseRule> {
  if (draft.payload === null) return quickEditBase(rule, conditions);
  return {
    action: { ...rule.action, payload: draft.payload },
    ...quickEditBase(rule, conditions),
  };
}

// ── Auth ────────────────────────────────────────────────────────────

export interface AuthQuickEditDraft {
  username: string;
  password: string;
}

/** The action is exactly the two credential fields — nothing to preserve. */
export function buildAuthRuleUpdate(
  rule: AuthRule,
  draft: AuthQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<AuthRule> {
  return {
    action: { username: draft.username, password: draft.password },
    ...quickEditBase(rule, conditions),
  };
}
