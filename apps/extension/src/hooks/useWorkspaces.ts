/**
 * useWorkspaces — single source of workspace state for UI surfaces.
 *
 * Subscribes to `workspaceChanged` broadcasts so every popup / sidepanel
 * / workspace.html mount stays in sync automatically. Mutations
 * (create / rename / delete / duplicate / setActive / reorder) are
 * thin wrappers over the bridge RPCs; they don't await the broadcast
 * round-trip because the background fires it synchronously from the
 * handler.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';

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
  updateWorkspace: (
    id: string,
    updates: { name?: string; description?: string; color?: string; icon?: string | null },
  ) => Promise<V5.ExtensionWorkspace | null>;
  deleteWorkspace: (id: string) => Promise<{ success: boolean; error?: string; activeWorkspaceId?: string }>;
  duplicateWorkspace: (id: string, name?: string) => Promise<V5.ExtensionWorkspace | null>;
  setActiveWorkspace: (id: string) => Promise<boolean>;
  reorderWorkspaces: (idOrder: string[]) => Promise<boolean>;
}

export function useWorkspaces(): UseWorkspacesApi {
  const [workspaces, setWorkspaces] = useState<V5.ExtensionWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    call('listWorkspaces')
      .then((resp) => {
        if (cancelled) return;
        setWorkspaces(resp.workspaces);
        setActiveWorkspaceId(resp.activeWorkspaceId);
        setIsReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsReady(true);
      });

    const unsub = subscribe('workspaceChanged', (payload) => {
      setWorkspaces(payload.workspaces);
      setActiveWorkspaceId(payload.activeWorkspaceId);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const createWorkspace = useCallback<UseWorkspacesApi['createWorkspace']>(async (input) => {
    const resp = await call('createWorkspace', input).catch(() => null);
    return resp?.success ? (resp.workspace ?? null) : null;
  }, []);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const resp = await call('renameWorkspace', { id, name }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const updateWorkspace = useCallback<UseWorkspacesApi['updateWorkspace']>(async (id, updates) => {
    const resp = await call('updateWorkspace', { id, updates }).catch(() => null);
    return resp?.success ? (resp.workspace ?? null) : null;
  }, []);

  const deleteWorkspace = useCallback<UseWorkspacesApi['deleteWorkspace']>(async (id) => {
    const resp = await call('deleteWorkspace', { id }).catch(() => null);
    if (!resp) return { success: false, error: 'Request failed' };
    return { success: resp.success, error: resp.error, activeWorkspaceId: resp.activeWorkspaceId };
  }, []);

  const duplicateWorkspace = useCallback<UseWorkspacesApi['duplicateWorkspace']>(async (id, name) => {
    const resp = await call('duplicateWorkspace', { id, name }).catch(() => null);
    return resp?.success ? (resp.workspace ?? null) : null;
  }, []);

  const setActiveWorkspace = useCallback(async (id: string) => {
    const resp = await call('setActiveWorkspace', { id }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const reorderWorkspaces = useCallback(async (idOrder: string[]) => {
    const resp = await call('reorderWorkspaces', { idOrder }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

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
