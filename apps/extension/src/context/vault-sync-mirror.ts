/**
 * Renderer-side vault sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Vault is
 * non-syncing in v1 (§12.3); this channel is local-only.
 */

import { VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';

export interface VaultMirrorEntry {
  vault: V5.Vault;
  /** Live secret names. Set member identity is `secret.uid`; this
   *  array is the projected names list. */
  secretNames: string[];
}

export type VaultMirrorListener = () => void;

export interface VaultSyncMirror {
  getMirror(): VaultMirrorEntry | null;
  liveSecretNames(): string[];
  subscribeMirror(listener: VaultMirrorListener): () => void;
  dispose(): void;
}

export type CreateVaultSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createVaultSyncMirror(options: CreateVaultSyncMirrorOptions = {}): VaultSyncMirror {
  const core = createSingletonEntityMirror<VaultMirrorEntry>(
    {
      loggerTag: 'VaultSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, vaultPostState } = event;
        if (envelope.body.type !== VAULT_ENTITY_TYPE) return null;
        if (!vaultPostState) return 'tombstone';
        return { vault: vaultPostState.vault, secretNames: vaultPostState.secretNames };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotVault');
        const first = resp.entries[0];
        return first ? { vault: first.vault, secretNames: first.secretNames } : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveSecretNames: () => core.get()?.secretNames ?? [],
    subscribeMirror: core.subscribe,
    dispose: core.dispose,
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
