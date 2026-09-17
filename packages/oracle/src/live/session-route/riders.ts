/**
 * The riders of an open session — the seven channels a surface writes
 * into a session its host's executor runs, answered from the
 * host-neutral active-session registries (`ws-exec/session-plane`,
 * `mqtt-exec/session-plane`) by the caller-minted send id: the
 * executor resolves and writes, starts the clean close, or dials the
 * armed reconnect attempt now; a settled or unknown id answers
 * `success: false`. One dispatch for every host that runs a session's
 * executor — the node spine and the web tab through `ws-route.ts` /
 * `mqtt-route.ts`, the extension's page realm through its own hosts —
 * gated by the plane each host answers (the two subsets) or by both.
 */

import type {
  MqttPublishWire,
  MqttSubscriptionWire,
  WsSendBinaryWire,
  WsSendSocketIoWire,
} from '@openheaders/core/bridge';
import {
  closeActiveMqttSession,
  publishActiveMqttMessage,
  reconnectActiveMqttSessionNow,
  setActiveMqttSubscription,
} from '../mqtt-exec/session-plane';
import {
  closeActiveWsSession,
  reconnectActiveWsSessionNow,
  sendActiveWsSessionMessage,
} from '../ws-exec/session-plane';

export const WS_SESSION_RIDER_CHANNELS = ['sendWsMessage', 'closeWsSession', 'reconnectWsSessionNow'] as const;
export const MQTT_SESSION_RIDER_CHANNELS = [
  'publishMqttMessage',
  'setMqttSubscription',
  'closeMqttSession',
  'reconnectMqttSessionNow',
] as const;
export const SESSION_RIDER_CHANNELS = [...WS_SESSION_RIDER_CHANNELS, ...MQTT_SESSION_RIDER_CHANNELS] as const;

export type WsSessionRiderChannel = (typeof WS_SESSION_RIDER_CHANNELS)[number];
export type MqttSessionRiderChannel = (typeof MQTT_SESSION_RIDER_CHANNELS)[number];
export type SessionRiderChannel = (typeof SESSION_RIDER_CHANNELS)[number];

export function isWsSessionRiderChannel(type: unknown): type is WsSessionRiderChannel {
  return typeof type === 'string' && (WS_SESSION_RIDER_CHANNELS as readonly string[]).includes(type);
}

export function isMqttSessionRiderChannel(type: unknown): type is MqttSessionRiderChannel {
  return typeof type === 'string' && (MQTT_SESSION_RIDER_CHANNELS as readonly string[]).includes(type);
}

export function isSessionRiderChannel(type: unknown): type is SessionRiderChannel {
  return isWsSessionRiderChannel(type) || isMqttSessionRiderChannel(type);
}

/** Answer one rider. Only call for channels {@link isSessionRiderChannel} owns. */
export async function dispatchSessionRider(
  type: SessionRiderChannel,
  message: Record<string, unknown>,
): Promise<{ success: boolean; error?: string; grantCode?: number }> {
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  switch (type) {
    case 'sendWsMessage':
      return sendId !== undefined && typeof message.messageText === 'string'
        ? sendActiveWsSessionMessage(
            sendId,
            message.messageText,
            message.socketio as WsSendSocketIoWire | undefined,
            message.binary as WsSendBinaryWire | undefined,
          )
        : { success: false, error: 'No session id or message provided' };
    case 'closeWsSession':
      return { success: sendId !== undefined && closeActiveWsSession(sendId) };
    case 'reconnectWsSessionNow':
      return { success: sendId !== undefined && reconnectActiveWsSessionNow(sendId) };
    case 'publishMqttMessage':
      return sendId !== undefined && message.message !== undefined
        ? publishActiveMqttMessage(sendId, message.message as MqttPublishWire)
        : { success: false, error: 'No session id or message provided' };
    case 'setMqttSubscription':
      return sendId !== undefined && message.subscription !== undefined
        ? setActiveMqttSubscription(sendId, message.subscription as MqttSubscriptionWire)
        : { success: false, error: 'No session id or subscription provided' };
    case 'closeMqttSession':
      return { success: sendId !== undefined && closeActiveMqttSession(sendId) };
    case 'reconnectMqttSessionNow':
      return { success: sendId !== undefined && reconnectActiveMqttSessionNow(sendId) };
  }
}
