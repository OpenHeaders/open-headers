import { logger } from '@utils/logger';
import { get as getSetting, set as setSetting, subscribeKey } from '@/workbench/settings/store';
import { isWebSocketConnected, sendViaWebSocket } from '../websocket';

let syncingFromDesktop = 0;
let initialized = false;

function withInboundGuard(fn: () => void): void {
  syncingFromDesktop++;
  try {
    fn();
  } finally {
    syncingFromDesktop--;
  }
}

export function handleRecordingInboundMessage(msg: Record<string, unknown>): boolean {
  if (msg.type === 'videoRecordingStateChanged' && typeof msg.enabled === 'boolean') {
    withInboundGuard(() => {
      setSetting('recording.videoEnabled', msg.enabled as boolean);
    });
    return true;
  }
  if (msg.type === 'recordingHotkeyResponse' || msg.type === 'recordingHotkeyChanged') {
    withInboundGuard(() => {
      if (typeof msg.hotkey === 'string') setSetting('recording.hotkey', msg.hotkey);
      if (typeof msg.enabled === 'boolean') setSetting('recording.hotkeyEnabled', msg.enabled);
    });
    return true;
  }
  return false;
}

export function requestInitialRecordingSync(): void {
  if (!isWebSocketConnected()) return;
  sendViaWebSocket({ type: 'getVideoRecordingState' });
  sendViaWebSocket({ type: 'getRecordingHotkey' });
}

export function initRecordingSync(): void {
  if (initialized) return;
  initialized = true;

  subscribeKey('recording.videoEnabled', () => {
    if (syncingFromDesktop > 0) return;
    if (!isWebSocketConnected()) return;
    sendViaWebSocket({
      type: 'toggleVideoRecording',
      enabled: getSetting('recording.videoEnabled'),
    });
  });

  subscribeKey('recording.hotkeyEnabled', () => {
    if (syncingFromDesktop > 0) return;
    if (!isWebSocketConnected()) return;
    sendViaWebSocket({
      type: 'toggleRecordingHotkey',
      enabled: getSetting('recording.hotkeyEnabled'),
    });
  });

  logger.info('RecordingSync', 'initialized');
}
