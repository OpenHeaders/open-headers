/**
 * Pure builder for the inspector header-row popover's Save payload.
 * Split out of `RuleHoverPopover` so the publication-gate handling — the
 * subtle part — is testable in isolation.
 *
 * The popover is an ATOMIC edit: the full new value is committed in one
 * gesture, never streamed per-keystroke. The workbench editor streams
 * edits (each auto-unpublishing the rule via `applyRuleUpdate`) and then
 * crosses the publication gate with an explicit Save/publish. The popover
 * has no such two-step lifecycle, so it must keep a live rule live within
 * the single commit: it carries the rule's current `published` state in
 * the same batch. An explicit `published` in the update is read as the
 * publication gesture, so `applyRuleUpdate`'s streaming-edit
 * auto-unpublish is skipped and the tweaked header takes effect on the
 * next request instead of silently dropping the rule to draft.
 */

import type { HeaderModification, HeaderRule, RuleCondition } from '@openheaders/core/types';
import { quickEditBase } from './quick-rule-edit';

export interface HeaderModDraft {
  operation: HeaderModification['operation'];
  headerName: string;
  value: string;
  mergeSeparator?: string;
}

export type HeaderModUpdateResult = { ok: true; updates: Partial<HeaderRule> } | { ok: false; reason: 'mod-detached' };

/** `conditions` joins the batch only when the popover's Conditions row
 *  is dirty — an untouched row never clobbers a concurrent conditions
 *  edit from another surface. */
export function buildHeaderModUpdate(
  rule: HeaderRule,
  direction: 'request' | 'response',
  currentMod: HeaderModification,
  draft: HeaderModDraft,
  conditions?: RuleCondition[],
): HeaderModUpdateResult {
  const list = direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
  // Identity by reference: the popover holds the live mod object, so a
  // concurrent structural change elsewhere detaches it — bail rather than
  // write against a stale index.
  const idx = list.indexOf(currentMod);
  if (idx === -1) return { ok: false, reason: 'mod-detached' };

  // Preserve the row's persisted uid — the synthesizer keys identity by
  // it, so a fresh uid would tombstone + re-add and lose the HLC chain.
  const uid = currentMod.uid;
  const nextMod: HeaderModification =
    draft.operation === 'remove'
      ? { uid, operation: 'remove', headerName: draft.headerName }
      : draft.operation === 'merge'
        ? {
            uid,
            operation: 'merge',
            headerName: draft.headerName,
            value: draft.value,
            mergeSeparator: draft.mergeSeparator,
          }
        : { uid, operation: draft.operation, headerName: draft.headerName, value: draft.value };
  const next = list.slice();
  next[idx] = nextMod;

  const updates: Partial<HeaderRule> = {
    action: {
      requestHeaders: direction === 'request' ? next : rule.action.requestHeaders,
      responseHeaders: direction === 'response' ? next : rule.action.responseHeaders,
    },
    ...quickEditBase(rule, conditions),
  };
  return { ok: true, updates };
}

/**
 * Value-only update for the value-document tab: replaces ONE
 * modification's value, everything else (name, operation, separator)
 * carried verbatim. Identity by persisted mod uid — the tab is
 * long-lived, so reference identity (the popover's trick above) can't
 * hold across mirror refreshes. A mod that vanished or flipped to
 * `remove` (no value to hold) detaches. Same atomic-edit contract:
 * a published rule carries `published: true` in the same batch.
 */
export function buildHeaderModValueUpdate(
  rule: HeaderRule,
  direction: 'request' | 'response',
  modUid: string,
  nextValue: string,
): HeaderModUpdateResult {
  const list = direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
  const idx = list.findIndex((m) => m.uid === modUid);
  const mod = idx === -1 ? null : list[idx];
  if (mod === null || mod.operation === 'remove') return { ok: false, reason: 'mod-detached' };

  const next = list.slice();
  next[idx] = { ...mod, value: nextValue };

  const updates: Partial<HeaderRule> = {
    action: {
      requestHeaders: direction === 'request' ? next : rule.action.requestHeaders,
      responseHeaders: direction === 'response' ? next : rule.action.responseHeaders,
    },
    ...quickEditBase(rule),
  };
  return { ok: true, updates };
}
