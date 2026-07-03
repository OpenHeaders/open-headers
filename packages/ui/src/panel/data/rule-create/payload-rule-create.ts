/**
 * Pure builders for the inspector Payload-tab quick-editors' CREATE
 * mode — request-body and query-param. Counterpart of
 * `url-rule-create.ts` for the Payload tab's two CTAs: the popover's
 * Save is the publication gesture — the caller creates the rule from
 * this seed and publishes it in the same flow. Conditions derive from
 * the captured draft (URL per strategy + request methods).
 */

import type {
  QueryParamOperation,
  QueryParamRule,
  QueryParamRuleDraft,
  RequestBodyRule,
  RequestBodyRuleDraft,
} from '@openheaders/core/types';
import { type DraftUrlStrategy, generateUid } from '@openheaders/core/utils';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';

export type RequestBodyRuleSeed = Omit<RequestBodyRule, 'uid' | 'path' | 'schemaVersion'>;
export type QueryParamRuleSeed = Omit<QueryParamRule, 'uid' | 'path' | 'schemaVersion'>;

// ── Request body ────────────────────────────────────────────────────

export interface RequestBodyQuickDraft {
  requestBody: string;
}

/** Seed the editable field from the captured outgoing body. */
export function seedRequestBodyQuickDraft(draft: RequestBodyRuleDraft): RequestBodyQuickDraft {
  return { requestBody: draft.requestBody ?? '' };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. */
export function mergeQuickIntoRequestBodyDraft(
  draft: RequestBodyRuleDraft,
  quick: RequestBodyQuickDraft,
): RequestBodyRuleDraft {
  return { ...draft, requestBody: quick.requestBody };
}

export function buildRequestBodyRuleSeed(
  draft: RequestBodyRuleDraft,
  quick: RequestBodyQuickDraft,
  name: string,
  strategy: DraftUrlStrategy,
): RequestBodyRuleSeed {
  return {
    name,
    enabled: true,
    type: 'request-body',
    conditions: buildDraftConditions(draft, strategy),
    action: {
      bodyType: draft.bodyType ?? 'static',
      requestBody: quick.requestBody,
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
 *  drops both (the whole query string goes). */
function draftEntryFromRow(row: QueryParamQuickRow): { operation: QueryParamOperation; param: string; value?: string } {
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
  return { ...draft, params: rows.map(draftEntryFromRow) };
}

/** A row is savable when its operation needs no param (remove-all) or
 *  its param is filled in. */
export function queryParamRowsValid(rows: readonly QueryParamQuickRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.operation === 'remove-all' || r.param.trim().length > 0);
}

export function buildQueryParamRuleSeed(
  draft: QueryParamRuleDraft,
  rows: readonly QueryParamQuickRow[],
  name: string,
  strategy: DraftUrlStrategy,
): QueryParamRuleSeed {
  return {
    name,
    enabled: true,
    type: 'query-param',
    conditions: buildDraftConditions(draft, strategy),
    action: { params: rows.map((row) => ({ uid: row.uid, ...draftEntryFromRow(row) })) },
  };
}
