/**
 * Renderer-side ExtensionWorkspace sync mirror.
 *
 * Singleton-shaped — the global oracle holds one ExtensionWorkspace
 * entity (id = `EXTENSION_WORKSPACE_ID`) carrying the workspace list as
 * an ordered set + the active-id scalar. The mirror exposes a flat
 * `{ workspaces, activeWorkspaceId, orderKeys }` view so renderer-direct
 * write paths can mint `keyBetween` / preserve existing keys without
 * round-tripping the SW.
 *
 * Bootstrap: `oh.sync.snapshotExtensionWorkspaces` returns one entry
 * (the singleton) at the global scope; the snapshot row is the same
 * shape the broadcast carries.
 *
 * NOT YET WIRED INTO CALL SITES — the scaffold lands ahead of the
 * `useWorkspaces.ts` migration. Until callers flip, this mirror
 * coexists with the bridge-RPC path and is harmless overhead.
 */

import { EXTENSION_WORKSPACE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';

export interface ExtensionWorkspaceMirrorEntry {
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  /** Per-id fractional-indexing key. Absent ids inherit a fresh tail key. */
  orderKeys: Record<string, string>;
}

export type ExtensionWorkspaceMirrorListener = () => void;

export interface ExtensionWorkspaceSyncMirror {
  getMirror(): ExtensionWorkspaceMirrorEntry | null;
  /** Convenience reader — empty list when the mirror hasn't bootstrapped. */
  liveWorkspaces(): V5.ExtensionWorkspace[];
  /** Convenience reader — `null` until bootstrap completes. */
  liveActiveWorkspaceId(): string | null;
  /** Lookup the live order key for a given workspace id, or `undefined`. */
  liveOrderKey(id: string): string | undefined;
  subscribeMirror(listener: ExtensionWorkspaceMirrorListener): () => void;
  dispose(): void;
}

export type CreateExtensionWorkspaceSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createExtensionWorkspaceSyncMirror(
  options: CreateExtensionWorkspaceSyncMirrorOptions = {},
): ExtensionWorkspaceSyncMirror {
  const core = createSingletonEntityMirror<ExtensionWorkspaceMirrorEntry>(
    {
      loggerTag: 'ExtensionWorkspaceSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, extensionWorkspacePostState } = event;
        if (envelope.body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return null;
        if (!extensionWorkspacePostState) return 'tombstone';
        return {
          workspaces: extensionWorkspacePostState.workspaces,
          activeWorkspaceId: extensionWorkspacePostState.activeWorkspaceId,
          orderKeys: extensionWorkspacePostState.orderKeys,
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotExtensionWorkspaces');
        const first = resp.entries[0];
        return first
          ? {
              workspaces: first.workspaces,
              activeWorkspaceId: first.activeWorkspaceId,
              orderKeys: first.orderKeys,
            }
          : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveWorkspaces: () => core.get()?.workspaces ?? [],
    liveActiveWorkspaceId: () => core.get()?.activeWorkspaceId ?? null,
    liveOrderKey: (id) => core.get()?.orderKeys[id],
    subscribeMirror: core.subscribe,
    dispose: core.dispose,
  };
}

// ── Module-level singleton ───────────────────────────────────────────

let active: ExtensionWorkspaceSyncMirror | null = null;

export function getActiveExtensionWorkspaceSyncMirror(): ExtensionWorkspaceSyncMirror {
  if (!active) active = createExtensionWorkspaceSyncMirror();
  return active;
}

export function disposeActiveExtensionWorkspaceSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
