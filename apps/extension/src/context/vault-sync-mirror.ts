/**
 * Renderer-side vault sync mirror (Phase B).
 *
 * Mirrors `workspace-variables-sync-mirror.ts` for the singleton vault
 * entity. Subscribes once to the SW's `syncBroadcast` channel and folds
 * every `vaultPostState` payload into a single mutable entry. Renderer
 * write helpers read this mirror to build vault mutation batches
 * synchronously without a SW round-trip per write (§19.4). On
 * construction the mirror fires `oh.sync.snapshotVault` so it has a
 * starting view before any broadcast arrives. The subscription is
 * registered first so any concurrent broadcast that lands mid-flight
 * wins.
 *
 * Vault is non-syncing in v1 (§12.3); this channel is local-only.
 */

import { VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface VaultMirrorEntry {
  vault: V5.Vault;
  /** Live secret names (set member identity = secret name). */
  secretNames: string[];
}

export type VaultMirrorListener = () => void;

export interface VaultSyncMirror {
  getMirror(): VaultMirrorEntry | null;
  /** Live secret names, `[]` when uninitialized. */
  liveSecretNames(): string[];
  subscribeMirror(listener: VaultMirrorListener): () => void;
  dispose(): void;
}

export interface CreateVaultSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createVaultSyncMirror(options: CreateVaultSyncMirrorOptions = {}): VaultSyncMirror {
  const { bootstrap = true } = options;
  let entry: VaultMirrorEntry | null = null;
  const listeners = new Set<VaultMirrorListener>();
  let sawBroadcast = false;

  const notify = (): void => {
    for (const l of listeners) {
      try {
        l();
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, vaultPostState } = event;
    if (envelope.body.type !== VAULT_ENTITY_TYPE) return;
    sawBroadcast = true;

    if (!vaultPostState) {
      if (entry !== null) {
        entry = null;
        notify();
      }
      return;
    }

    entry = {
      vault: vaultPostState.vault,
      secretNames: vaultPostState.secretNames,
    };
    notify();
  });

  if (bootstrap) {
    void call('oh.sync.snapshotVault')
      .then((resp) => {
        if (sawBroadcast) return;
        const first = resp.entries[0];
        if (!first) return;
        entry = {
          vault: first.vault,
          secretNames: first.secretNames,
        };
        notify();
      })
      .catch((err: Error) => {
        logger.info('VaultSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getMirror() {
      return entry;
    },
    liveSecretNames() {
      return entry?.secretNames ?? [];
    },
    subscribeMirror(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entry = null;
      listeners.clear();
    },
  };
}

// ── Module-level singleton ───────────────────────────────────────────

let active: VaultSyncMirror | null = null;

export function getActiveVaultSyncMirror(): VaultSyncMirror {
  if (!active) active = createVaultSyncMirror();
  return active;
}

export function disposeActiveVaultSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
