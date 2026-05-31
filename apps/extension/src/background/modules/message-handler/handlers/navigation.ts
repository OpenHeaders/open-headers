/** Tab / app-launcher + cross-surface navigation RPCs. */

import type { ViewMode } from '@openheaders/core/types';
import { runtime as browserRuntime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { getViewModeController } from '@/background/view-mode/controller';
import { openWorkspaceIntent } from '../../workspace-navigator';
import type { HandlerMap } from '../types';

export const navigationHandlers: HandlerMap = {
  openTab: ({ message, respond }) => {
    tabs.create({ url: message.url as string }, (tab: chrome.tabs.Tab) => {
      if (browserRuntime.lastError) {
        respond({ success: false, error: (browserRuntime.lastError as chrome.runtime.LastError).message });
      } else {
        respond({ success: true, tabId: tab.id });
      }
    });
    return true;
  },

  openWorkspaceIntent: ({ message, respond }) => {
    // Focus-or-create dispatch for cross-surface workspace navigation.
    // Payload is intentionally validated inside the navigator (schema
    // at the boundary); we just forward the raw fields here.
    const payload = message as unknown as {
      intent?: unknown;
      callerContext?: {
        surface?: 'popup' | 'sidepanel' | 'devpanel' | 'workspace';
        callerWindowId?: number;
        callerWorkspaceId?: string;
      };
    };
    openWorkspaceIntent(payload.intent, payload.callerContext ?? {})
      .then((result) => respond(result))
      .catch((err: Error) => respond({ ok: false, reason: err.message }));
    return true;
  },

  switchViewMode: ({ message, sender, respond }) => {
    const next = message.next as ViewMode;
    const source = (message.source as ViewMode | null | undefined) ?? null;
    // Fall back to the message sender's tab/window when the renderer
    // couldn't resolve them itself (sidebar surfaces sometimes can't
    // call `tabs.query` before tear-down).
    const senderWindowId = sender.tab?.windowId;
    const senderTabId = sender.tab?.id;
    const windowId = (message.windowId as number | undefined) ?? senderWindowId;
    const tabId = (message.tabId as number | undefined) ?? senderTabId;
    getViewModeController()
      .switchViewMode(next, source, { windowId, tabId })
      .then((result) => respond({ opened: result.opened }))
      .catch((error: Error) => {
        logger.info('ViewMode', 'switchViewMode rpc failed:', error.message);
        respond({ opened: false });
      });
    return true;
  },

  focusApp: ({ message, respond, ctx }) => {
    if (ctx.isWebSocketConnected()) {
      const sent = ctx.sendViaWebSocket({ type: 'focusApp', navigation: message.navigation as string });
      respond({ success: sent });
    } else {
      respond({ success: false });
    }
  },
};
