/**
 * Renderer-side environment sync mirror (Phase B).
 *
 * Mirrors `rule-sync-mirror.ts`: subscribes once to the SW's
 * `syncBroadcast` channel and folds every `environmentPostState`
 * payload into a `Map<envId, { environment, varNames }>`. Renderer
 * write helpers read this mirror to build env mutation batches
 * synchronously without a SW round-trip per write (§19.4). On
 * construction the mirror fires a `oh.sync.snapshotEnvironments` RPC
 * so it has a starting view before any broadcast arrives. The
 * subscription is registered first so any concurrent broadcast that
 * lands mid-flight wins.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface EnvironmentMirrorEntry {
  environment: V5.Environment;
  /** Live variable names (set member identity = variable name). */
  varNames: string[];
}

export type EnvironmentMirrorListener = (envId: string) => void;

export interface EnvSyncMirror {
  getEnvironmentMirror(envId: string): EnvironmentMirrorEntry | null;
  /** Live variable names at the env, `[]` when unknown. */
  liveVarNames(envId: string): string[];
  subscribeEnvironmentMirror(envId: string, listener: EnvironmentMirrorListener): () => void;
  dispose(): void;
}

export interface CreateEnvSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createEnvSyncMirror(options: CreateEnvSyncMirrorOptions = {}): EnvSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, EnvironmentMirrorEntry>();
  const listeners = new Map<string, Set<EnvironmentMirrorListener>>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, environmentPostState } = event;
    if (envelope.body.type !== 'environment') return;
    const envId = envelope.body.id;
    seenSinceMount.add(envId);

    if (!environmentPostState) {
      if (entries.delete(envId)) notify(listeners, envId);
      return;
    }

    entries.set(envId, {
      environment: environmentPostState.environment,
      varNames: environmentPostState.varNames,
    });
    notify(listeners, envId);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotEnvironments')
      .then((resp) => {
        for (const entry of resp.entries) {
          const envId = entry.environment.uid;
          if (seenSinceMount.has(envId)) continue;
          entries.set(envId, { environment: entry.environment, varNames: entry.varNames });
          notify(listeners, envId);
        }
      })
      .catch((err: Error) => {
        logger.info('EnvSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getEnvironmentMirror(envId) {
      return entries.get(envId) ?? null;
    },
    liveVarNames(envId) {
      return entries.get(envId)?.varNames ?? [];
    },
    subscribeEnvironmentMirror(envId, listener) {
      let bucket = listeners.get(envId);
      if (!bucket) {
        bucket = new Set();
        listeners.set(envId, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = listeners.get(envId);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) listeners.delete(envId);
      };
    },
    dispose() {
      unsubscribe();
      entries.clear();
      listeners.clear();
    },
  };
}

function notify(listeners: Map<string, Set<EnvironmentMirrorListener>>, envId: string): void {
  const bucket = listeners.get(envId);
  if (!bucket) return;
  for (const l of bucket) {
    try {
      l(envId);
    } catch {
      // Listener errors must not tear down the broadcast pipe.
    }
  }
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
