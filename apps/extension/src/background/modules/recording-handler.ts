/**
 * Recording message handler.
 *
 * All cross-context recording messages flow through the shared bridge,
 * so the handler only needs to switch on `message.type`. There is no
 * legacy `message.action` path — every caller (popup, content script,
 * widget) sends through `bridge.call(...)` which sets `type`.
 */

import type { WorkflowRecordingPayload } from '@openheaders/core';
import { cookies, downloads, tabs } from '@utils/browser-api.js';
import { logger } from '@utils/logger';
import type { SendResponse } from '@/types/browser';
import type { IRecordingService } from '@/types/recording';

/**
 * Dispatch recording messages. Returns `true` when the handler took
 * ownership of the message (and will call `sendResponse` either sync or
 * async), `false` when the message isn't one this handler owns.
 *
 * Routing is delegated to the `switch` below — the set of handled
 * types is the set of `case` labels, no duplicate runtime registry to
 * keep in sync.
 */
export function handleRecordingMessage(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
  recordingService: IRecordingService,
  sendRecordingViaWebSocket: (recording: WorkflowRecordingPayload) => boolean,
): boolean | undefined {
  const type = typeof message.type === 'string' ? message.type : '';
  if (!type) return false;

  switch (type) {
    case 'START_RECORDING':
      recordingService
        .startRecording(message.tabId as number, { useWidget: message.useWidget !== false })
        .then((recording) =>
          sendResponse({
            success: true,
            recordId: recording.id,
            isPreNav: recording.status === 'pre_navigation',
          }),
        )
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'START_PRE_NAV_RECORDING': {
      const tabId = message.tabId as number;
      const useWidget = message.useWidget !== false;
      recordingService
        .startRecording(tabId, { useWidget })
        .then((recording) => sendResponse({ success: true, recordId: recording.id }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'STOP_RECORDING':
      recordingService
        .stopRecording(message.tabId as number)
        .then((recording) => sendResponse({ success: true, recording }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'STOP_RECORDING_FROM_WIDGET': {
      const widgetTabId = sender.tab?.id;
      if (typeof widgetTabId !== 'number') {
        sendResponse({ success: false, error: 'No tab ID available' });
        return true;
      }
      recordingService
        .stopRecording(widgetTabId, { fromWidget: true })
        .then((recording) => sendResponse({ success: true, recording }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'CANCEL_RECORDING': {
      const cancelTabId = (message.tabId as number | undefined) ?? sender.tab?.id;
      if (typeof cancelTabId !== 'number') {
        sendResponse({ success: false, error: 'No tab ID available' });
        return true;
      }
      recordingService
        .stopRecording(cancelTabId)
        .then(() => sendResponse({ success: true }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'GET_RECORDING_STATE':
    case 'GET_TAB_RECORDING_STATE': {
      const fromContentScript = message.fromContentScript === true;
      const tabId =
        fromContentScript && sender.tab?.id !== undefined ? sender.tab.id : (message.tabId as number | undefined);
      if (typeof tabId !== 'number') {
        sendResponse({ isRecording: false });
        return true;
      }
      const isRecording = recordingService.isRecording(tabId);
      const state = recordingService.getRecordingState(tabId);
      sendResponse({
        isRecording,
        recordId: state.metadata?.recordingId,
        ...state,
      });
      return true;
    }

    case 'CONTENT_SCRIPT_READY': {
      const readyTabId = sender.tab?.id;
      if (typeof readyTabId !== 'number') {
        sendResponse({ success: false, error: 'No tab ID' });
        return true;
      }
      recordingService
        .handleContentScriptReady(readyTabId, (message.payload as unknown) ?? {})
        .then((response) => sendResponse(response))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'QUERY_RECORDING_STATE': {
      const payload = message.payload as { tabId?: number } | undefined;
      const queryTabId = sender.tab?.id ?? payload?.tabId;
      if (typeof queryTabId !== 'number') {
        sendResponse({ success: false, error: 'No tab ID' });
        return true;
      }
      sendResponse(recordingService.getRecordingState(queryTabId));
      return true;
    }

    case 'RECORDING_DATA': {
      const dataTabId = sender.tab?.id;
      const payload = message.payload as
        | { timestamp: number; type: string; url: string; data?: Record<string, unknown> }
        | undefined;
      if (typeof dataTabId !== 'number' || !payload) {
        sendResponse({ success: false, error: 'No tab ID or payload' });
        return true;
      }
      recordingService.addEvent(dataTabId, {
        timestamp: payload.timestamp,
        type: payload.type,
        url: payload.url,
        data: payload.data,
      });
      sendResponse({ success: true });
      return true;
    }

    case 'DOWNLOAD_WORKFLOW':
      downloads?.download({
        url: message.url as string,
        filename: message.filename as string,
        saveAs: true,
      });
      sendResponse({ success: true });
      return true;

    case 'SEND_WORKFLOW_TO_APP': {
      logger.info('RecordingHandler', 'Received SEND_WORKFLOW_TO_APP message');
      const success = sendRecordingViaWebSocket(message.recording as WorkflowRecordingPayload);
      logger.info('RecordingHandler', 'sendRecordingViaWebSocket returned:', success);
      sendResponse({ success, error: success ? null : 'App not connected' });
      return true;
    }

    case 'GET_ALL_COOKIES': {
      const cookieTabId = (message.tabId as number | undefined) ?? sender.tab?.id;
      if (typeof cookieTabId !== 'number') {
        sendResponse({ success: false, error: 'No tab ID available' });
        return true;
      }
      tabs.get(cookieTabId, (tab: chrome.tabs.Tab) => {
        if (!tab?.url) {
          sendResponse({ success: false, error: 'Could not get tab URL' });
          return;
        }
        const url = new URL(tab.url);
        cookies?.getAll({}, (allCookies: chrome.cookies.Cookie[]) => {
          const relevant = allCookies.filter((cookie) => {
            const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
            return url.hostname.includes(cookieDomain) || cookieDomain.includes(url.hostname);
          });
          // Structured-clone through JSON to strip XrayWrapper wrappers on Firefox.
          const serialized = JSON.parse(JSON.stringify(relevant)) as chrome.cookies.Cookie[];
          sendResponse({ success: true, cookies: serialized });
        });
      });
      return true;
    }

    case 'RESTORE_BADGE_STATE': {
      const badgeTabId = message.tabId as number;
      tabs.get(badgeTabId, (tab: chrome.tabs.Tab) => {
        if (!tab) {
          sendResponse({ success: false });
          return;
        }
        sendResponse({
          success: true,
          needsBadgeUpdate: !recordingService.isRecording(badgeTabId),
        });
      });
      return true;
    }

    default:
      return false;
  }
}
