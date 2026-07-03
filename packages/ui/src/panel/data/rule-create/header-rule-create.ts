/**
 * Pure builders for the inspector header quick-editor's CREATE mode.
 * Counterpart of `response-rule-create.ts` for the Headers tab's
 * server-row Override CTA: the popover's Save is the publication
 * gesture — the caller creates the rule from this seed and publishes it
 * in the same flow. The seed carries one header modification in the
 * clicked row's direction; conditions derive from the captured draft
 * (URL per strategy + request methods).
 */

import type { HeaderModification, HeaderRule, HeaderRuleDraft, HeaderRuleDraftHeader } from '@openheaders/core/types';
import { type DraftUrlStrategy, generateUid, type HeaderDirection } from '@openheaders/core/utils';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';

export type HeaderRuleSeed = Omit<HeaderRule, 'uid' | 'path' | 'schemaVersion'>;

export type { HeaderDirection };

export interface HeaderQuickDraft {
  operation: HeaderModification['operation'];
  headerName: string;
  value: string;
  mergeSeparator?: string;
}

/** Seed the editable fields from the captured draft's first mod in the
 *  clicked direction. */
export function seedHeaderQuickDraft(draft: HeaderRuleDraft, direction: HeaderDirection): HeaderQuickDraft {
  const mod = (direction === 'request' ? draft.requestHeaders : draft.responseHeaders)?.[0];
  return {
    operation: mod?.operation ?? 'override',
    headerName: mod?.headerName ?? '',
    value: mod?.value ?? '',
    ...(mod?.mergeSeparator != null ? { mergeSeparator: mod.mergeSeparator } : {}),
  };
}

/** Per-operation mod shape — same split `buildHeaderModUpdate` applies:
 *  remove carries no value, merge carries the separator. */
function draftHeaderFromQuick(quick: HeaderQuickDraft): HeaderRuleDraftHeader {
  if (quick.operation === 'remove') return { operation: 'remove', headerName: quick.headerName };
  if (quick.operation === 'merge') {
    return {
      operation: 'merge',
      headerName: quick.headerName,
      value: quick.value,
      mergeSeparator: quick.mergeSeparator,
    };
  }
  return { operation: quick.operation, headerName: quick.headerName, value: quick.value };
}

/**
 * Fold the popover's edits back into the handoff draft so the "Open in
 * workspace" link carries the CURRENT form state, not the original
 * capture.
 */
export function mergeQuickIntoHeaderDraft(
  draft: HeaderRuleDraft,
  quick: HeaderQuickDraft,
  direction: HeaderDirection,
): HeaderRuleDraft {
  const mod = draftHeaderFromQuick(quick);
  return {
    ...draft,
    requestHeaders: direction === 'request' ? [mod] : undefined,
    responseHeaders: direction === 'response' ? [mod] : undefined,
  };
}

/**
 * Build the full rule seed for `applyRuleCreate`: one modification in
 * the clicked direction (uid minted here — the persisted schema
 * requires row identity), conditions derived like the workbench does
 * for an inspector handoff draft.
 */
export function buildHeaderRuleSeed(
  draft: HeaderRuleDraft,
  quick: HeaderQuickDraft,
  direction: HeaderDirection,
  name: string,
  strategy: DraftUrlStrategy,
): HeaderRuleSeed {
  const mod: HeaderModification = { uid: generateUid(), ...draftHeaderFromQuick(quick) };
  return {
    name,
    enabled: true,
    type: 'header',
    conditions: buildDraftConditions(draft, strategy),
    action: {
      requestHeaders: direction === 'request' ? [mod] : [],
      responseHeaders: direction === 'response' ? [mod] : [],
    },
  };
}
