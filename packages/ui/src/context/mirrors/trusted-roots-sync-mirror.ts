/**
 * Renderer-side trusted-roots sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror} for the
 * workspace trust list (the Trusted Roots plan). Public material —
 * the mirror carries the full list; the editor drafts against it and
 * the write client commits the Save as one set diff.
 */

import { TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_PATH } from '@openheaders/core/sync';
import type { TrustedRoot, TrustedRoots } from '@openheaders/core/types';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { type CreateSingletonMirrorOptions, createSingletonEntityMirror } from './singleton-entity-mirror';
import { callSnapshotRpc } from './snapshot-rpc';

export interface TrustedRootsMirrorEntry {
  trustedRoots: TrustedRoots;
  rootUids: string[];
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type TrustedRootsMirrorListener = () => void;

export interface TrustedRootsSyncMirror {
  getMirror(): TrustedRootsMirrorEntry | null;
  /** Live rows in materialized order; `[]` when the singleton is unknown. */
  liveRoots(): TrustedRoot[];
  /** Persisted fractional-index keys of the roots set — the
   *  replacement diff reuses them so unmoved rows stay byte-stable. */
  liveRootOrderKeys(): Array<{ itemId: string; orderKey: string }>;
  subscribeMirror(listener: TrustedRootsMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateTrustedRootsSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createTrustedRootsSyncMirror(
  workspaceId: string,
  options: CreateTrustedRootsSyncMirrorOptions = {},
): TrustedRootsSyncMirror {
  const core = createSingletonEntityMirror<TrustedRootsMirrorEntry>(
    {
      loggerTag: 'TrustedRootsSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, trustedRootsPostState } = event;
        if (envelope.body.type !== TRUSTED_ROOTS_ENTITY_TYPE) return null;
        if (!trustedRootsPostState) return 'tombstone';
        return {
          trustedRoots: trustedRootsPostState.trustedRoots,
          rootUids: trustedRootsPostState.rootUids,
          setOrderKeys: trustedRootsPostState.setOrderKeys,
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotTrustedRoots', { workspaceId });
        const first = resp.entries[0];
        return first
          ? { trustedRoots: first.trustedRoots, rootUids: first.rootUids, setOrderKeys: first.setOrderKeys }
          : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveRoots: () => core.get()?.trustedRoots.roots ?? [],
    liveRootOrderKeys: () => core.get()?.setOrderKeys[TRUSTED_ROOTS_PATH] ?? [],
    subscribeMirror: core.subscribe,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const trustedRootsSyncMirrorRegistry = createWorkspaceMirrorRegistry<TrustedRootsSyncMirror>((workspaceId) =>
  createTrustedRootsSyncMirror(workspaceId),
);

export function getTrustedRootsSyncMirrorForWorkspace(workspaceId: string): TrustedRootsSyncMirror {
  return trustedRootsSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeTrustedRootsSyncMirrorForWorkspace(workspaceId: string): void {
  trustedRootsSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllTrustedRootsSyncMirrors(): void {
  trustedRootsSyncMirrorRegistry.disposeAll();
}
