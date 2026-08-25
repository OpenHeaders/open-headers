/**
 * Shared data spine of the server-admin domain tabs: the user
 * directory and the SERVER's workspace projection (the server-access
 * plan A6) — every server-scoped list an admin surface renders reads
 * this projection, never the tab's own workspace mirror, which on the
 * served host replicates only what THIS user can read.
 *
 * Each domain tab mounts its own instance: the tabs are independent
 * surfaces and a refresh in one must not thread state through the
 * others.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { useCallback, useEffect, useState } from 'react';

export interface DirectoryUser {
  userId: string;
  // Principal kind as a wire string (the access-foundation plan §8 F3):
  // 'service' marks a machine identity; absent (older server) and any
  // unknown value render as a human row — forward-tolerant, never a
  // refusal, and nothing here enforces.
  kind?: string;
  displayName: string;
  email: string | null;
  gitEmail: string | null;
  createdAt: number;
  deactivatedAt: number | null;
  // Per-user max token `lastUsedAt` (the access-foundation plan
  // decision c) — null = never seen; optional so an older server's
  // projection (no field) renders nothing rather than refusing.
  lastSeenAt?: number | null;
  hasPassword: boolean;
  mayCreateWorkspaces: boolean;
  isDaemonAdmin: boolean;
  admission?: { licenseId: string; status: 'licensed' | 'grace' | 'expired' | 'invalid' };
  // `role` and `origin` are wire strings, wider than the authoring
  // unions: the server projection passes them through verbatim, and the
  // forward-tolerant decode law says an unknown value from a newer
  // server renders verbatim rather than refusing the row.
  grants: ReadonlyArray<{ workspaceId: string; role: string; origin?: string }>;
}

export interface UseServerDirectoryApi {
  users: readonly DirectoryUser[] | null;
  serverWorkspaces: ReadonlyArray<{ id: string; name: string }> | null;
  refresh: () => Promise<void>;
  workspaceName: (id: string) => string;
  workspaceOptions: ReadonlyArray<{ value: string; label: string }>;
}

export function useServerDirectory(enabled: boolean): UseServerDirectoryApi {
  const t = useT();
  const { message } = AntApp.useApp();
  const [serverWorkspaces, setServerWorkspaces] = useState<ReadonlyArray<{ id: string; name: string }> | null>(null);
  const [users, setUsers] = useState<readonly DirectoryUser[] | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [directory, projected] = await Promise.all([
        hostBridge.call('oh.daemon.users.list'),
        hostBridge.call('oh.daemon.workspaces.list'),
      ]);
      setUsers(directory.users);
      setServerWorkspaces(projected.workspaces);
    } catch (err) {
      message.error(t('workbench.serverAdmin.users.loadFailed', { message: (err as Error).message }));
      setUsers([]);
      setServerWorkspaces([]);
    }
  }, [message, t]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const workspaceName = useCallback(
    (id: string): string => serverWorkspaces?.find((w) => w.id === id)?.name ?? id,
    [serverWorkspaces],
  );
  const workspaceOptions = (serverWorkspaces ?? []).map((w) => ({ value: w.id, label: w.name }));

  return { users, serverWorkspaces, refresh, workspaceName, workspaceOptions };
}
