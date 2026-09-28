/**
 * The row label per inheritable knob — the catalog the Settings tabs
 * render their rows under, read back wherever a knob is named OUTSIDE
 * its row (the strips' "Inherited settings" popover listing each knob
 * against the level that supplied it). One knob per name across the
 * kinds, but a few rows word their label per kind (the timeout is a
 * request timeout, a connect timeout, a call timeout) — the kind picks
 * the spelling, the shared catalog covers the rest.
 */

import type { AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import type { InheritableSettingKey } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';

const SHARED_LABEL_KEY: Readonly<Record<InheritableSettingKey, MessageKey>> = {
  httpVersion: 'workbench.editors.request.settings.httpVersion',
  resolveToAddress: 'workbench.editors.request.settings.resolveToAddress',
  proxyMode: 'workbench.editors.request.settings.proxy',
  proxyUrl: 'workbench.editors.request.settings.proxyUrl',
  proxyCredentialRef: 'workbench.editors.request.settings.proxyCredentials',
  unixSocketPath: 'workbench.editors.request.settings.unixSocket',
  sslVerification: 'workbench.editors.request.settings.sslVerification',
  clientCertificateRef: 'workbench.editors.request.settings.clientCertificate',
  tlsMinVersion: 'workbench.editors.request.settings.tlsMin',
  tlsMaxVersion: 'workbench.editors.request.settings.tlsMax',
  tlsCipherSuites: 'workbench.editors.request.settings.tlsCipherSuites',
  sniServerName: 'workbench.editors.request.settings.sni',
  alpnProtocol: 'workbench.editors.mqtt.settings.alpnLabel',
  followRedirects: 'workbench.editors.request.settings.followRedirects',
  maxRedirects: 'workbench.editors.request.settings.maxRedirects',
  followOriginalHttpMethod: 'workbench.editors.request.settings.followOriginalMethod',
  followAuthorizationHeader: 'workbench.editors.request.settings.followAuthHeader',
  credentialsMode: 'workbench.editors.request.settings.sendBrowserCookies',
  cookieJar: 'workbench.editors.request.settings.cookieJar',
  timeoutMs: 'workbench.editors.request.settings.timeout',
  maxResponseBytes: 'workbench.editors.request.settings.responseSizeLimit',
  maxMessageBytes: 'workbench.editors.request.settings.maxMessageSize',
  autoReconnect: 'workbench.editors.request.settings.autoReconnect',
  reconnectPeriodMs: 'workbench.editors.request.settings.reconnectPeriod',
  reconnectMaxAttempts: 'workbench.editors.request.settings.reconnectMaxAttempts',
  reconnectBackoff: 'workbench.editors.request.settings.reconnectBackoff',
  idleTimeoutMs: 'workbench.editors.request.settings.idleTimeout',
  heartbeatMessage: 'workbench.editors.request.settings.heartbeatMessage',
  heartbeatIntervalMs: 'workbench.editors.request.settings.heartbeatInterval',
  handshakePath: 'workbench.editors.websocket.settings.handshakePathLabel',
  socketioProtocol: 'workbench.editors.websocket.settings.socketioProtocolLabel',
  ackTimeoutMs: 'workbench.editors.websocket.settings.ackTimeoutLabel',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartLabel',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveLabel',
  sessionExpiryInterval: 'workbench.editors.mqtt.settings.sessionExpiryLabel',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumLabel',
  maximumPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeLabel',
  topicAliasMaximum: 'workbench.editors.mqtt.settings.topicAliasMaximumLabel',
  requestResponseInformation: 'workbench.editors.mqtt.settings.requestResponseInfoLabel',
  requestProblemInformation: 'workbench.editors.mqtt.settings.requestProblemInfoLabel',
  keepaliveIntervalMs: 'workbench.editors.grpc.settings.keepaliveIntervalLabel',
  keepaliveTimeoutMs: 'workbench.editors.grpc.settings.keepaliveTimeoutLabel',
};

/** The rows a kind words differently from the shared catalog. */
const KIND_LABEL_KEY: { readonly [K in AuthProtocolKind]?: Partial<Record<InheritableSettingKey, MessageKey>> } = {
  websocket: {
    timeoutMs: 'workbench.editors.websocket.settings.timeoutLabel',
    unixSocketPath: 'workbench.editors.websocket.settings.unixSocketLabel',
  },
  mqtt: { timeoutMs: 'workbench.editors.mqtt.settings.timeoutLabel' },
  grpc: {
    timeoutMs: 'workbench.editors.grpc.settings.timeoutLabel',
    unixSocketPath: 'workbench.editors.grpc.settings.unixSocketLabel',
  },
};

/** The label key of `key`'s row on `kind`'s Settings tab. */
export function settingLabelKey(kind: AuthProtocolKind, key: InheritableSettingKey): MessageKey {
  return KIND_LABEL_KEY[kind]?.[key] ?? SHARED_LABEL_KEY[key];
}
