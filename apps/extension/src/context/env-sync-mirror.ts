/**
 * Renderer-side environment sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}: extracts
 * `(envId, { environment, varUids })` from each `environmentPostState`
 * payload, hydrates from `oh.sync.snapshotEnvironments` on construction.
 * Renderer write helpers read this mirror to build env mutation batches
 * synchronously without a SW round-trip per write (§19.4).
 */

import type { Environment } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface EnvironmentMirrorEntry {
  environment: Environment;
  /** Live variable uids. Set member identity is `variable.uid`; this
   *  array is the projected names list (used by the resolver + DNR
   *  recompile dependency tracking). */
  varUids: string[];
}

export type EnvironmentMirrorListener = (envId: string) => void;

export interface EnvSyncMirror {
  getEnvironmentMirror(envId: string): EnvironmentMirrorEntry | null;
  /** Live variable uids at the env, `[]` when unknown. */
  liveVarNames(envId: string): string[];
  subscribeEnvironmentMirror(envId: string, listener: EnvironmentMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateEnvSyncMirrorOptions = CreateFlatMirrorOptions;

export function createEnvSyncMirror(
  workspaceId: string,
  options: CreateEnvSyncMirrorOptions = {},
): EnvSyncMirror {
  const core = createFlatEntityMirror<EnvironmentMirrorEntry>(
    {
      loggerTag: 'EnvSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, environmentPostState } = event;
        if (envelope.body.type !== 'environment') return null;
        const uid = envelope.body.id;
        if (!environmentPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            environment: environmentPostState.environment,
            varUids: environmentPostState.varUids,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotEnvironments', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.environment.uid,
          entry: { environment: e.environment, varUids: e.varUids },
        }));
      },
    },
    options,
  );
  return {
    getEnvironmentMirror: core.get,
    liveVarNames: (envId) => core.get(envId)?.varUids ?? [],
    subscribeEnvironmentMirror: core.subscribe,
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

const envSyncMirrorRegistry = createWorkspaceMirrorRegistry<EnvSyncMirror>(
  (workspaceId) => createEnvSyncMirror(workspaceId),
);

export function getEnvSyncMirrorForWorkspace(workspaceId: string): EnvSyncMirror {
  return envSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeEnvSyncMirrorForWorkspace(workspaceId: string): void {
  envSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllEnvSyncMirrors(): void {
  envSyncMirrorRegistry.disposeAll();
}
