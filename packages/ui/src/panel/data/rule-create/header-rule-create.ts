/**
 * Pure builders for the inspector header quick-editor's CREATE mode.
 * Counterpart of `response-rule-create.ts` for the Headers tab's
 * server-row Override CTA: the popover's Save is the publication
 * gesture — the caller creates the rule from this seed and publishes it
 * in the same flow. The seed carries one header modification in the
 * clicked row's direction; conditions come from the popover's editable
 * conditions state (seeded via `buildDraftConditions`, edited in the
 * Conditions row) and pass through unchanged.
 */

import type {
  HeaderModification,
  HeaderRule,
  HeaderRuleDraft,
  HeaderRuleDraftHeader,
  RuleCondition,
} from '@openheaders/core/types';
import { generateUid, type HeaderDirection } from '@openheaders/core/utils';

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
 * requires row identity), conditions passed through unchanged from the
 * popover's Conditions row.
 */
export function buildHeaderRuleSeed(
  quick: HeaderQuickDraft,
  direction: HeaderDirection,
  name: string,
  conditions: RuleCondition[],
): HeaderRuleSeed {
  const mod: HeaderModification = { uid: generateUid(), ...draftHeaderFromQuick(quick) };
  return {
    name,
    enabled: true,
    type: 'header',
    conditions,
    action: {
      requestHeaders: direction === 'request' ? [mod] : [],
      responseHeaders: direction === 'response' ? [mod] : [],
    },
  };
}
