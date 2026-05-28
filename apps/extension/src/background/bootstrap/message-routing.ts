import { logger } from '@utils/logger';
import { runtime } from '@utils/browser-api';
import { markTabForDelayBypass } from '../dnr-manager';
import { handleGeneralMessage } from '../modules/message-handler';
import { revalidateTrackedRequests } from '../modules/request-tracker';
import { scheduleUpdate } from '../modules/rule-engine';
import { isWebSocketConnected, sendViaWebSocket } from '../websocket';
import { debouncedUpdateBadge } from './badge-update';

export function installMessageRouting(): void {
  runtime.onMessage.addListener(
    (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
      const msg = message as Record<string, unknown>;

      if (msg.type === 'oh-delay-bypass') {
        const tabId = sender.tab?.id;
        const target = typeof msg.target === 'string' ? msg.target : null;
        if (typeof tabId === 'number' && tabId >= 0 && target) {
          markTabForDelayBypass(tabId, target)
            .then(() => {
              try {
                sendResponse({ ok: true });
              } catch {
                /* channel closed */
              }
            })
            .catch((e: Error) => {
              logger.error('Background', 'Delay bypass failed:', e.message);
              try {
                sendResponse({ ok: false });
              } catch {
                /* channel closed */
              }
            });
          return true;
        }
        try {
          sendResponse({ ok: false });
        } catch {
          /* channel closed */
        }
        return false;
      }

      return handleGeneralMessage(msg, sender, sendResponse, {
        isWebSocketConnected,
        sendViaWebSocket,
        scheduleUpdate,
        revalidateTrackedRequests,
        updateBadgeCallback: debouncedUpdateBadge,
      });
    },
  );
}
