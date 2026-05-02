/**
 * Renderer-side rule sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Renderer write
 * helpers consult this mirror to:
 *
 *   1. Read the canonical rule shape synchronously, in lockstep with
 *      the oracle (§19.4).
 *   2. Enumerate live `(itemId, orderKey)` pairs at set-modeled paths
 *      (`conditions`, `action.requestHeaders`, `action.responseHeaders`)
 *      for the unified set-diff synthesizer to emit minimum-diff
 *      envelope batches on save.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface RuleMirrorEntry {
  rule: V5.Rule;
  /** Map keyed by set path (e.g. `conditions`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for synthesizer-driven writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RuleMirrorListener = (uid: string) => void;

export interface RuleSyncMirror {
  getRuleMirror(uid: string): RuleMirrorEntry | null;
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeRuleMirror(uid: string, listener: RuleMirrorListener): () => void;
  dispose(): void;
}

export type CreateRuleSyncMirrorOptions = CreateFlatMirrorOptions;

export function createRuleSyncMirror(options: CreateRuleSyncMirrorOptions = {}): RuleSyncMirror {
  const core = createFlatEntityMirror<RuleMirrorEntry>(
    {
      loggerTag: 'RuleSyncMirror',
      extractFromBroadcast: (event) => {
        // Pre-extraction, rule-mirror processed every broadcast (added
        // every uid to seenSinceMount, treated absent rulePostState as
        // tombstone). The shape preserved here matches: any envelope
        // with rulePostState present sets the entry; any without it
        // deletes (delete is no-op for unrelated uids since they were
        // never inserted).
        const { envelope, rulePostState } = event;
        const uid = envelope.body.id;
        if (!rulePostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            rule: rulePostState.rule,
            setItemIds: rulePostState.setItemIds,
            setOrderKeys: rulePostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotRules');
        return resp.entries.map((e) => ({
          uid: e.rule.uid,
          entry: {
            rule: e.rule,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getRuleMirror: core.get,
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeRuleMirror: core.subscribe,
    dispose: core.dispose,
  };
}

// ── Module-level singleton ───────────────────────────────────────────

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

// ── React hook ────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

/**
 * Reactive live-rule subscription for any surface (workbench, popup,
 * panel) — works regardless of whether `<RuleProvider>` is mounted.
 * Reads from the per-surface rule sync mirror singleton (initialized
 * eagerly at boot via `eagerInitRendererMirrors`) and re-renders the
 * caller whenever a broadcast lands for the given uid.
 *
 * The panel surface deliberately doesn't mount `<RuleProvider>` — it
 * doesn't need the full CRUD / templates / folders surface that
 * provider exposes for the workbench + popup. Panel-side consumers
 * that want a reactive rule MUST use this hook (which talks to the
 * mirror directly), not `useRules()` (which would return the empty
 * default and never update).
 */
export function useLiveRule(uid: string | null | undefined): V5.Rule | null {
  const [rule, setRule] = useState<V5.Rule | null>(() => {
    if (!uid) return null;
    return getActiveRuleSyncMirror().getRuleMirror(uid)?.rule ?? null;
  });
  useEffect(() => {
    if (!uid) {
      setRule(null);
      return;
    }
    const mirror = getActiveRuleSyncMirror();
    setRule(mirror.getRuleMirror(uid)?.rule ?? null);
    return mirror.subscribeRuleMirror(uid, () => {
      setRule(mirror.getRuleMirror(uid)?.rule ?? null);
    });
  }, [uid]);
  return rule;
}
