/**
 * Rule Draft Store — single-consume in-memory map of rule pre-fills
 * handed from the DevTools panel to the workspace create-rule editor.
 *
 * ## Lifecycle
 *
 *   1. Panel builds a `RuleDraft` describing what fields to pre-fill.
 *   2. Panel sends `createRuleDraft` over the bridge. This module parses
 *      the draft through the core valibot schema, mints a random nonce,
 *      stores `{ draft, createdAt }` under the nonce, arms a 60-second
 *      eviction timer, and returns the nonce to the panel.
 *   3. Panel opens `workbench.html#/create/<type>/draft-<nonce>`.
 *   4. The workspace's hash router calls `takeRuleDraft` with the nonce.
 *      This module re-validates (defense-in-depth: store could have been
 *      corrupted if a future feature wrote straight into the Map),
 *      removes the entry, cancels the timer, and returns the draft.
 *
 * ## Why single-consume
 *
 * A draft is a one-shot pre-fill intent — the user clicked a CTA in the
 * panel once, and a single workspace tab opens in response. Consuming
 * the entry on `take` means:
 *
 *   - a reload of the workspace tab lands on an empty create form (not
 *     the stale pre-fill), matching the user's "I'm past that starting
 *     state now" mental model
 *   - concurrent takes (two tabs somehow racing on the same nonce)
 *     resolve cleanly: exactly one gets the draft, the other gets null
 *   - memory pressure from stale drafts is bounded by the TTL even if
 *     the user never opens the workspace tab at all
 *
 * ## TTL
 *
 * 60 seconds is long enough to cover normal navigation (panel click →
 * `tabs.create` → workspace boot → hash router → `takeRuleDraft`) with
 * plenty of slack for slow machines, and short enough that a forgotten
 * draft doesn't linger through sleep/wake cycles.
 *
 * Note: this store is in-memory only. A background service-worker
 * eviction will drop all pending drafts, which is the correct behavior
 * — the user would be looking at a dead hash nonce after SW eviction
 * regardless, so there's nothing to preserve.
 */

import { RuleDraftSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import * as v from 'valibot';

interface StoredDraft {
  draft: V5.RuleDraft;
  createdAt: number;
  evictionTimer: ReturnType<typeof setTimeout>;
}

const drafts: Map<string, StoredDraft> = new Map();

/** Draft time-to-live in milliseconds. See file-level docs for rationale. */
const DRAFT_TTL_MS = 60_000;

function newNonce(): string {
  // 16 hex chars of randomness is ample for a short-lived single-consume
  // map key. `crypto.getRandomValues` is available in the background SW.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse and stash a rule draft. Returns the nonce the caller should
 * embed in the workspace hash URL. Throws if the draft fails schema
 * validation — callers should surface the error to the user (panel
 * shows a toast) rather than silently open an empty create tab.
 */
export function createRuleDraft(rawDraft: unknown): string {
  const parsed = v.parse(RuleDraftSchema, rawDraft);
  const nonce = newNonce();
  const evictionTimer = setTimeout(() => {
    drafts.delete(nonce);
    logger.debug('RuleDraftStore', `Draft ${nonce} evicted after TTL`);
  }, DRAFT_TTL_MS);
  drafts.set(nonce, {
    draft: parsed,
    createdAt: Date.now(),
    evictionTimer,
  });
  logger.debug('RuleDraftStore', `Draft ${nonce} stashed (${parsed.type})`);
  return nonce;
}

/**
 * Pop the draft for the given nonce. Returns the draft if present,
 * `null` if the nonce is unknown or already consumed. Re-validates
 * before handing back — the schema is cheap and the store is not
 * expected to be immutable from other code, so a second parse is
 * defense-in-depth without being expensive.
 */
export function takeRuleDraft(nonce: string): V5.RuleDraft | null {
  const entry = drafts.get(nonce);
  if (!entry) return null;
  clearTimeout(entry.evictionTimer);
  drafts.delete(nonce);
  try {
    return v.parse(RuleDraftSchema, entry.draft);
  } catch (err) {
    logger.info('RuleDraftStore', `Draft ${nonce} failed re-validation: ${(err as Error).message}`);
    return null;
  }
}

/** Test hook — not used in production, exported for unit tests. */
export function _clearAllDrafts(): void {
  for (const entry of drafts.values()) {
    clearTimeout(entry.evictionTimer);
  }
  drafts.clear();
}
