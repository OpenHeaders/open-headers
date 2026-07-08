import { subscribeBackends } from '@openheaders/core/backends';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { handleActivityPruneAlarm, isActivityPruneAlarm } from '../activity-prune-scheduler';
import { handleLiveAlarm, isLiveRefreshAlarm } from '../modules/live-refresh-scheduler';
import { handleOAuthAlarm, isOAuthRefreshAlarm } from '../modules/oauth-refresh-scheduler';
import { handleTotpAlarm, isTotpAlarm } from '../modules/totp-scheduler';
import {
  connectWebSocket,
  getReconnectAttempts,
  isWebSocketConnected,
  isWebSocketConnecting,
  shouldAttemptBackendConnection,
} from '../websocket';
import { backgroundReady } from './background-ready';
import { updateBadgeForCurrentTab } from './badge-update';

const WS_RECONNECT_ALARM = 'wsReconnect';

function applyWsReconnectAlarm(enabled: boolean): void {
  if (enabled) {
    alarms!.create(WS_RECONNECT_ALARM, { periodInMinutes: 0.5 });
  } else {
    alarms!.clear(WS_RECONNECT_ALARM);
  }
}

export function installAlarmDispatch(): void {
  applyWsReconnectAlarm(shouldAttemptBackendConnection());
  alarms!.create('updateBadge', { delayInMinutes: 0.01, periodInMinutes: 0.033 });

  const syncWsReconnectAlarm = (): void => {
    applyWsReconnectAlarm(shouldAttemptBackendConnection());
  };
  // Any registry change re-evaluates whether the safety-net alarm is
  // wanted (enabled / autoConnect live on the primary record now).
  subscribeBackends(syncWsReconnectAlarm);

  alarms!.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === WS_RECONNECT_ALARM) {
      if (!shouldAttemptBackendConnection()) return;
      if (!isWebSocketConnected() && !isWebSocketConnecting()) {
        const attempts = getReconnectAttempts();
        const log = attempts <= 1 ? logger.info : logger.debug;
        log.call(logger, 'Background', 'WebSocket disconnected, reconnecting...');
        try {
          await connectWebSocket();
        } catch (error) {
          logger.debug('Background', 'Failed to reconnect:', (error as Error).message);
        }
      }
      return;
    }
    if (alarm.name === 'updateBadge') {
      void updateBadgeForCurrentTab();
      return;
    }
    // Hydration barrier — live / OAuth / TOTP handlers read in-memory
    // stores populated by hydrateActiveWorkspaceStores. Without this
    // await, an overdue alarm on cold SW wake reads empty stores and
    // permanently cancels itself.
    await backgroundReady;
    if (isOAuthRefreshAlarm(alarm)) {
      await handleOAuthAlarm(alarm);
    } else if (isLiveRefreshAlarm(alarm)) {
      await handleLiveAlarm(alarm);
    } else if (isTotpAlarm(alarm)) {
      await handleTotpAlarm();
    } else if (isActivityPruneAlarm(alarm)) {
      await handleActivityPruneAlarm();
    }
  });
}
