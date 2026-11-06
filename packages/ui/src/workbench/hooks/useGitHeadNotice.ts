/**
 * useGitHeadNotice — the workbench's ear for the client plane's
 * `workspaceGitHeadChanged` broadcast (the git-sync plan §3.5): a
 * backend this workbench consumes a workspace from answered a
 * (re)connect on a different checked-out HEAD than before. The plane
 * already decided the change (once per workspace, never on the first
 * frame); this hook only names it — the workspace from the mirror, the
 * branch from the stamp — in one toast with no action.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getActiveExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { useEffect } from 'react';
import { gitHeadNoticeText } from '../git-head-notice';

export function useGitHeadNotice(): void {
  const t = useT();
  const { message } = AntApp.useApp();
  useEffect(
    () =>
      hostBridge.subscribe('workspaceGitHeadChanged', ({ workspaceId, gitHead }) => {
        const workspace = getActiveExtensionWorkspaceSyncMirror()
          .liveWorkspaces()
          .find((row) => row.id === workspaceId);
        if (!workspace) return;
        const text = gitHeadNoticeText(t, workspace.name, gitHead);
        if (text !== null) void message.info(text);
      }),
    [message, t],
  );
}
