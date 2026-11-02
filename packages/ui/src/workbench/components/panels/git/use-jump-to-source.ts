/**
 * useJumpToSource — the surface-side half of Jump to Source: run the
 * jump for a path and raise the one notice when nothing opened (the
 * user's own file, or a host without the verb).
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { useCallback } from 'react';
import { jumpToSource } from './git-entity-opener';

export function useJumpToSource(workspaceId: string): (path: string) => void {
  const t = useT();
  const { notification } = AntApp.useApp();
  return useCallback(
    (path: string) => {
      void jumpToSource(workspaceId, path).then((outcome) => {
        if (outcome !== 'opened') {
          notification.info({ title: t('workbench.gitLog.jumpToSource.noEditor', { path }), duration: 5 });
        }
      });
    },
    [workspaceId, notification, t],
  );
}
