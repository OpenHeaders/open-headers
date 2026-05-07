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
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface VaultMirrorEntry {
  vault: V5.Vault;
  /** Live secret uids. Set member identity is `secret.uid`; this
   *  array is the projected names list. */
  secretUids: string[];
}

export type VaultMirrorListener = () => void;

export interface VaultSyncMirror {
  getMirror(): VaultMirrorEntry | null;
  liveSecretNames(): string[];
  subscribeMirror(listener: VaultMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateVaultSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createVaultSyncMirror(
  workspaceId: string,
  options: CreateVaultSyncMirrorOptions = {},
): VaultSyncMirror {
  const core = createSingletonEntityMirror<VaultMirrorEntry>(
    {
      loggerTag: 'VaultSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, vaultPostState } = event;
        if (envelope.body.type !== VAULT_ENTITY_TYPE) return null;
        if (!vaultPostState) return 'tombstone';
        return { vault: vaultPostState.vault, secretUids: vaultPostState.secretUids };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotVault', { workspaceId });
        const first = resp.entries[0];
        return first ? { vault: first.vault, secretUids: first.secretUids } : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveSecretNames: () => core.get()?.secretUids ?? [],
    subscribeMirror: core.subscribe,
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

const vaultSyncMirrorRegistry = createWorkspaceMirrorRegistry<VaultSyncMirror>(
  (workspaceId) => createVaultSyncMirror(workspaceId),
);

export function getVaultSyncMirrorForWorkspace(workspaceId: string): VaultSyncMirror {
  return vaultSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeVaultSyncMirrorForWorkspace(workspaceId: string): void {
  vaultSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllVaultSyncMirrors(): void {
  vaultSyncMirrorRegistry.disposeAll();
}
