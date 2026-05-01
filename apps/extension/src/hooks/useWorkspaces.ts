/**
 * useWorkspaces — single source of workspace state for UI surfaces.
 *
 * Reads come straight from the renderer-side ExtensionWorkspace sync
 * mirror (`extension-workspace-sync-mirror.ts`), which subscribes to
 * `oh.sync.snapshotExtensionWorkspaces` + the `extensionWorkspace`
 * post-state broadcast. Writes (create / update / rename / delete /
 * setActive / reorder) go straight to the global oracle via the
 * renderer write client; only `duplicateWorkspace` stays on the bridge
 * because it deep-copies SW-owned per-workspace stores the renderer
 * cannot touch.
 *
 * Every popup / sidepanel / workbench mount calling this hook stays in
 * sync automatically — the mirror's broadcast subscription drives a
 * subscribeMirror tick on every commit.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';
import { getActiveExtensionWorkspaceSyncMirror } from '@/context/extension-workspace-sync-mirror';
import {
  applyCreateWorkspace,
  applyDeleteWorkspace,
  applyRenameWorkspace,
  applyReorderWorkspaces,
  applySetActiveWorkspace,
  applyUpdateWorkspace,
} from '@/shared/sync/extension-workspace-write-client';

const DEFAULT_SURFACE_ID = 'workspace-meta';

/** Result for workspace metadata updates. Sync engine §24 retired the
 *  Phase 10 stale-draft contract; convergence is per-(field) LWW by
 *  arrival order at the global oracle. */
export type WorkspaceUpdateResult =
  | { success: true; workspace: V5.ExtensionWorkspace }
  | { success: false; reason: 'not-found' }
  | { success: false; reason: 'other'; message: string };

export interface UseWorkspacesApi {
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: V5.ExtensionWorkspace | null;
  isReady: boolean;

  createWorkspace: (input: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => Promise<V5.ExtensionWorkspace | null>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  /**
   * Update workspace metadata. Convergence is per-(field) LWW by HLC at
   * the global oracle.
   */
  updateWorkspace: (
    id: string,
    updates: { name?: string; description?: string; color?: string; icon?: string | null },
  ) => Promise<WorkspaceUpdateResult>;
  deleteWorkspace: (id: string) => Promise<{ success: boolean; error?: string; activeWorkspaceId?: string }>;
  duplicateWorkspace: (id: string, name?: string) => Promise<V5.ExtensionWorkspace | null>;
  setActiveWorkspace: (id: string) => Promise<boolean>;
  reorderWorkspaces: (idOrder: string[]) => Promise<boolean>;
}

export interface UseWorkspacesOptions {
  /**
   * Surface attribution for the per-surface HLC sequencer. Defaults to
   * a workspace-meta-wide identifier — workspace-meta writes don't
   * carry awareness so the surfaceId only groups the renderer's HLC.
   * Override only when distinct popup vs. workbench attribution
   * matters (e.g. tests).
   */
  surfaceId?: string;
}

export function useWorkspaces(options: UseWorkspacesOptions = {}): UseWorkspacesApi {
  const surfaceId = options.surfaceId ?? DEFAULT_SURFACE_ID;
  const [workspaces, setWorkspaces] = useState<V5.ExtensionWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const mirror = getActiveExtensionWorkspaceSyncMirror();
    const apply = (): void => {
      setWorkspaces(mirror.liveWorkspaces());
      setActiveWorkspaceId(mirror.liveActiveWorkspaceId());
      const snap = mirror.getMirror();
      if (snap) setIsReady(true);
    };
    apply();
    const unsub = mirror.subscribeMirror(apply);
    return () => {
      unsub();
    };
  }, []);

  const createWorkspace = useCallback<UseWorkspacesApi['createWorkspace']>(
    async (input) => {
      const result = await applyCreateWorkspace(input, { surfaceId });
      return result.ok ? result.workspace : null;
    },
    [surfaceId],
  );

  const renameWorkspace = useCallback(
    async (id: string, name: string) => {
      const result = await applyRenameWorkspace({ id, name }, { surfaceId });
      return result.ok;
    },
    [surfaceId],
  );

  const updateWorkspace = useCallback<UseWorkspacesApi['updateWorkspace']>(
    async (id, updates) => {
      const result = await applyUpdateWorkspace({ id, updates }, { surfaceId });
      if (result.ok) return { success: true, workspace: result.workspace };
      if (result.reason === 'not-found') return { success: false, reason: 'not-found' };
      return { success: false, reason: 'other', message: result.message ?? 'Workspace update failed' };
    },
    [surfaceId],
  );

  const deleteWorkspace = useCallback<UseWorkspacesApi['deleteWorkspace']>(
    async (id) => {
      const result = await applyDeleteWorkspace({ id }, { surfaceId });
      if (result.ok) return { success: true, activeWorkspaceId: result.activeWorkspaceId };
      if (result.reason === 'last-workspace')
        return { success: false, error: 'Cannot delete the last workspace' };
      if (result.reason === 'not-found') return { success: false, error: 'Workspace not found' };
      return { success: false, error: result.message ?? 'Workspace delete failed' };
    },
    [surfaceId],
  );

  const duplicateWorkspace = useCallback<UseWorkspacesApi['duplicateWorkspace']>(async (id, name) => {
    // Stays on the bridge: deep-copies SW-owned per-workspace stores
    // (rule / template / files / etc.) the renderer can't touch.
    const resp = await call('duplicateWorkspace', { id, name }).catch(() => null);
    return resp?.success ? (resp.workspace ?? null) : null;
  }, []);

  const setActiveWorkspace = useCallback(
    async (id: string) => {
      const result = await applySetActiveWorkspace({ id }, { surfaceId });
      return result.ok;
    },
    [surfaceId],
  );

  const reorderWorkspaces = useCallback(
    async (idOrder: string[]) => {
      const result = await applyReorderWorkspaces({ idOrder }, { surfaceId });
      return result.ok;
    },
    [surfaceId],
  );

  const activeWorkspace = activeWorkspaceId ? (workspaces.find((w) => w.id === activeWorkspaceId) ?? null) : null;

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    isReady,
    createWorkspace,
    renameWorkspace,
    updateWorkspace,
    deleteWorkspace,
    duplicateWorkspace,
    setActiveWorkspace,
    reorderWorkspaces,
  };
}
