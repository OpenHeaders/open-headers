/**
 * Renderer-side script-package sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Packages are fully
 * flat-scalar so there are no set-modeled paths to enumerate.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { SCRIPT_PACKAGE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ScriptPackage } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface ScriptPackageMirrorEntry {
  scriptPackage: ScriptPackage;
}

export type ScriptPackageMirrorListener = (uid: string) => void;

export interface ScriptPackageSyncMirror {
  getScriptPackageMirror(uid: string): ScriptPackageMirrorEntry | null;
  listScriptPackages(): ScriptPackage[];
  subscribeScriptPackageMirror(uid: string, listener: ScriptPackageMirrorListener): () => void;
  subscribeAny(listener: ScriptPackageMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateScriptPackageSyncMirrorOptions = CreateFlatMirrorOptions;

export function createScriptPackageSyncMirror(
  workspaceId: string,
  options: CreateScriptPackageSyncMirrorOptions = {},
): ScriptPackageSyncMirror {
  const core = createFlatEntityMirror<ScriptPackageMirrorEntry>(
    {
      loggerTag: 'ScriptPackageSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, scriptPackagePostState } = event;
        if (!scriptPackagePostState && envelope.body.type !== SCRIPT_PACKAGE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!scriptPackagePostState) return { uid, entry: null };
        return { uid, entry: { scriptPackage: scriptPackagePostState.scriptPackage } };
      },
      fetchSnapshot: async () => {
        const resp = await hostBridge.call('oh.sync.snapshotScriptPackages', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.scriptPackage.uid,
          entry: { scriptPackage: e.scriptPackage },
        }));
      },
    },
    options,
  );
  return {
    getScriptPackageMirror: core.get,
    listScriptPackages: () =>
      core
        .list()
        .map((e) => e.scriptPackage)
        .sort((a, b) => a.name.localeCompare(b.name)),
    subscribeScriptPackageMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const scriptPackageSyncMirrorRegistry = createWorkspaceMirrorRegistry<ScriptPackageSyncMirror>((workspaceId) =>
  createScriptPackageSyncMirror(workspaceId),
);

export function getScriptPackageSyncMirrorForWorkspace(workspaceId: string): ScriptPackageSyncMirror {
  return scriptPackageSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeScriptPackageSyncMirrorForWorkspace(workspaceId: string): void {
  scriptPackageSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllScriptPackageSyncMirrors(): void {
  scriptPackageSyncMirrorRegistry.disposeAll();
}
