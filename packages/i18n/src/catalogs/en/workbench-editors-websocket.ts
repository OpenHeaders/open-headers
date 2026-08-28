/**
 * Workbench editors — the WebSocket client editor. Wire vocabulary
 * (ws/wss schemes, subprotocol identifiers, AsyncAPI) rides raw
 * inside keyed values.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'WebSocket request not found.',
  'workbench.editors.websocket.connect.label': 'Connect',
  'workbench.editors.websocket.connect.disconnect': 'Disconnect',
  'workbench.editors.websocket.connect.cancel': 'Cancel',
  'workbench.editors.websocket.connect.browserHost': 'WebSocket sessions run on the desktop app or server.',
  'workbench.editors.websocket.connect.needsUrl': 'Enter a ws:// or wss:// URL to connect.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Message',
  'workbench.editors.websocket.tab.events': 'Events',
  'workbench.editors.websocket.tab.auth': 'Authorization',
  'workbench.editors.websocket.tab.headers': 'Headers',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': 'Settings',
  'workbench.editors.websocket.messagePlaceholder': 'Compose the next message to send…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'Base64 of the binary message, e.g. aGVsbG8=…',
  'workbench.editors.websocket.messagePlaceholderHex': 'Hex of the binary message, e.g. 68656c6c6f…',
  'workbench.editors.websocket.message.formatText': 'Text',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'Binary',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Hexadecimal',
  'workbench.editors.websocket.message.invalidGate': 'Fix the message encoding first.',
  'workbench.editors.websocket.message.invalidBase64': 'Not valid Base64 — the decoded bytes are what would be sent.',
  'workbench.editors.websocket.message.invalidHex': 'Not valid hex — pairs of 0-9 a-f digits decode to the sent bytes.',
  'workbench.editors.websocket.auth.helpRaw':
    'Sent as an Authorization: Bearer header on the handshake — applies on the desktop app or server; browsers cannot set it on a WebSocket. An explicit Authorization header row takes precedence.',
  'workbench.editors.websocket.auth.helpSocketio':
    'Sent as the CONNECT packet’s auth payload ({"token": …}) on every host, and as an Authorization: Bearer handshake header on the desktop app or server. An explicit Authorization header row takes precedence over the header.',
  'workbench.editors.websocket.events.hint':
    'Incoming events to show in the session timeline. With no rows, every event shows; the capture always records everything.',
  'workbench.editors.websocket.events.namePlaceholder': 'Event name',
  'workbench.editors.websocket.events.listenLabel': 'Listen',
  'workbench.editors.websocket.event.namePlaceholder': 'Event name',
  'workbench.editors.websocket.event.ackLabel': 'Expect ack',
  'workbench.editors.websocket.event.ackHelp':
    'Mint an acknowledgement id with each Send so the server’s ack reply correlates in the timeline.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Compose the JSON arguments array, e.g. ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': 'Remove argument {index}',
  'workbench.editors.websocket.event.argPlaceholder': 'Compose this argument as JSON, e.g. "hello" or {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': 'Header name',
  'workbench.editors.websocket.headers.valuePlaceholder': 'Value',
  'workbench.editors.websocket.headers.hint.host':
    'Derived from the target URL at connect time — the host the upgrade request is addressed to.',
  'workbench.editors.websocket.headers.hint.connection':
    'Asks the server to switch protocols; a WebSocket opening handshake always carries Connection: Upgrade.',
  'workbench.editors.websocket.headers.hint.upgrade':
    'Names the protocol to switch to — every WebSocket handshake upgrades the HTTP connection to websocket.',
  'workbench.editors.websocket.headers.hint.key':
    'A random nonce generated for each connection; the server proves it read the handshake by echoing a hash of it in Sec-WebSocket-Accept.',
  'workbench.editors.websocket.headers.hint.version':
    'The WebSocket protocol version (RFC 6455); 13 is the only version in use.',
  'workbench.editors.websocket.headers.hint.extensions':
    'Offers per-message compression; the server may accept, narrow or ignore the offer in its handshake response.',
  'workbench.editors.websocket.headers.hint.origin':
    'The page origin the browser stamps on every WebSocket handshake; servers use it to refuse cross-site connections.',
  'workbench.editors.websocket.headers.hint.userAgent':
    'The browser identifies itself on the handshake; page code cannot change it.',
  'workbench.editors.websocket.headers.hint.cacheControl': 'The browser marks the upgrade request uncacheable.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'The content encodings the browser accepts on the handshake response.',
  'workbench.editors.websocket.headers.hint.acceptLanguage':
    'The browser’s preferred languages, taken from its settings.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'The node runtime’s handshake accepts any response media type.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage': 'The node runtime’s handshake sends a wildcard.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'Stamped by the node runtime on every WebSocket handshake.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'The node runtime identifies this app on the handshake. Add your own User-Agent row to send a different one.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'The node runtime marks the upgrade request uncacheable.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'The content encodings the node runtime accepts on the handshake response.',
  'workbench.editors.websocket.headers.browserNotSent':
    'Not sent — the browser sets the handshake headers itself. Custom headers apply when the session runs on the desktop app or server.',
  'workbench.editors.websocket.spec.selectLabel': 'AsyncAPI spec',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Link an AsyncAPI spec',
  'workbench.editors.websocket.spec.summary': '{servers} servers · {channels} channels · {operations} operations',
  'workbench.editors.websocket.spec.parseFailure': 'Spec did not parse: {message}',
  'workbench.editors.websocket.spec.issues': '{count} spec issues',
  'workbench.editors.websocket.spec.useExample': 'Use example message…',
  'workbench.editors.websocket.spec.browser.hint': 'Pick a message to compose its example payload.',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.specFooter.using': 'Using {name}',
  'workbench.editors.websocket.specFooter.none': 'No AsyncAPI spec linked',
  'workbench.editors.websocket.settings.group.connection': 'Connection',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS & trust',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'How the handshake opens the session: the subprotocols it offers, where the connection dials, and the ceiling on the open.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'How the Socket.IO CONNECT addresses the server: the namespace the session joins.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'How wss: sessions establish trust: whether the server certificate is verified against the system roots.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Subprotocols',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Sec-WebSocket-Protocol offer list, in preference order — the server picks one during the handshake.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'None (default)',
  'workbench.editors.websocket.settings.subprotocolsExample': 'e.g. graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Unix socket',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Dial this local socket — an absolute Unix socket path, or a Windows named pipe like \\\\.\\pipe\\name — instead of opening a TCP connection. The URL keeps deciding the handshake Host, TLS server name, and certificate verification; only where the connection goes changes. Leave empty for a normal TCP connection.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'TCP connection (default)',
  'workbench.editors.websocket.settings.timeoutLabel': 'Connect timeout',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Wall-clock ceiling on the connection handshake only — an open session has no ceiling. Empty sets no deadline.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'No limit (default)',
  'workbench.editors.websocket.settings.namespaceLabel': 'Namespace',
  'workbench.editors.websocket.settings.namespaceHelp':
    'The namespace the session connects to — empty connects to the root /. Sessions dial the websocket transport directly; there is no long-polling fallback.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (default)',
  'workbench.editors.websocket.settings.namespaceExample': 'e.g. /admin',
  'workbench.editors.websocket.settings.sslVerifyLabel': 'SSL certificate verification',
  'workbench.editors.websocket.settings.sslVerifyHelp':
    'Verify the server certificate against the system roots for wss: sessions. Turn off for self-signed development servers. Applies on the desktop app or server.',
  'workbench.editors.websocket.settings.sslVerifyWarning':
    'Sessions skip the server identity check — any certificate is accepted, including self-signed and expired ones.',
  'workbench.editors.websocket.toast.deletedOtherTab': 'This WebSocket request was deleted in another tab.',
  'workbench.editors.websocket.toast.updateFailed': 'Saving the WebSocket request failed',
  'workbench.editors.websocket.toast.updateFailedDetail': 'Saving the WebSocket request failed: {message}',
  'workbench.editors.websocket.toast.savedExample': 'Saved example {name}',
  'workbench.editors.websocket.toast.saveExampleFailed': 'Saving the example failed',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': 'Saving the example failed: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'Response',
  'workbench.editors.websocket.session.emptyHint': 'Connect to send and receive messages.',
  'workbench.editors.websocket.session.connectFailed': 'Opening the session failed',
  'workbench.editors.websocket.session.connectingBadge': 'Connecting',
  'workbench.editors.websocket.session.connectedBadge': 'Connected',
  'workbench.editors.websocket.session.closedTag': 'Closed {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Stopped',
  'workbench.editors.websocket.session.disconnectedTag': 'Disconnected',
  'workbench.editors.websocket.session.connectFailedTag': 'Connect failed',
  'workbench.editors.websocket.session.abortedTag': 'Aborted',
  'workbench.editors.websocket.session.noCloseFrame': 'Connection ended without a Close frame',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Send',
  'workbench.editors.websocket.session.saveResponse': 'Save Response',
  'workbench.editors.websocket.session.sendIdle': 'Connect to send messages.',
  'workbench.editors.websocket.session.sendFailed': 'Sending the message failed',
  'workbench.editors.websocket.session.hostNotice':
    'Running on the browser socket — {knobs} do not apply on this host.',
  'workbench.editors.websocket.session.knobHeaders': 'custom handshake headers',
  'workbench.editors.websocket.session.knobSslVerify': 'disabled SSL verification',
  'workbench.editors.websocket.session.knobAuth': 'the bearer credential header',
  'workbench.editors.websocket.session.handshakeNone': 'None negotiated',
  'workbench.editors.websocket.session.handshakeNote':
    'The platform socket exposes only the negotiated subprotocol and extensions — the 101 response headers are not available to clients.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Connecting',
  'workbench.editors.websocket.timeline.connected': 'Connected',
  'workbench.editors.websocket.timeline.disconnected': 'Disconnected',
  'workbench.editors.websocket.timeline.stopped': 'Stopped',
  'workbench.editors.websocket.timeline.aborted': 'Connection aborted',
  'workbench.editors.websocket.timeline.noMatches': 'No messages match the filter.',
  'workbench.editors.websocket.timeline.connectedTo': 'Connected to {url}',
  'workbench.editors.websocket.timeline.copyMessage': 'Copy message',
  'workbench.editors.websocket.saved.title': 'Saved messages',
  'workbench.editors.websocket.saved.addTooltip': 'Save the current compose as a reusable message',
  'workbench.editors.websocket.saved.showRail': 'Show saved messages',
  'workbench.editors.websocket.saved.hideRail': 'Hide saved messages',
  'workbench.editors.websocket.saved.emptyHint': 'Save messages to reuse them during an active connection.',
  'workbench.editors.websocket.saved.defaultName': 'Message',
  'workbench.editors.websocket.saved.sendTooltip': 'Send this saved message as stored',
  'workbench.editors.websocket.saved.rename': 'Rename',
  'workbench.editors.websocket.saved.duplicate': 'Duplicate',
  'workbench.editors.websocket.saved.delete': 'Delete',
  'workbench.editors.websocket.timeline.saveMessage': 'Save message',
  'workbench.editors.websocket.timeline.info.label': 'Message details',
  'workbench.editors.websocket.timeline.info.size': 'Size',
  'workbench.editors.websocket.timeline.info.time': 'Time',
  'workbench.editors.websocket.timeline.info.frame': 'Frame',
  'workbench.editors.websocket.timeline.info.frameText': 'Text',
  'workbench.editors.websocket.timeline.info.frameBinary': 'Binary',
  'workbench.editors.websocket.timeline.couldNotConnect': 'Could not connect to {url}',
  'workbench.editors.websocket.timeline.errorLabel': 'Error',
  'workbench.editors.websocket.timeline.disconnectedFrom': 'Disconnected from {url}',
  'workbench.editors.websocket.timeline.handshakeDetails': 'Handshake Details',
  'workbench.editors.websocket.timeline.requestUrl': 'Request URL',
  'workbench.editors.websocket.timeline.requestMethod': 'Request Method',
  'workbench.editors.websocket.timeline.statusCode': 'Status Code',
  'workbench.editors.websocket.timeline.requestHeaders': 'Request Headers',
  'workbench.editors.websocket.timeline.responseHeaders': 'Response Headers',
  'workbench.editors.websocket.timeline.keyGenerated': '<generated by the socket>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'The session was stopped from this app.',
  'workbench.editors.websocket.timeline.closeCode.unknown': 'No registered meaning — an application or private code.',
  'workbench.editors.websocket.timeline.closeCode.1000': 'Connection was closed successfully.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'The endpoint is going away — a server shutdown or a page navigation.',
  'workbench.editors.websocket.timeline.closeCode.1002':
    'The endpoint terminated the connection over a protocol error.',
  'workbench.editors.websocket.timeline.closeCode.1003': 'The endpoint received data of a type it cannot accept.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'No status code was present in the Close frame.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'The connection dropped without a Close frame.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'A message carried data inconsistent with its type, such as invalid UTF-8 in a text frame.',
  'workbench.editors.websocket.timeline.closeCode.1008': 'A message violated the endpoint’s policy.',
  'workbench.editors.websocket.timeline.closeCode.1009': 'A message was too big for the endpoint to process.',
  'workbench.editors.websocket.timeline.closeCode.1010':
    'The server did not negotiate an extension the client required.',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'The server met an unexpected condition and could not fulfil the request.',
  'workbench.editors.websocket.timeline.closeCode.1012': 'The server is restarting.',
  'workbench.editors.websocket.timeline.closeCode.1013': 'The server is overloaded — try again later.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'A gateway or proxy received an invalid response from the upstream server.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'The TLS handshake failed.',
  'workbench.editors.websocket.timeline.searchMessages': 'Search messages',
  'workbench.editors.websocket.timeline.messageCount': '{count} messages',
  'workbench.editors.websocket.timeline.dropped': '{count} older messages rolled off the capture',
  'workbench.editors.websocket.timeline.filterAll': 'All',
  'workbench.editors.websocket.timeline.filterSent': 'Sent',
  'workbench.editors.websocket.timeline.filterReceived': 'Received',
  'workbench.editors.websocket.timeline.newestFirst': 'Newest first',
  'workbench.editors.websocket.timeline.oldestFirst': 'Oldest first',
  'workbench.editors.websocket.timeline.sortOrder': 'Sort and group',
  'workbench.editors.websocket.timeline.groupByDirection': 'Group by direction',
  'workbench.editors.websocket.timeline.groupByEvent': 'Group by event',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'Rows per group',
  'workbench.editors.websocket.timeline.noLimit': 'No limit',
  'workbench.editors.websocket.timeline.clearMessages': 'Clear messages',
  'workbench.editors.websocket.timeline.newMessages': 'New messages',
  'workbench.editors.websocket.timeline.binaryMessage': 'Binary message ({bytes} bytes)',
  'workbench.editors.websocket.timeline.sentAria': 'Sent',
  'workbench.editors.websocket.timeline.receivedAria': 'Received',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': 'Binary attachment frame ({count} attachments)',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': 'Loading example…',
  'workbench.editors.wsExample.notFound': 'This example is gone — it may have been deleted in another tab.',
  'workbench.editors.wsExample.openInRequest': 'Open in Request',
  'workbench.editors.wsExample.openInRequestTooltip':
    'Open the parent WebSocket request with this captured shape as unsaved edits.',
  'workbench.editors.wsExample.capturedTooltip': 'Captured {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'This example was deleted in another tab.',
  'workbench.editors.wsExample.toast.saveFailed': 'Saving the example failed',
  'workbench.editors.wsExample.toast.saveFailedDetail': 'Saving the example failed: {message}',
} as const satisfies Catalog;
