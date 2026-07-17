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
  HeaderModification,
  HeaderOperation,
  HeaderRule,
  InjectRule,
  QueryParamAction,
  QueryParamRule,
  RequestBodyRule,
  Rule,
  RuleCondition,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import {
  generateUid,
  getHeaderOperationCapability,
  type HeaderDirection,
  validateHeaderName,
  validateHeaderValue,
} from '@openheaders/core/utils';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { headerValidationMessage } from '@openheaders/ui/shared/headers';
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
  const actionPatch = rule.action.source === 'url' ? { sourceUrl: draft.sourceUrl ?? '' } : { code: draft.code ?? '' };
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

// ── Header (whole-rule rows) ────────────────────────────────────────
//
// The Matched Rules hover has no header row to pinpoint one
// modification (unlike the Headers-tab hover, which edits a single mod
// via `buildHeaderModUpdate`), so its editor surfaces the rule's FULL
// modification list as rows — same whole-list shape as the query-param
// editor.

export interface HeaderModQuickRow {
  /** Persisted mod uid — carries through the edit so row identity (and
   *  the HLC chain behind it) is preserved. Minted for added rows. */
  uid: string;
  direction: HeaderDirection;
  operation: HeaderOperation;
  headerName: string;
  value: string;
  mergeSeparator?: string;
}

export function seedHeaderModRows(action: HeaderRule['action']): HeaderModQuickRow[] {
  const fromList = (list: HeaderModification[], direction: HeaderDirection): HeaderModQuickRow[] =>
    list.map((m) => ({
      uid: m.uid,
      direction,
      operation: m.operation,
      headerName: m.headerName,
      value: m.value ?? '',
      ...(m.mergeSeparator != null ? { mergeSeparator: m.mergeSeparator } : {}),
    }));
  return [...fromList(action.requestHeaders, 'request'), ...fromList(action.responseHeaders, 'response')];
}

export function appendHeaderModRow(rows: HeaderModQuickRow[]): HeaderModQuickRow[] {
  return [...rows, { uid: generateUid(), direction: 'request', operation: 'override', headerName: '', value: '' }];
}

/** Per-operation mod shape — same split `buildHeaderModUpdate` applies:
 *  remove carries no value, merge carries the separator. */
function headerModFromRow(row: HeaderModQuickRow): HeaderModification {
  if (row.operation === 'remove') return { uid: row.uid, operation: 'remove', headerName: row.headerName };
  if (row.operation === 'merge') {
    return {
      uid: row.uid,
      operation: 'merge',
      headerName: row.headerName,
      value: row.value,
      mergeSeparator: row.mergeSeparator,
    };
  }
  return { uid: row.uid, operation: row.operation, headerName: row.headerName, value: row.value };
}

export function buildHeaderRuleUpdate(
  rule: HeaderRule,
  rows: readonly HeaderModQuickRow[],
  conditions?: RuleCondition[],
): Partial<HeaderRule> {
  return {
    action: {
      requestHeaders: rows.filter((r) => r.direction === 'request').map(headerModFromRow),
      responseHeaders: rows.filter((r) => r.direction === 'response').map(headerModFromRow),
    },
    ...quickEditBase(rule, conditions),
  };
}

export interface HeaderModRowIssue {
  /** Row the issue anchors to. */
  uid: string;
  message: string;
  /** When the operation is the problem, the one-click alternative. */
  suggestion?: HeaderOperation;
}

/** First broken row, or null when every row would save cleanly. Same
 *  validators (and the same template pass-through — `{{…}}` resolves at
 *  runtime) as the single-mod popover and the workbench editor. Core
 *  sentences resolve keyed through the shared `headerValidationMessage`
 *  mirror, so the caller passes its `useT()` translator
 *  (shared-module rule). */
export function firstHeaderModRowIssue(t: Translate, rows: readonly HeaderModQuickRow[]): HeaderModRowIssue | null {
  for (const row of rows) {
    const trimmed = row.headerName.trim();
    if (!trimmed) return { uid: row.uid, message: t('panel.quickEditor.validation.nameRequired') };
    if (!trimmed.includes('{{')) {
      const nameValidation = validateHeaderName(trimmed, row.direction === 'response');
      if (!nameValidation.valid) {
        return {
          uid: row.uid,
          message: headerValidationMessage(t, nameValidation) || t('panel.quickEditor.validation.invalidName'),
        };
      }
      const capability = getHeaderOperationCapability(row.direction, row.operation, row.headerName);
      if (!capability.allowed) {
        return { uid: row.uid, message: headerValidationMessage(t, capability), suggestion: capability.suggestion };
      }
    }
    if (row.operation !== 'remove' && row.value && !row.value.includes('{{')) {
      const valueValidation = validateHeaderValue(row.value, trimmed);
      if (!valueValidation.valid) {
        return {
          uid: row.uid,
          message: headerValidationMessage(t, valueValidation) || t('panel.quickEditor.validation.invalidValue'),
        };
      }
    }
  }
  return null;
}
