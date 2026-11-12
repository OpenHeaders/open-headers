/**
 * useJumpToSource — the surface-side half of Jump to Source: open the
 * entity a named row knows, else run the jump for a path, and raise the
 * one notice when nothing opened (the user's own file, or a host
 * without the verb).
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { useCallback } from 'react';
import { type JumpToSourceOutcome, jumpToEntity, jumpToSource } from './git-entity-opener';

/** `path` null — an entity's row that lists several files. */
export type JumpToSource = (path: string | null, entity?: WorkspaceTreeEntityRefWire) => void;

export function useJumpToSource(workspaceId: string): JumpToSource {
  const t = useT();
  const { notification } = AntApp.useApp();
  return useCallback<JumpToSource>(
    (path, entity) => {
      const settle = (outcome: JumpToSourceOutcome): void => {
        if (outcome === 'opened') return;
        const named = path ?? entity?.name ?? '';
        notification.info({ title: t('workbench.gitLog.jumpToSource.noEditor', { path: named }), duration: 5 });
      };
      if (entity !== undefined) settle(jumpToEntity(entity));
      else if (path !== null) void jumpToSource(workspaceId, path).then(settle);
    },
    [workspaceId, notification, t],
  );
}
