/**
 * Pure builders for the inspector Payload-tab quick-editors' CREATE
 * mode — request-body and query-param. Counterpart of
 * `url-rule-create.ts` for the Payload tab's two CTAs: the popover's
 * Save is the publication gesture — the caller creates the rule from
 * this seed and publishes it in the same flow. Conditions pass through
 * unchanged from the popover's Conditions row (seeded via
 * `buildDraftConditions`, edited in place).
 *
 * The captured request body is VERBATIM wire text; the popover edits a
 * formatted VIEW (`formatBody` at seed, once) and every exit re-encodes
 * through `encodeBodyForWire` — untouched view ⇒ the original bytes
 * exactly, edited view ⇒ the original's serialization profile.
 */

import type {
  QueryParamOperation,
  QueryParamRule,
  QueryParamRuleDraft,
  RequestBodyRule,
  RequestBodyRuleDraft,
  RuleCondition,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { encodeBodyForWire, formatBody } from '@openheaders/ui/shared/body-format';

export type RequestBodyRuleSeed = Omit<RequestBodyRule, 'uid' | 'path' | 'schemaVersion'>;
export type QueryParamRuleSeed = Omit<QueryParamRule, 'uid' | 'path' | 'schemaVersion'>;

// ── Request body ────────────────────────────────────────────────────

export interface RequestBodyQuickDraft {
  requestBody: string;
}

/** Seed the editable field from the captured outgoing body — opens as
 *  its formatted view. */
export function seedRequestBodyQuickDraft(draft: RequestBodyRuleDraft): RequestBodyQuickDraft {
  return { requestBody: formatBody(draft.requestBody ?? '') };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state — body re-encoded to
 *  the wire profile. */
export function mergeQuickIntoRequestBodyDraft(
  draft: RequestBodyRuleDraft,
  quick: RequestBodyQuickDraft,
): RequestBodyRuleDraft {
  return { ...draft, requestBody: encodeBodyForWire(draft.requestBody ?? '', quick.requestBody) };
}

export function buildRequestBodyRuleSeed(
  draft: RequestBodyRuleDraft,
  quick: RequestBodyQuickDraft,
  name: string,
  conditions: RuleCondition[],
): RequestBodyRuleSeed {
  return {
    name,
    enabled: true,
    type: 'request-body',
    conditions,
    action: {
      bodyType: draft.bodyType ?? 'static',
      requestBody: encodeBodyForWire(draft.requestBody ?? '', quick.requestBody),
      resourceType: draft.resourceType ?? 'rest',
    },
  };
}

// ── Query params ────────────────────────────────────────────────────

/** One editable row. `uid` is minted at seed time — it doubles as the
 *  React row key and the persisted entry identity (the schema requires
 *  row identity, same as header mods). */
export interface QueryParamQuickRow {
  uid: string;
  operation: QueryParamOperation;
  param: string;
  value: string;
}

function emptyRow(): QueryParamQuickRow {
  return { uid: generateUid(), operation: 'add', param: '', value: '' };
}

/** Seed rows from the captured query string — each observed param is an
 *  `override` entry pre-filled with its current value (the same shape
 *  `rule-draft-bridge` put in the draft). No capture → one empty Add
 *  row, so the CTA still scaffolds. */
export function seedQueryParamQuickRows(draft: QueryParamRuleDraft): QueryParamQuickRow[] {
  const params = draft.params ?? [];
  if (params.length === 0) return [emptyRow()];
  return params.map((p) => ({ uid: generateUid(), operation: p.operation, param: p.param, value: p.value ?? '' }));
}

export function appendQueryParamQuickRow(rows: readonly QueryParamQuickRow[]): QueryParamQuickRow[] {
  return [...rows, emptyRow()];
}

/** Per-operation entry shape — remove drops the value, remove-all
 *  drops both (the whole query string goes). Exported for the edit
 *  popover's payload builder (`quick-rule-edit.ts`). */
export function queryParamEntryFromRow(row: QueryParamQuickRow): {
  operation: QueryParamOperation;
  param: string;
  value?: string;
} {
  if (row.operation === 'remove-all') return { operation: 'remove-all', param: '' };
  if (row.operation === 'remove') return { operation: 'remove', param: row.param };
  return { operation: row.operation, param: row.param, value: row.value };
}

/** Fold the popover's rows back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. */
export function mergeQuickIntoQueryParamDraft(
  draft: QueryParamRuleDraft,
  rows: readonly QueryParamQuickRow[],
): QueryParamRuleDraft {
  return { ...draft, params: rows.map(queryParamEntryFromRow) };
}

/** A row is savable when its operation needs no param (remove-all) or
 *  its param is filled in. */
export function queryParamRowsValid(rows: readonly QueryParamQuickRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.operation === 'remove-all' || r.param.trim().length > 0);
}

export function buildQueryParamRuleSeed(
  rows: readonly QueryParamQuickRow[],
  name: string,
  conditions: RuleCondition[],
): QueryParamRuleSeed {
  return {
    name,
    enabled: true,
    type: 'query-param',
    conditions,
    action: { params: rows.map((row) => ({ uid: row.uid, ...queryParamEntryFromRow(row) })) },
  };
}
