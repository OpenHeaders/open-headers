/**
 * Renderer-side template sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Renderer write
 * helpers consult this mirror to read the canonical template shape
 * synchronously (§19.4) and to enumerate live `(itemId, orderKey)`
 * pairs at the set-modeled `conditions` path for the unified set-diff
 * synthesizer.
 */

import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Template } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface TemplateMirrorEntry {
  template: Template;
  /** Map keyed by set path (e.g. `conditions`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for synthesizer-driven writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type TemplateMirrorListener = (uid: string) => void;

export interface TemplateSyncMirror {
  getTemplateMirror(uid: string): TemplateMirrorEntry | null;
  listTemplates(): Template[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeTemplateMirror(uid: string, listener: TemplateMirrorListener): () => void;
  subscribeAny(listener: TemplateMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateTemplateSyncMirrorOptions = CreateFlatMirrorOptions;

export function createTemplateSyncMirror(
  workspaceId: string,
  options: CreateTemplateSyncMirrorOptions = {},
): TemplateSyncMirror {
  const core = createFlatEntityMirror<TemplateMirrorEntry>(
    {
      loggerTag: 'TemplateSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, templatePostState } = event;
        if (!templatePostState && envelope.body.type !== TEMPLATE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!templatePostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            template: templatePostState.template,
            setItemIds: templatePostState.setItemIds,
            setOrderKeys: templatePostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotTemplates', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.template.uid,
          entry: {
            template: e.template,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getTemplateMirror: core.get,
    listTemplates: () =>
      core
        .list()
        .map((e) => e.template)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeTemplateMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
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

const templateSyncMirrorRegistry = createWorkspaceMirrorRegistry<TemplateSyncMirror>((workspaceId) =>
  createTemplateSyncMirror(workspaceId),
);

export function getTemplateSyncMirrorForWorkspace(workspaceId: string): TemplateSyncMirror {
  return templateSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeTemplateSyncMirrorForWorkspace(workspaceId: string): void {
  templateSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllTemplateSyncMirrors(): void {
  templateSyncMirrorRegistry.disposeAll();
}
