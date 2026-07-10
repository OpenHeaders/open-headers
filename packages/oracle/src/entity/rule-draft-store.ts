/**
 * Rule Draft Store — single-consume map of rule pre-fills handed from
 * the DevTools panel to the workspace create-rule editor. The panel
 * stashes a `RuleDraft` via `createRuleDraft`, opens
 * `workbench.html#/create/<type>/draft-<nonce>`, and the workbench's
 * intent router pops it via `takeRuleDraft`. Mechanics (nonce, TTL,
 * single-consume rationale) live in `draft-store.ts`.
 */

import { RuleDraftSchema } from '@openheaders/core/schemas';
import type { RuleDraft } from '@openheaders/core/types';
import { createDraftStore } from './draft-store';

const store = createDraftStore(RuleDraftSchema, 'RuleDraftStore');

/**
 * Parse and stash a rule draft. Returns the nonce the caller should
 * embed in the workspace hash URL. Throws if the draft fails schema
 * validation — callers should surface the error to the user (panel
 * shows a toast) rather than silently open an empty create tab.
 */
export function createRuleDraft(rawDraft: unknown): string {
  return store.create(rawDraft);
}

/**
 * Pop the draft for the given nonce. Returns the draft if present,
 * `null` if the nonce is unknown or already consumed.
 */
export function takeRuleDraft(nonce: string): RuleDraft | null {
  return store.take(nonce);
}

/** Test hook — not used in production, exported for unit tests. */
export function _clearAllDrafts(): void {
  store.clear();
}
