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

import type { Rule } from '@openheaders/core/types';
import { hostBridge } from '@openheaders/core/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface RuleMirrorEntry {
  rule: Rule;
  /** Map keyed by set path (e.g. `conditions`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for synthesizer-driven writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RuleMirrorListener = (uid: string) => void;

export interface RuleSyncMirror {
  getRuleMirror(uid: string): RuleMirrorEntry | null;
  /** Snapshot of every rule in the mirror — used by cross-entity
   *  cascades (collection / folder delete cascades into descendant
   *  rules) where the caller needs to enumerate by path prefix. */
  listRules(): Rule[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeRuleMirror(uid: string, listener: RuleMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateRuleSyncMirrorOptions = CreateFlatMirrorOptions;

export function createRuleSyncMirror(
  workspaceId: string,
  options: CreateRuleSyncMirrorOptions = {},
): RuleSyncMirror {
  const core = createFlatEntityMirror<RuleMirrorEntry>(
    {
      loggerTag: 'RuleSyncMirror',
      workspaceId,
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
        const resp = await hostBridge.call('oh.sync.snapshotRules', { workspaceId });
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
    listRules: () => core.list().map((e) => e.rule),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeRuleMirror: core.subscribe,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────
//
// Symmetric to the SW data plane's `services: Map<workspaceId,
// WorkspaceServiceState>` (commit 1, sub-commit 1a). Each workspace's
// mirror is independent: its bridge subscription filters by
// `event.envelope.workspaceId` at the shared mirror core (M-2), and
// its bootstrap snapshot is fetched scoped to the workspace via
// `oh.sync.snapshotX, { workspaceId }` (M-1). Cross-workspace
// contamination is structurally inexpressible.

const ruleSyncMirrorRegistry = createWorkspaceMirrorRegistry<RuleSyncMirror>(
  (workspaceId) => createRuleSyncMirror(workspaceId),
);

export function getRuleSyncMirrorForWorkspace(workspaceId: string): RuleSyncMirror {
  return ruleSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeRuleSyncMirrorForWorkspace(workspaceId: string): void {
  ruleSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllRuleSyncMirrors(): void {
  ruleSyncMirrorRegistry.disposeAll();
}
// ── React hook ────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

/**
 * Reactive live-rule subscription for any surface (workbench, popup,
 * panel) — works regardless of whether `<RuleProvider>` is mounted.
 * Reads from the per-workspace rule sync mirror selected by
 * `workspaceId` and re-renders the caller whenever a broadcast lands
 * for the given uid.
 *
 * `workspaceId` MUST be the workspace whose rules the surface is
 * displaying. System surfaces (popup, side-panel, devtools panel) pass
 * the runtime-Active workspaceId via `useActiveWorkspaceId()`; the
 * workbench passes its per-tab editing-scope workspaceId. Resubscribing
 * on `workspaceId` change cleanly switches the underlying mirror
 * subscription.
 *
 * The panel surface deliberately doesn't mount `<RuleProvider>` — it
 * doesn't need the full CRUD / templates / folders surface that
 * provider exposes for the workbench + popup. Panel-side consumers
 * that want a reactive rule MUST use this hook (which talks to the
 * mirror directly), not `useRules()` (which would return the empty
 * default and never update).
 */
export function useLiveRule(
  uid: string | null | undefined,
  workspaceId: string | null,
): Rule | null {
  const [rule, setRule] = useState<Rule | null>(() => {
    if (!uid || !workspaceId) return null;
    return getRuleSyncMirrorForWorkspace(workspaceId).getRuleMirror(uid)?.rule ?? null;
  });
  useEffect(() => {
    if (!uid || !workspaceId) {
      setRule(null);
      return;
    }
    const mirror = getRuleSyncMirrorForWorkspace(workspaceId);
    setRule(mirror.getRuleMirror(uid)?.rule ?? null);
    return mirror.subscribeRuleMirror(uid, () => {
      setRule(mirror.getRuleMirror(uid)?.rule ?? null);
    });
  }, [uid, workspaceId]);
  return rule;
}
