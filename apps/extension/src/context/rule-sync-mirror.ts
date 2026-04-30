/**
 * Renderer-side rule sync mirror (Phase A Fw8).
 *
 * Subscribes once to the SW's `syncBroadcast` channel and folds every
 * `rulePostState` payload into a `Map<ruleUid, { rule, setItemIds }>`.
 * Renderer-side write helpers (workbench RuleEditor, popup toggleRule,
 * devpanel inline edit, …) consult this mirror to:
 *
 *   1. Read the canonical rule shape synchronously, in lockstep with
 *      the oracle. The §19.4 synchronous-render discipline forbids
 *      round-tripping per write, so the mirror gives the renderer its
 *      own up-to-date view of the rule.
 *   2. Enumerate live `itemId`s at set-modeled paths (`conditions`,
 *      `action.requestHeaders`, `action.responseHeaders`). Set
 *      replacement requires these — the materialized rule shape strips
 *      them, but `buildUpdateBatch` needs to emit `removeFromSet` per
 *      existing itemId.
 *
 * On construction the mirror fires a `oh.sync.snapshotRules` RPC at
 * the SW so it has a starting view before any broadcast arrives. The
 * subscription is registered first so any concurrent broadcast that
 * lands while the snapshot is in flight wins (broadcast carries fresher
 * post-commit state than the snapshot can). Subsequent broadcasts
 * overwrite per-uid; tombstones drop the entry.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface RuleMirrorEntry {
  rule: V5.Rule;
  /** Map keyed by set path (e.g. `conditions`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for synthesizer-driven writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RuleMirrorListener = (uid: string) => void;

export interface RuleSyncMirror {
  /** Snapshot of the mirrored rule + itemIds at `uid`, or `null` when
   *  the mirror hasn't seen a broadcast for this rule yet. */
  getRuleMirror(uid: string): RuleMirrorEntry | null;
  /** Live itemIds at a set path. Returns `[]` when unknown — the same
   *  shape the SW oracle exposes via `liveSetItems`, so write helpers
   *  can take either. */
  liveSetItems(uid: string, setPath: string): string[];
  /** Live `(itemId, orderKey)` pairs at a set path on the rule, in
   *  canonical sort order. Returns `[]` when unknown. The renderer
   *  write-client feeds these into `synthesizeSetDiff` so save-time
   *  gestures emit the minimum envelope set. */
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  /** Subscribe to changes for one rule. Listener fires after every
   *  broadcast that mutates `uid`. Returns an unsubscribe handle. */
  subscribeRuleMirror(uid: string, listener: RuleMirrorListener): () => void;
  /** Drop the bridge subscription. Idempotent — safe to call multiple
   *  times. After dispose, subsequent reads return null / []. */
  dispose(): void;
}

export interface CreateRuleSyncMirrorOptions {
  /**
   * Seed the mirror from a fresh `oh.sync.snapshotRules` RPC. Defaults
   * to `true` in production; tests that drive only the broadcast path
   * pass `false` so they don't have to mock the RPC.
   */
  bootstrap?: boolean;
}

/**
 * Build a fresh mirror. The renderer constructs one per surface (one
 * per workspace tab, one per popup, …) and tears it down on unmount.
 */
export function createRuleSyncMirror(options: CreateRuleSyncMirrorOptions = {}): RuleSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, RuleMirrorEntry>();
  const listeners = new Map<string, Set<RuleMirrorListener>>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, rulePostState } = event;
    const uid = envelope.body.id;
    seenSinceMount.add(uid);

    // Tombstoned / non-Rule envelopes leave rulePostState undefined.
    // For a Rule delete the entity is gone — drop our mirror entry so
    // a subsequent recreate (with a fresh uid per §7.2) doesn't collide.
    if (!rulePostState) {
      if (entries.delete(uid)) notify(listeners, uid);
      return;
    }

    entries.set(uid, {
      rule: rulePostState.rule,
      setItemIds: rulePostState.setItemIds,
      setOrderKeys: rulePostState.setOrderKeys,
    });
    notify(listeners, uid);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotRules')
      .then((resp) => {
        for (const entry of resp.entries) {
          // A broadcast that landed mid-flight carries fresher
          // post-commit state — defer to it instead of overwriting.
          const uid = entry.rule.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, {
            rule: entry.rule,
            setItemIds: entry.setItemIds,
            setOrderKeys: entry.setOrderKeys,
          });
          notify(listeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('RuleSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getRuleMirror(uid) {
      return entries.get(uid) ?? null;
    },
    liveSetItems(uid, setPath) {
      const entry = entries.get(uid);
      if (!entry) return [];
      return entry.setItemIds[setPath] ?? [];
    },
    liveOrderedSetItems(uid, setPath) {
      const entry = entries.get(uid);
      if (!entry) return [];
      return entry.setOrderKeys[setPath] ?? [];
    },
    subscribeRuleMirror(uid, listener) {
      let bucket = listeners.get(uid);
      if (!bucket) {
        bucket = new Set();
        listeners.set(uid, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = listeners.get(uid);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) listeners.delete(uid);
      };
    },
    dispose() {
      unsubscribe();
      entries.clear();
      listeners.clear();
    },
  };
}

function notify(listeners: Map<string, Set<RuleMirrorListener>>, uid: string): void {
  const bucket = listeners.get(uid);
  if (!bucket) return;
  for (const l of bucket) {
    try {
      l(uid);
    } catch {
      // Listener errors must not tear down the broadcast pipe.
    }
  }
}

// ── Module-level singleton ───────────────────────────────────────────
//
// The mirror is shared across every consumer in a renderer surface —
// `useRuleMutator` builds batches against it; future awareness ribbon
// reads from it. A per-component instance would multiply the bridge
// subscription count without adding any value (the data is the same).

let active: RuleSyncMirror | null = null;

export function getActiveRuleSyncMirror(): RuleSyncMirror {
  if (!active) active = createRuleSyncMirror();
  return active;
}

export function disposeActiveRuleSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
