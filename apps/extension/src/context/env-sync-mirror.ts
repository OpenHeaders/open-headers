/**
 * Renderer-side environment sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}: extracts
 * `(envId, { environment, varUids })` from each `environmentPostState`
 * payload, hydrates from `oh.sync.snapshotEnvironments` on construction.
 * Renderer write helpers read this mirror to build env mutation batches
 * synchronously without a SW round-trip per write (§19.4).
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface EnvironmentMirrorEntry {
  environment: V5.Environment;
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
  dispose(): void;
}

export type CreateEnvSyncMirrorOptions = CreateFlatMirrorOptions;

export function createEnvSyncMirror(options: CreateEnvSyncMirrorOptions = {}): EnvSyncMirror {
  const core = createFlatEntityMirror<EnvironmentMirrorEntry>(
    {
      loggerTag: 'EnvSyncMirror',
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
        const resp = await call('oh.sync.snapshotEnvironments');
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
    dispose: core.dispose,
  };
}

// ── Module-level singleton ───────────────────────────────────────────

let active: EnvSyncMirror | null = null;

export function getActiveEnvSyncMirror(): EnvSyncMirror {
  if (!active) active = createEnvSyncMirror();
  return active;
}

export function disposeActiveEnvSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
