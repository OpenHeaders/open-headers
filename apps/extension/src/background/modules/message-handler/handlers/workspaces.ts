/** Workspace listing / duplication / eviction / tab-ordinal RPCs. */

import { evictConsumedWorkspace } from '@openheaders/oracle/workspace/workspace-eviction';
import { duplicateWorkspace as duplicateWorkspaceData } from '../../workspace/workspace-orchestrator';
import { getActiveWorkspace, getActiveWorkspaceId, listWorkspaces } from '../../workspace/workspace-store';
import { ordinalForTab, workspaceTabCount } from '../../workspace/workspace-tab-registry';
import type { HandlerMap } from '../types';

export const workspaceHandlers: HandlerMap = {
  listWorkspaces: ({ respond }) => {
    respond({ workspaces: listWorkspaces(), activeWorkspaceId: getActiveWorkspaceId() });
  },

  getActiveWorkspace: ({ respond }) => {
    respond({ workspace: getActiveWorkspace() });
  },

  duplicateWorkspace: ({ message, respond }) => {
    duplicateWorkspaceData(message.id as string, {
      name: message.name as string | undefined,
      targetOrgId: message.targetOrgId as string | undefined,
      includeSecrets: message.includeSecrets as boolean | undefined,
    })
      .then((workspace) => {
        if (!workspace) respond({ success: false, error: 'Source workspace not found' });
        else respond({ success: true, workspace });
      })
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  evictWorkspace: ({ message, respond }) => {
    evictConsumedWorkspace(message.workspaceId as string)
      .then((result) => {
        if (result.ok) respond({ success: true });
        else respond({ success: false, error: result.reason });
      })
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  getWorkspaceTabOrdinal: ({ sender, respond }) => {
    const tabId = sender.tab?.id;
    const ordinal = typeof tabId === 'number' ? ordinalForTab(tabId) : null;
    respond({ ordinal, count: workspaceTabCount() });
  },
};
