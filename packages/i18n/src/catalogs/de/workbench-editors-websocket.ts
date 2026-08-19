/**
 * Workbench editors — the WebSocket client editor, German. Extends the
 * de register contract (`de/shared.ts`). Wire vocabulary rides raw
 * inside keyed values: ws/wss schemes, subprotocol identifiers,
 * AsyncAPI, der Handshake, der Frame (editors-rule law), das Event
 * (streams precedent — Events tab + listen table), das Ack (prose;
 * the sio row `ack` stays verbatim wire), `Arg`, `Bearer-Token` /
 * `Token`, Socket.IO / CONNECT / engine.io tokens, long-polling, das
 * Array. The Params tab stays raw; Settings tab = Einstellungen (S58
 * law); Docs raw; Zeitverlauf = timeline; die Erfassung = capture;
 * prägen = mint. The spec-browser section headers mirror AsyncAPI
 * document keywords and ride raw (spec outline law); prose says
 * Kanäle / Operationen (editors-spec donors, parsen). Quoted mints:
 * tab Autorisierung / Header (request editor twins), Senden, Antwort
 * speichern, Verbinden / Trennen, toast idiom «konnte nicht …
 * werden» (grpc donors). MINTS: die Sitzung = the live WS session;
 * Lauschen = the Listen column; das Subprotokoll.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'WebSocket-Anfrage nicht gefunden.',
  'workbench.editors.websocket.urlPlaceholder': 'wss://echo.openheaders.com/socket',
  'workbench.editors.websocket.scheme.wss': 'wss — TLS an. Klicke, um zu ws im Klartext zu wechseln.',
  'workbench.editors.websocket.scheme.ws': 'ws — Klartext. Klicke, um zu wss zu wechseln.',
  'workbench.editors.websocket.flavor.raw': 'WebSocket',
  'workbench.editors.websocket.flavor.socketio': 'Socket.IO',
  'workbench.editors.websocket.connect.label': 'Verbinden',
  'workbench.editors.websocket.connect.disconnect': 'Trennen',
  'workbench.editors.websocket.connect.browserHost': 'WebSocket-Sitzungen laufen in der Desktop-App oder im Server.',
  'workbench.editors.websocket.connect.needsUrl': 'Gib eine ws://- oder wss://-URL ein, um dich zu verbinden.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Nachricht',
  'workbench.editors.websocket.tab.events': 'Events',
  'workbench.editors.websocket.tab.auth': 'Autorisierung',
  'workbench.editors.websocket.tab.headers': 'Header',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': 'Einstellungen',
  'workbench.editors.websocket.messagePlaceholder': 'Verfasse die nächste zu sendende Nachricht…',
  'workbench.editors.websocket.message.formatText': 'Text',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.auth.typeLabel': 'Typ',
  'workbench.editors.websocket.auth.typeNone': 'Keine Auth',
  'workbench.editors.websocket.auth.typeBearer': 'Bearer-Token',
  'workbench.editors.websocket.auth.tokenLabel': 'Token',
  'workbench.editors.websocket.auth.tokenPlaceholder': 'Token oder {{variable}}',
  'workbench.editors.websocket.auth.helpRaw':
    'Wird beim Handshake als Header Authorization: Bearer gesendet — gilt in der Desktop-App oder im Server; ' +
    'Browser können ihn auf einem WebSocket nicht setzen. Eine explizite Authorization-Header-Zeile hat Vorrang.',
  'workbench.editors.websocket.auth.helpSocketio':
    'Wird auf jedem Host als auth-Payload des CONNECT-Pakets ({"token": …}) gesendet und in der Desktop-App ' +
    'oder im Server als Handshake-Header Authorization: Bearer. Eine explizite Authorization-Header-Zeile hat ' +
    'Vorrang vor dem Header.',
  'workbench.editors.websocket.events.hint':
    'Eingehende Events, die im Zeitverlauf der Sitzung angezeigt werden. Ohne Zeilen wird jedes Event ' +
    'angezeigt; die Erfassung zeichnet immer alles auf.',
  'workbench.editors.websocket.events.namePlaceholder': 'Event-Name',
  'workbench.editors.websocket.events.listenLabel': 'Lauschen',
  'workbench.editors.websocket.event.namePlaceholder': 'Event-Name',
  'workbench.editors.websocket.event.ackLabel': 'Ack erwarten',
  'workbench.editors.websocket.event.ackHelp':
    'Prägt mit jedem Senden eine Acknowledgement-ID, damit sich die Ack-Antwort des Servers im Zeitverlauf ' +
    'zuordnen lässt.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Verfasse das Array der JSON-Argumente, z. B. ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': 'Argument {index} entfernen',
  'workbench.editors.websocket.event.argPlaceholder':
    'Verfasse dieses Argument als JSON, z. B. "hello" oder {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': 'Header-Name',
  'workbench.editors.websocket.headers.valuePlaceholder': 'Wert',
  'workbench.editors.websocket.headers.nodeOnly':
    'Benutzerdefinierte Handshake-Header gelten, wenn die Sitzung in der Desktop-App oder im Server läuft — ' +
    'Browser können sie auf einem WebSocket nicht setzen.',
  'workbench.editors.websocket.params.keyPlaceholder': 'Parametername',
  'workbench.editors.websocket.params.valuePlaceholder': 'Wert',
  'workbench.editors.websocket.spec.selectLabel': 'AsyncAPI-Spezifikation',
  'workbench.editors.websocket.spec.selectPlaceholder': 'AsyncAPI-Spezifikation verknüpfen',
  'workbench.editors.websocket.spec.summary': '{servers} Server · {channels} Kanäle · {operations} Operationen',
  'workbench.editors.websocket.spec.parseFailure': 'Die Spezifikation ließ sich nicht parsen: {message}',
  'workbench.editors.websocket.spec.issues': '{count} Probleme in der Spezifikation',
  'workbench.editors.websocket.spec.useExample': 'Beispielnachricht verwenden…',
  'workbench.editors.websocket.spec.browser.hint': 'Wähle eine Nachricht, um ihre Beispiel-Payload zu verfassen.',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.specFooter.using': 'Verwendet {name}',
  'workbench.editors.websocket.specFooter.none': 'Keine AsyncAPI-Spezifikation verknüpft',
  'workbench.editors.websocket.settings.sslVerifyLabel': 'SSL-Zertifikatsprüfung',
  'workbench.editors.websocket.settings.sslVerifyHelp':
    'Prüft das Serverzertifikat für wss:-Sitzungen gegen die Systemwurzeln. Schalte es für selbstsignierte ' +
    'Entwicklungsserver aus. Gilt in der Desktop-App oder im Server.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Subprotokolle',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Die Sec-WebSocket-Protocol-Angebotsliste, in bevorzugter Reihenfolge — der Server wählt eines während ' +
    'des Handshakes.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Subprotokoll hinzufügen…',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Unix-Socket',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Wählt dieses lokale Socket an — einen absoluten Unix-Socket-Pfad oder eine benannte Windows-Pipe wie ' +
    '\\\\.\\pipe\\name — statt eine TCP-Verbindung zu öffnen. Die URL bestimmt weiterhin den ' +
    'Handshake-Host, den TLS-Servernamen und die Zertifikatsprüfung; nur wohin die Verbindung geht, ändert ' +
    'sich. Leer lassen für eine normale TCP-Verbindung.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'Kein Socket — TCP-Verbindung',
  'workbench.editors.websocket.settings.timeoutLabel': 'Verbindungs-Zeitlimit (ms)',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Obergrenze der realen Zeit für den Verbindungs-Handshake. Leer verwendet den App-Standard.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Standard',
  'workbench.editors.websocket.settings.namespaceLabel': 'Socket.IO-Namespace',
  'workbench.editors.websocket.settings.namespaceHelp':
    'Der Namespace, mit dem sich die Sitzung verbindet — leer verbindet mit der Wurzel /. Sitzungen wählen ' +
    'direkt den websocket-Transport; es gibt keinen Fallback auf long-polling.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/',
  'workbench.editors.websocket.toast.deletedOtherTab': 'Diese WebSocket-Anfrage wurde in einem anderen Tab gelöscht.',
  'workbench.editors.websocket.toast.updateFailed': 'WebSocket-Anfrage konnte nicht gespeichert werden',
  'workbench.editors.websocket.toast.updateFailedDetail':
    'WebSocket-Anfrage konnte nicht gespeichert werden: {message}',
  'workbench.editors.websocket.toast.savedExample': 'Beispiel „{name}“ gespeichert',
  'workbench.editors.websocket.toast.saveExampleFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.title': 'Sitzung',
  'workbench.editors.websocket.session.emptyHint':
    'Verbinde dich, um die Sitzung zu starten — Nachrichten erscheinen hier live.',
  'workbench.editors.websocket.session.connectFailed': 'Die Sitzung konnte nicht geöffnet werden',
  'workbench.editors.websocket.session.connectingBadge': 'VERBINDET',
  'workbench.editors.websocket.session.connectedBadge': 'VERBUNDEN',
  'workbench.editors.websocket.session.tab.timeline': 'Nachrichten',
  'workbench.editors.websocket.session.tab.handshake': 'Handshake',
  'workbench.editors.websocket.session.closedTag': 'Geschlossen {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Gestoppt',
  'workbench.editors.websocket.session.noCloseFrame': 'Die Verbindung endete ohne Close-Frame',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Senden',
  'workbench.editors.websocket.session.saveResponse': 'Antwort speichern',
  'workbench.editors.websocket.session.sendIdle': 'Verbinde dich, um Nachrichten zu senden.',
  'workbench.editors.websocket.session.sendFailed': 'Die Nachricht konnte nicht gesendet werden',
  'workbench.editors.websocket.session.hostNotice':
    'Läuft auf dem Browser-Socket — {knobs} gelten auf diesem Host nicht.',
  'workbench.editors.websocket.session.knobHeaders': 'benutzerdefinierte Handshake-Header',
  'workbench.editors.websocket.session.knobSslVerify': 'die deaktivierte SSL-Prüfung',
  'workbench.editors.websocket.session.knobAuth': 'der Bearer-Zugangsdaten-Header',
  'workbench.editors.websocket.session.handshakeProtocol': 'Subprotokoll',
  'workbench.editors.websocket.session.handshakeExtensions': 'Erweiterungen',
  'workbench.editors.websocket.session.handshakeNone': 'Nichts ausgehandelt',
  'workbench.editors.websocket.session.handshakeNote':
    'Der Plattform-Socket stellt nur das ausgehandelte Subprotokoll und die Erweiterungen bereit — die Header ' +
    'der 101-Antwort sind für Clients nicht verfügbar.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Verbindet',
  'workbench.editors.websocket.timeline.connected': 'Verbunden',
  'workbench.editors.websocket.timeline.connectedProtocol': 'Verbunden — Subprotokoll {protocol}',
  'workbench.editors.websocket.timeline.disconnected': 'Getrennt',
  'workbench.editors.websocket.timeline.stopped': 'Gestoppt',
  'workbench.editors.websocket.timeline.failed': 'Fehlgeschlagen',
  'workbench.editors.websocket.timeline.waiting': 'Warte auf Nachrichten…',
  'workbench.editors.websocket.timeline.noMatches': 'Keine Nachricht passt zum Filter.',
  'workbench.editors.websocket.timeline.searchMessages': 'Nachrichten durchsuchen',
  'workbench.editors.websocket.timeline.messageCount': '{count} Nachrichten',
  'workbench.editors.websocket.timeline.dropped': '{count} ältere Nachrichten sind aus der Erfassung herausgefallen',
  'workbench.editors.websocket.timeline.filterAll': 'Alle',
  'workbench.editors.websocket.timeline.filterSent': 'Gesendet',
  'workbench.editors.websocket.timeline.filterReceived': 'Empfangen',
  'workbench.editors.websocket.timeline.newestFirst': 'Neueste zuerst',
  'workbench.editors.websocket.timeline.oldestFirst': 'Älteste zuerst',
  'workbench.editors.websocket.timeline.sortOrder': 'Sortierreihenfolge',
  'workbench.editors.websocket.timeline.groupByDirection': 'Nach Richtung gruppieren',
  'workbench.editors.websocket.timeline.groupByEvent': 'Nach Ereignis gruppieren',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'Zeilen pro Gruppe',
  'workbench.editors.websocket.timeline.noLimit': 'Kein Limit',
  'workbench.editors.websocket.timeline.clearMessages': 'Nachrichten leeren',
  'workbench.editors.websocket.timeline.newMessages': 'Neue Nachrichten',
  'workbench.editors.websocket.timeline.binaryMessage': 'Binäre Nachricht ({bytes} Bytes)',
  'workbench.editors.websocket.timeline.sentAria': 'Gesendet',
  'workbench.editors.websocket.timeline.receivedAria': 'Empfangen',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': 'Frame mit Binäranhängen ({count} Anhänge)',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': 'Beispiel wird geladen…',
  'workbench.editors.wsExample.notFound':
    'Dieses Beispiel existiert nicht mehr — es wurde vielleicht in einem anderen Tab gelöscht.',
  'workbench.editors.wsExample.openInRequest': 'In der Anfrage öffnen',
  'workbench.editors.wsExample.openInRequestTooltip':
    'Die übergeordnete WebSocket-Anfrage mit dieser erfassten Form als ungespeicherte Änderungen öffnen.',
  'workbench.editors.wsExample.capturedTooltip': 'Erfasst am {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'Dieses Beispiel wurde in einem anderen Tab gelöscht.',
  'workbench.editors.wsExample.toast.saveFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.wsExample.toast.saveFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
} as const satisfies Catalog;
