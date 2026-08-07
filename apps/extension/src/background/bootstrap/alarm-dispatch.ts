import { subscribeBackends } from '@openheaders/core/backends';
import {
  connectWebSocket,
  getReconnectAttempts,
  isWebSocketConnected,
  shouldAttemptBackendConnection,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { nativeMessagingAvailable } from '../../shared/nm-handoff';
import { handleActivityPruneAlarm, isActivityPruneAlarm } from '../activity-prune-scheduler';
import { handleLiveAlarm, isLiveRefreshAlarm } from '../modules/live-refresh-scheduler';
import {
  handleNmAutoJoinAlarm,
  isNmAutoJoinAlarm,
  NM_AUTO_JOIN_ALARM,
  NM_AUTO_JOIN_ALARM_PERIOD_MINUTES,
} from '../modules/nm-bootstrap';
import { evaluateNmWatchSentinel } from '../modules/nm-watch-sentinel';
import { handleOAuthAlarm, isOAuthRefreshAlarm } from '../modules/oauth-refresh-scheduler';
import { handleProductTelemetryAlarm, isProductTelemetryAlarm } from '../modules/product-telemetry';
import { handleTotpAlarm, isTotpAlarm } from '../modules/totp-scheduler';
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
  // The slow NM auto-join re-probe — how "installed the desktop AFTER
  // the extension" converges without an SW restart. Browsers without
  // the NM plane never arm it.
  if (nativeMessagingAvailable()) {
    alarms!.create(NM_AUTO_JOIN_ALARM, { periodInMinutes: NM_AUTO_JOIN_ALARM_PERIOD_MINUTES });
  }

  const syncWsReconnectAlarm = (): void => {
    applyWsReconnectAlarm(shouldAttemptBackendConnection());
  };
  // Any registry change re-evaluates whether the safety-net alarm is
  // wanted (enabled / autoConnect live on the primary record now).
  subscribeBackends(syncWsReconnectAlarm);

  alarms!.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === WS_RECONNECT_ALARM) {
      if (!shouldAttemptBackendConnection()) return;
      // `connectWebSocket` ensures every wanted wire; each transport
      // coalesces to a no-op when already live or mid-attempt, so a
      // partially-connected fleet still gets its down wires redialed.
      if (!isWebSocketConnected()) {
        const attempts = getReconnectAttempts();
        const log = attempts <= 1 ? logger.info : logger.debug;
        log.call(logger, 'Background', 'WebSocket disconnected, reconnecting...');
      }
      try {
        await connectWebSocket();
      } catch (error) {
        logger.debug('Background', 'Failed to reconnect:', (error as Error).message);
      }
      // The alarm tick doubles as the watch sentinel's slow retry: it
      // clears the dead-host suppression, so a watch host that died
      // without an up-signal is re-attempted at this cadence at most.
      evaluateNmWatchSentinel({ clearSuppression: true });
      return;
    }
    if (alarm.name === 'updateBadge') {
      void updateBadgeForCurrentTab();
      return;
    }
    // No hydration barrier: the flush reads only the client's own queue.
    if (isProductTelemetryAlarm(alarm)) {
      void handleProductTelemetryAlarm();
      return;
    }
    // Hydration barrier — live / OAuth / TOTP handlers read in-memory
    // stores populated by hydrateActiveWorkspaceStores. Without this
    // await, an overdue alarm on cold SW wake reads empty stores and
    // permanently cancels itself.
    await backgroundReady;
    if (isNmAutoJoinAlarm(alarm)) {
      await handleNmAutoJoinAlarm();
    } else if (isOAuthRefreshAlarm(alarm)) {
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
