/**
 * Topical group vocabulary of the WebSocket Settings tab — shared by
 * the live knob sections and each row's info-popover kicker, so both
 * read in the same order with the same labels. The Socket.IO group
 * renders on that flavor only.
 */

import type { MessageKey } from '@openheaders/i18n';

export type WsSettingsGroupKey = 'connection' | 'socketio' | 'tls';

export const WS_GROUP_ORDER: WsSettingsGroupKey[] = ['connection', 'socketio', 'tls'];

export const WS_GROUP_LABEL_KEY: Record<WsSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.websocket.settings.group.connection',
  socketio: 'workbench.editors.websocket.settings.group.socketio',
  tls: 'workbench.editors.websocket.settings.group.tls',
};
