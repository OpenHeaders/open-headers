/**
 * Renderer-side spec sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}: extracts
 * `(specUid, { spec, setOrderKeys })` from each `specPostState`
 * payload, hydrates from `oh.sync.snapshotSpecs` on construction.
 * `setOrderKeys` carries the live `(itemId, orderKey)` pairs of the
 * one set-modeled path (`files`) so write sites can emit
 * position-preserving file upserts without a SW round-trip.
 */

import { SPEC_ENTITY_TYPE, SPEC_FILES_PATH } from '@openheaders/core/sync';
import type { Spec } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface SpecMirrorEntry {
  spec: Spec;
  /** Per-uid order keys at each set path (the files set, keyed by
   *  `SPEC_FILES_PATH`). Feeds position-preserving file upserts. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type SpecMirrorListener = (specUid: string) => void;

export interface SpecSyncMirror {
  getSpecMirror(specUid: string): SpecMirrorEntry | null;
  listSpecs(): Spec[];
  /** Live `(itemId, orderKey)` pairs for the spec's files set, in
   *  fractional-index order. `[]` when the spec is unknown. */
  liveFileOrderKeys(specUid: string): Array<{ itemId: string; orderKey: string }>;
  subscribeSpecMirror(specUid: string, listener: SpecMirrorListener): () => void;
  subscribeAny(listener: SpecMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateSpecSyncMirrorOptions = CreateFlatMirrorOptions;

export function createSpecSyncMirror(workspaceId: string, options: CreateSpecSyncMirrorOptions = {}): SpecSyncMirror {
  const core = createFlatEntityMirror<SpecMirrorEntry>(
    {
      loggerTag: 'SpecSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, specPostState } = event;
        if (envelope.body.type !== SPEC_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!specPostState) return { uid, entry: null };
        return {
          uid,
          entry: { spec: specPostState.spec, setOrderKeys: specPostState.setOrderKeys },
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotSpecs', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.spec.uid,
          entry: { spec: e.spec, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getSpecMirror: core.get,
    listSpecs: () =>
      core
        .list()
        .map((e) => e.spec)
        .sort((a, b) => a.name.localeCompare(b.name)),
    liveFileOrderKeys: (specUid) => core.get(specUid)?.setOrderKeys[SPEC_FILES_PATH] ?? [],
    subscribeSpecMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const specSyncMirrorRegistry = createWorkspaceMirrorRegistry<SpecSyncMirror>((workspaceId) =>
  createSpecSyncMirror(workspaceId),
);

export function getSpecSyncMirrorForWorkspace(workspaceId: string): SpecSyncMirror {
  return specSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeSpecSyncMirrorForWorkspace(workspaceId: string): void {
  specSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllSpecSyncMirrors(): void {
  specSyncMirrorRegistry.disposeAll();
}
