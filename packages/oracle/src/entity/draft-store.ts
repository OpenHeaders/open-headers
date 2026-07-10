/**
 * Draft store factory — single-consume in-memory map of schema-validated
 * pre-fill payloads handed from one surface to another (devpanel CTA →
 * workbench editor). Each instance owns its own map; the payload schema
 * and a log label are the only per-instance knobs.
 *
 * ## Lifecycle
 *
 *   1. The producing surface builds a draft payload.
 *   2. It calls `create(payload)` over the bridge. The store parses the
 *      payload through its valibot schema, mints a random nonce, stores
 *      `{ draft, createdAt }` under the nonce, arms a 60-second eviction
 *      timer, and returns the nonce.
 *   3. The producer opens the workbench with a `draft-<nonce>` intent.
 *   4. The workbench's intent router calls `take(nonce)`. The store
 *      re-validates (defense-in-depth: the map could have been written
 *      to directly by a future feature), removes the entry, cancels the
 *      timer, and returns the draft.
 *
 * ## Why single-consume
 *
 * A draft is a one-shot pre-fill intent — the user clicked a CTA once,
 * and a single workbench tab opens in response. Consuming on `take`
 * means:
 *
 *   - a reload of the workbench tab lands on an empty create form (not
 *     the stale pre-fill), matching the user's "I'm past that starting
 *     state now" mental model
 *   - concurrent takes (two tabs somehow racing on the same nonce)
 *     resolve cleanly: exactly one gets the draft, the other gets null
 *   - memory pressure from stale drafts is bounded by the TTL even if
 *     the user never opens the workbench tab at all
 *
 * ## TTL
 *
 * 60 seconds is long enough to cover normal navigation (panel click →
 * `tabs.create` → workbench boot → intent router → `take`) with plenty
 * of slack for slow machines, and short enough that a forgotten draft
 * doesn't linger through sleep/wake cycles.
 *
 * Note: stores are in-memory only. A background service-worker eviction
 * drops all pending drafts, which is the correct behavior — the user
 * would be looking at a dead hash nonce after SW eviction regardless,
 * so there's nothing to preserve.
 */

import { logger } from '@openheaders/core/utils';
import * as v from 'valibot';

interface StoredDraft<T> {
  draft: T;
  createdAt: number;
  evictionTimer: ReturnType<typeof setTimeout>;
}

/** Draft time-to-live in milliseconds. See file-level docs for rationale. */
const DRAFT_TTL_MS = 60_000;

function newNonce(): string {
  // 16 hex chars of randomness is ample for a short-lived single-consume
  // map key. `crypto.getRandomValues` is available in the background SW.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface DraftStore<T> {
  /**
   * Parse and stash a draft. Returns the nonce the caller should embed
   * in the workbench intent. Throws if the draft fails schema
   * validation — callers should surface the error to the user rather
   * than silently open an empty create tab.
   */
  create(rawDraft: unknown): string;
  /**
   * Pop the draft for the given nonce. Returns the draft if present,
   * `null` if the nonce is unknown or already consumed. Re-validates
   * before handing back — the schema is cheap and the store is not
   * expected to be immutable from other code, so a second parse is
   * defense-in-depth without being expensive.
   */
  take(nonce: string): T | null;
  /** Test hook — not used in production, exported for unit tests. */
  clear(): void;
}

export function createDraftStore<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  label: string,
): DraftStore<v.InferOutput<TSchema>> {
  type T = v.InferOutput<TSchema>;
  const drafts: Map<string, StoredDraft<T>> = new Map();

  return {
    create(rawDraft: unknown): string {
      const parsed = v.parse(schema, rawDraft);
      const nonce = newNonce();
      const evictionTimer = setTimeout(() => {
        drafts.delete(nonce);
        logger.debug(label, `Draft ${nonce} evicted after TTL`);
      }, DRAFT_TTL_MS);
      drafts.set(nonce, {
        draft: parsed,
        createdAt: Date.now(),
        evictionTimer,
      });
      logger.debug(label, `Draft ${nonce} stashed`);
      return nonce;
    },

    take(nonce: string): T | null {
      const entry = drafts.get(nonce);
      if (!entry) return null;
      clearTimeout(entry.evictionTimer);
      drafts.delete(nonce);
      try {
        return v.parse(schema, entry.draft);
      } catch (err) {
        logger.info(label, `Draft ${nonce} failed re-validation: ${(err as Error).message}`);
        return null;
      }
    },

    clear(): void {
      for (const entry of drafts.values()) {
        clearTimeout(entry.evictionTimer);
      }
      drafts.clear();
    },
  };
}
