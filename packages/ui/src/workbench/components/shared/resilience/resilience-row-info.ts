/**
 * Default `(i)` popover content for the session-resilience block's
 * rows — title and summary from the request-settings catalog (the one
 * label vocabulary every editor's block reads), kicker = the host
 * group's label; the idle-timeout summary names the flavor's own
 * default (off on a raw session, the handshake cadence on Socket.IO).
 * An editor with richer copy (the MQTT tab's session card) hands the
 * block its own `rowInfo` and falls back here for the keys it does not
 * cover.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type ResilienceInfoKey =
  | 'autoReconnect'
  | 'reconnectPeriod'
  | 'reconnectMaxAttempts'
  | 'reconnectBackoff'
  | 'idleTimeout'
  | 'heartbeatMessage'
  | 'heartbeatInterval';

/** Which liveness rows the block renders and how the idle deadline
 *  defaults: a raw WebSocket session (idle + heartbeat rows, idle off
 *  by default), a Socket.IO session (idle row only, the handshake
 *  cadence by default), or none (MQTT — keep-alive is the protocol's
 *  own CONNECT knob). */
export type ResilienceLiveness = 'raw' | 'socketio' | 'none';

const TITLE_KEY: Record<ResilienceInfoKey, MessageKey> = {
  autoReconnect: 'workbench.editors.request.settings.autoReconnect',
  reconnectPeriod: 'workbench.editors.request.settings.reconnectPeriod',
  reconnectMaxAttempts: 'workbench.editors.request.settings.reconnectMaxAttempts',
  reconnectBackoff: 'workbench.editors.request.settings.reconnectBackoff',
  idleTimeout: 'workbench.editors.request.settings.idleTimeout',
  heartbeatMessage: 'workbench.editors.request.settings.heartbeatMessage',
  heartbeatInterval: 'workbench.editors.request.settings.heartbeatInterval',
};

const SUMMARY_KEY: Record<Exclude<ResilienceInfoKey, 'idleTimeout'>, MessageKey> = {
  autoReconnect: 'workbench.editors.request.settings.autoReconnectInfo',
  reconnectPeriod: 'workbench.editors.request.settings.reconnectPeriodInfo',
  reconnectMaxAttempts: 'workbench.editors.request.settings.reconnectMaxAttemptsInfo',
  reconnectBackoff: 'workbench.editors.request.settings.reconnectBackoffInfo',
  heartbeatMessage: 'workbench.editors.request.settings.heartbeatMessageInfo',
  heartbeatInterval: 'workbench.editors.request.settings.heartbeatIntervalInfo',
};

export function resilienceRowInfo(
  t: Translate,
  key: ResilienceInfoKey,
  kicker: string,
  liveness: ResilienceLiveness,
): InfoPopoverContent {
  const title = t(TITLE_KEY[key]);
  if (key === 'idleTimeout') {
    return {
      title,
      kicker,
      summary: t(
        liveness === 'socketio'
          ? 'workbench.editors.request.settings.idleTimeoutSocketioInfo'
          : 'workbench.editors.request.settings.idleTimeoutInfo',
      ),
    };
  }
  return { title, kicker, summary: t(SUMMARY_KEY[key]) };
}
