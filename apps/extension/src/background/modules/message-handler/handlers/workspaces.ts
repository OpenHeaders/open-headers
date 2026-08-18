/** Workspace listing / duplication / eviction / tab-ordinal RPCs. */

import { evictConsumedWorkspace } from '@openheaders/oracle/workspace/workspace-eviction';
import { duplicateWorkspace as duplicateWorkspaceData } from '../../workspace/workspace-orchestrator';
import { getActiveWorkspace, getActiveWorkspaceId, listWorkspaces } from '../../workspace/workspace-store';
import { ensureWorkspaceTabTracked, ordinalForTab, workspaceTabCount } from '../../workspace/workspace-tab-registry';
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
    // Assign-on-demand (not just read): the asking renderer caches this
    // first answer for its lifetime, and on fresh profiles the RPC can
    // land before the slow init chain wires the tabs listeners — a
    // read-only answer would freeze the tab on `ordinal: null` forever.
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') {
      respond({ ordinal: null, count: workspaceTabCount() });
      return;
    }
    ensureWorkspaceTabTracked(tabId, sender.url)
      .then((ordinal) => respond({ ordinal, count: workspaceTabCount() }))
      .catch(() => respond({ ordinal: ordinalForTab(tabId), count: workspaceTabCount() }));
    return true;
  },
};
