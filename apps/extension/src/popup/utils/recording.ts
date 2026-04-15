/**
 * Popup-side recording entrypoints.
 *
 * Goes through the shared bridge like every other cross-context message
 * in the extension — no direct `chrome.runtime.sendMessage` calls.
 */

import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';

interface StartRecordingResult {
  success: boolean;
  recordId: string;
  preNavigation?: boolean;
}

type RecordingStateResult = { isRecording: boolean } & Record<string, unknown>;

const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'file:///',
  'view-source:',
  'data:',
  'blob:',
  'chrome-devtools://',
  'https://ntp.msn.com/edge/ntp',
];

/** Resolve the active tab with a short retry window for transient "tabs cannot be edited" errors. */
async function resolveActiveTab(): Promise<chrome.tabs.Tab> {
  const browserAPI = getBrowserAPI();
  let retries = 3;
  while (retries > 0) {
    try {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) return tabs[0];
      retries -= 1;
    } catch (e) {
      if ((e as Error).message?.includes('Tabs cannot be edited right now')) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries -= 1;
      } else {
        throw e;
      }
    }
  }
  throw new Error('No active tab found');
}

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function makeRecordId(): string {
  return `record-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export async function startRecording(useWidget = false): Promise<StartRecordingResult> {
  const tab = await resolveActiveTab();
  if (typeof tab.id !== 'number') throw new Error('Active tab has no id');

  // Pre-navigation path: the active tab is on a restricted surface
  // (chrome://, about:blank, …) where we cannot inject the content
  // recorder. Start in pre-nav mode so the background begins capturing
  // network events immediately; the widget mounts on the next commit.
  if (isRestrictedUrl(tab.url)) {
    const recordId = makeRecordId();
    const response = await call('START_PRE_NAV_RECORDING', {
      tabId: tab.id,
      recordId,
      targetUrl: null,
      useWidget,
    });
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to start workflow in background');
    }
    return { success: true, recordId: response.recordId ?? recordId, preNavigation: true };
  }

  const response = await call('START_RECORDING', { tabId: tab.id, useWidget });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to start workflow in background');
  }
  return { success: true, recordId: response.recordId ?? makeRecordId() };
}

export async function stopRecording(): Promise<{ success: boolean }> {
  const tab = await resolveActiveTab();
  if (typeof tab.id !== 'number') throw new Error('Active tab has no id');
  const response = await call('STOP_RECORDING', { tabId: tab.id });
  return { success: response.success };
}

export async function getRecordingState(): Promise<RecordingStateResult> {
  try {
    const tab = await resolveActiveTab();
    if (typeof tab.id !== 'number') return { isRecording: false };

    // Background is the single source of truth for recording state. The
    // legacy content-script fallback used to live here for "SW restarted
    // mid-recording" recovery, but the content script never had a
    // receive() handler for GET_RECORDING_STATE, so the fallback always
    // returned `{ success: false }` — it was dead code. The primary
    // path via `GET_TAB_RECORDING_STATE` already handles SW-restart
    // scenarios by re-reading the background's persisted state.
    const response = await call('GET_TAB_RECORDING_STATE', { tabId: tab.id });
    if ('isRecording' in response && response.isRecording) {
      return response as unknown as RecordingStateResult;
    }
    return { isRecording: false };
  } catch (error) {
    logger.info('Recording', 'getRecordingState error:', (error as Error).message);
    return { isRecording: false };
  }
}
