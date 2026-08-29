/**
 * `(i)` info-popover content for the WebSocket editor's Settings-tab
 * knobs and group headers — kicker (the group), title (the row's own
 * label), and the knob's copy as the summary. The TLS & trust rows
 * read the shared block's copy. No example card yet:
 * the protocol's handshake card is its own surface when it lands,
 * never a leg on the MQTT session card.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { WS_GROUP_LABEL_KEY, type WsSettingsGroupKey } from './settings-groups';

export type WsInfoKey = 'subprotocols' | 'unixSocket' | 'timeout' | 'handshakePath' | 'namespace';

const TITLE_KEY: Record<WsInfoKey, MessageKey> = {
  subprotocols: 'workbench.editors.websocket.settings.subprotocolsLabel',
  unixSocket: 'workbench.editors.websocket.settings.unixSocketLabel',
  timeout: 'workbench.editors.websocket.settings.timeoutLabel',
  handshakePath: 'workbench.editors.websocket.settings.handshakePathLabel',
  namespace: 'workbench.editors.websocket.settings.namespaceLabel',
};

const SUMMARY_KEY: Record<WsInfoKey, MessageKey> = {
  subprotocols: 'workbench.editors.websocket.settings.subprotocolsHelp',
  unixSocket: 'workbench.editors.websocket.settings.unixSocketHelp',
  timeout: 'workbench.editors.websocket.settings.timeoutHelp',
  handshakePath: 'workbench.editors.websocket.settings.handshakePathHelp',
  namespace: 'workbench.editors.websocket.settings.namespaceHelp',
};

const KICKER_GROUP: Record<WsInfoKey, WsSettingsGroupKey> = {
  subprotocols: 'connection',
  unixSocket: 'connection',
  timeout: 'connection',
  handshakePath: 'socketio',
  namespace: 'socketio',
};

const GROUP_SUMMARY_KEY: Record<WsSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.websocket.settings.groupInfo.connection',
  socketio: 'workbench.editors.websocket.settings.groupInfo.socketio',
  tls: 'workbench.editors.websocket.settings.groupInfo.tls',
};

/** Popover content for a Settings-tab group header. */
export function wsSettingsGroupInfo(t: Translate, group: WsSettingsGroupKey): InfoPopoverContent {
  return {
    title: t(WS_GROUP_LABEL_KEY[group]),
    kicker: t('workbench.editors.websocket.tab.settings'),
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one WebSocket knob. */
export function wsSettingsRowInfo(t: Translate, infoKey: WsInfoKey): InfoPopoverContent {
  return {
    title: t(TITLE_KEY[infoKey]),
    kicker: t(WS_GROUP_LABEL_KEY[KICKER_GROUP[infoKey]]),
    summary: t(SUMMARY_KEY[infoKey]),
  };
}
