/**
 * Workbench editors — the WebSocket client editor. Wire vocabulary
 * (ws/wss schemes, subprotocol identifiers, AsyncAPI) rides raw
 * inside keyed values.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'WebSocket request not found.',
  'workbench.editors.websocket.urlPlaceholder': 'wss://echo.openheaders.io/socket',
  'workbench.editors.websocket.scheme.wss': 'wss — TLS on. Click to switch to plain ws.',
  'workbench.editors.websocket.scheme.ws': 'ws — plaintext. Click to switch to wss.',
  'workbench.editors.websocket.flavor.raw': 'WebSocket',
  'workbench.editors.websocket.flavor.socketio': 'Socket.IO',
  'workbench.editors.websocket.connect.label': 'Connect',
  'workbench.editors.websocket.connect.disabledPhase':
    'Connecting is not wired up yet — composing, docs, and settings save now; the session plane arrives next.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Message',
  'workbench.editors.websocket.tab.headers': 'Headers',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': 'Settings',
  'workbench.editors.websocket.messagePlaceholder': 'Compose the next message to send…',
  'workbench.editors.websocket.message.formatText': 'Text',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.headers.keyPlaceholder': 'Header name',
  'workbench.editors.websocket.headers.valuePlaceholder': 'Value',
  'workbench.editors.websocket.headers.nodeOnly':
    'Custom handshake headers apply when the session runs on the desktop app or daemon — browsers cannot set them on a WebSocket.',
  'workbench.editors.websocket.params.keyPlaceholder': 'Parameter name',
  'workbench.editors.websocket.params.valuePlaceholder': 'Value',
  'workbench.editors.websocket.spec.selectLabel': 'AsyncAPI spec',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Link an AsyncAPI spec',
  'workbench.editors.websocket.spec.summary': '{servers} servers · {channels} channels · {operations} operations',
  'workbench.editors.websocket.spec.parseFailure': 'Spec did not parse: {message}',
  'workbench.editors.websocket.spec.issues': '{count} spec issues',
  'workbench.editors.websocket.specFooter.using': 'Using {name}',
  'workbench.editors.websocket.specFooter.none': 'No AsyncAPI spec linked',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Subprotocols',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Sec-WebSocket-Protocol offer list, in preference order — the server picks one during the handshake.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Add a subprotocol…',
  'workbench.editors.websocket.settings.timeoutLabel': 'Connect timeout (ms)',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Wall-clock ceiling on the connection handshake. Empty uses the app default.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Default',
  'workbench.editors.websocket.toast.deletedOtherTab': 'This WebSocket request was deleted in another tab.',
  'workbench.editors.websocket.toast.updateFailed': 'Saving the WebSocket request failed',
  'workbench.editors.websocket.toast.updateFailedDetail': 'Saving the WebSocket request failed: {message}',
} as const satisfies Catalog;
