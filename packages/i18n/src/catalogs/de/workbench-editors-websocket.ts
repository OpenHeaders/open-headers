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
  'workbench.editors.websocket.connect.label': 'Verbinden',
  'workbench.editors.websocket.connect.disconnect': 'Trennen',
  'workbench.editors.websocket.connect.cancel': 'Abbrechen',
  'workbench.editors.websocket.connect.browserHost': 'WebSocket-Sitzungen laufen in der Desktop-App oder im Server.',
  'workbench.editors.websocket.connect.needsUrl': 'Gib eine ws://- oder wss://-URL ein, um dich zu verbinden.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Nachricht',
  'workbench.editors.websocket.tab.events': 'Events',
  'workbench.editors.websocket.tab.auth': 'Autorisierung',
  'workbench.editors.websocket.tab.headers': 'Header',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.settings': 'Einstellungen',
  'workbench.editors.websocket.messagePlaceholder': 'Verfasse die nächste zu sendende Nachricht…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'Base64 der binären Nachricht, z. B. aGVsbG8=…',
  'workbench.editors.websocket.messagePlaceholderHex': 'Hex der binären Nachricht, z. B. 68656c6c6f…',
  'workbench.editors.websocket.message.formatText': 'Text',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'Binär',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Hexadezimal',
  'workbench.editors.websocket.message.invalidGate': 'Korrigiere zuerst die Kodierung der Nachricht.',
  'workbench.editors.websocket.message.invalidBase64': 'Kein gültiges Base64 — gesendet würden die dekodierten Bytes.',
  'workbench.editors.websocket.message.invalidHex':
    'Kein gültiges Hex — Paare aus 0-9 a-f dekodieren zu den gesendeten Bytes.',
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
  'workbench.editors.websocket.headers.hint.host':
    'Beim Verbinden aus der Ziel-URL abgeleitet — der Host, an den die Upgrade-Anfrage gerichtet ist.',
  'workbench.editors.websocket.headers.hint.connection':
    'Bittet den Server um einen Protokollwechsel; ein WebSocket-Handshake trägt immer Connection: Upgrade.',
  'workbench.editors.websocket.headers.hint.upgrade':
    'Nennt das Zielprotokoll — jeder WebSocket-Handshake hebt die HTTP-Verbindung auf websocket an.',
  'workbench.editors.websocket.headers.hint.key':
    'Eine zufällige Nonce pro Verbindung; der Server belegt das Lesen des Handshakes, indem er ihren Hash in Sec-WebSocket-Accept zurückgibt.',
  'workbench.editors.websocket.headers.hint.version':
    'Die WebSocket-Protokollversion (RFC 6455); 13 ist die einzige gebräuchliche Version.',
  'workbench.editors.websocket.headers.hint.extensions':
    'Bietet Kompression pro Nachricht an; der Server kann das Angebot in seiner Antwort annehmen, einschränken oder ignorieren.',
  'workbench.editors.websocket.headers.hint.origin':
    'Der Seitenursprung, den der Browser auf jeden WebSocket-Handshake stempelt; Server lehnen damit seitenübergreifende Verbindungen ab.',
  'workbench.editors.websocket.headers.hint.userAgent':
    'Der Browser identifiziert sich im Handshake; Seitencode kann das nicht ändern.',
  'workbench.editors.websocket.headers.hint.cacheControl':
    'Der Browser markiert die Upgrade-Anfrage als nicht cachebar.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'Die Inhaltskodierungen, die der Browser in der Handshake-Antwort akzeptiert.',
  'workbench.editors.websocket.headers.hint.acceptLanguage':
    'Die bevorzugten Sprachen des Browsers aus seinen Einstellungen.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'Der Handshake der Node-Laufzeit akzeptiert jeden Antwort-Medientyp.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage':
    'Der Handshake der Node-Laufzeit sendet einen Platzhalter.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'Von der Node-Laufzeit auf jeden WebSocket-Handshake gestempelt.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'Die Node-Laufzeit weist diese App im Handshake aus. Eigene User-Agent-Zeile hinzufügen, um einen anderen zu senden.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'Die Node-Laufzeit markiert die Upgrade-Anfrage als nicht cachebar.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'Die Inhaltskodierungen, die die Node-Laufzeit in der Handshake-Antwort akzeptiert.',
  'workbench.editors.websocket.headers.browserNotSent':
    'Nicht gesendet — der Browser setzt die Handshake-Header selbst. Eigene Header gelten, wenn die Sitzung in der Desktop-App oder auf dem Server läuft.',
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
  'workbench.editors.websocket.settings.group.connection': 'Verbindung',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS & Vertrauen',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'Wie der Handshake die Sitzung öffnet: die angebotenen Subprotokolle, wohin die Verbindung wählt und die ' +
    'Obergrenze für den Aufbau.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Wie das Socket.IO-CONNECT den Server adressiert: der Namespace, dem die Sitzung beitritt.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'Wie wss:-Sitzungen Vertrauen herstellen: ob das Serverzertifikat gegen die Systemwurzeln geprüft wird, welches Client-Zertifikat dieses Gerät vorlegt, das TLS-Versionsfenster und die Cipher-Liste im Handshake sowie der angebotene SNI-Name.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Subprotokolle',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Die Sec-WebSocket-Protocol-Angebotsliste, in bevorzugter Reihenfolge — der Server wählt eines während ' +
    'des Handshakes.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Keine (Standard)',
  'workbench.editors.websocket.settings.subprotocolsExample': 'z. B. graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Unix-Socket',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Wählt dieses lokale Socket an — einen absoluten Unix-Socket-Pfad oder eine benannte Windows-Pipe wie ' +
    '\\\\.\\pipe\\name — statt eine TCP-Verbindung zu öffnen. Die URL bestimmt weiterhin den ' +
    'Handshake-Host, den TLS-Servernamen und die Zertifikatsprüfung; nur wohin die Verbindung geht, ändert ' +
    'sich. Leer lassen für eine normale TCP-Verbindung.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'TCP-Verbindung (Standard)',
  'workbench.editors.websocket.settings.timeoutLabel': 'Verbindungs-Zeitlimit',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Wanduhr-Obergrenze nur für den Verbindungs-Handshake — eine offene Sitzung hat keine Obergrenze. Leer ' +
    'setzt keine Frist.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Kein Limit (Standard)',
  'workbench.editors.websocket.settings.namespaceLabel': 'Namespace',
  'workbench.editors.websocket.settings.namespaceHelp':
    'Der Namespace, mit dem sich die Sitzung verbindet — leer verbindet mit der Wurzel /. Sitzungen wählen ' +
    'direkt den websocket-Transport; es gibt keinen Fallback auf long-polling.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (Standard)',
  'workbench.editors.websocket.settings.namespaceExample': 'z. B. /admin',
  'workbench.editors.websocket.toast.deletedOtherTab': 'Diese WebSocket-Anfrage wurde in einem anderen Tab gelöscht.',
  'workbench.editors.websocket.toast.updateFailed': 'WebSocket-Anfrage konnte nicht gespeichert werden',
  'workbench.editors.websocket.toast.updateFailedDetail':
    'WebSocket-Anfrage konnte nicht gespeichert werden: {message}',
  'workbench.editors.websocket.toast.savedExample': 'Beispiel „{name}“ gespeichert',
  'workbench.editors.websocket.toast.saveExampleFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'Antwort',
  'workbench.editors.websocket.session.emptyHint': 'Verbinden, um Nachrichten zu senden und zu empfangen.',
  'workbench.editors.websocket.session.connectFailed': 'Die Sitzung konnte nicht geöffnet werden',
  'workbench.editors.websocket.session.connectingBadge': 'Verbindet',
  'workbench.editors.websocket.session.connectedBadge': 'Verbunden',
  'workbench.editors.websocket.session.closedTag': 'Geschlossen {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Gestoppt',
  'workbench.editors.websocket.session.disconnectedTag': 'Getrennt',
  'workbench.editors.websocket.session.connectFailedTag': 'Verbindung fehlgeschlagen',
  'workbench.editors.websocket.session.abortedTag': 'Abgebrochen',
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
  'workbench.editors.websocket.session.handshakeNone': 'Nichts ausgehandelt',
  'workbench.editors.websocket.session.handshakeNote':
    'Der Plattform-Socket stellt nur das ausgehandelte Subprotokoll und die Erweiterungen bereit — die Header ' +
    'der 101-Antwort sind für Clients nicht verfügbar.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Verbindet',
  'workbench.editors.websocket.timeline.connected': 'Verbunden',
  'workbench.editors.websocket.timeline.disconnected': 'Getrennt',
  'workbench.editors.websocket.timeline.stopped': 'Gestoppt',
  'workbench.editors.websocket.timeline.aborted': 'Verbindung abgebrochen',
  'workbench.editors.websocket.timeline.noMatches': 'Keine Nachricht passt zum Filter.',
  'workbench.editors.websocket.timeline.connectedTo': 'Verbunden mit {url}',
  'workbench.editors.websocket.timeline.copyMessage': 'Nachricht kopieren',
  'workbench.editors.websocket.saved.title': 'Gespeicherte Nachrichten',
  'workbench.editors.websocket.saved.addTooltip': 'Aktuellen Entwurf als wiederverwendbare Nachricht speichern',
  'workbench.editors.websocket.saved.showRail': 'Gespeicherte Nachrichten anzeigen',
  'workbench.editors.websocket.saved.hideRail': 'Gespeicherte Nachrichten ausblenden',
  'workbench.editors.websocket.saved.emptyHint':
    'Speichere Nachrichten, um sie während einer aktiven Verbindung wiederzuverwenden.',
  'workbench.editors.websocket.saved.defaultName': 'Nachricht',
  'workbench.editors.websocket.saved.rename': 'Umbenennen',
  'workbench.editors.websocket.saved.duplicate': 'Duplizieren',
  'workbench.editors.websocket.saved.delete': 'Löschen',
  'workbench.editors.websocket.timeline.saveMessage': 'Nachricht speichern',
  'workbench.editors.websocket.timeline.info.label': 'Nachrichtendetails',
  'workbench.editors.websocket.timeline.info.size': 'Größe',
  'workbench.editors.websocket.timeline.info.time': 'Zeit',
  'workbench.editors.websocket.timeline.info.frame': 'Frame',
  'workbench.editors.websocket.timeline.info.frameText': 'Text',
  'workbench.editors.websocket.timeline.info.frameBinary': 'Binär',
  'workbench.editors.websocket.timeline.couldNotConnect': 'Verbindung zu {url} nicht möglich',
  'workbench.editors.websocket.timeline.errorLabel': 'Fehler',
  'workbench.editors.websocket.timeline.disconnectedFrom': 'Getrennt von {url}',
  'workbench.editors.websocket.timeline.handshakeDetails': 'Handshake-Details',
  'workbench.editors.websocket.timeline.requestUrl': 'Request-URL',
  'workbench.editors.websocket.timeline.requestMethod': 'Request-Methode',
  'workbench.editors.websocket.timeline.statusCode': 'Statuscode',
  'workbench.editors.websocket.timeline.requestHeaders': 'Request-Header',
  'workbench.editors.websocket.timeline.responseHeaders': 'Response-Header',
  'workbench.editors.websocket.timeline.keyGenerated': '<vom Socket erzeugt>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'Die Sitzung wurde aus dieser App gestoppt.',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    'Keine registrierte Bedeutung — ein Anwendungs- oder privater Code.',
  'workbench.editors.websocket.timeline.closeCode.1000': 'Die Verbindung wurde ordnungsgemäß geschlossen.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'Der Endpunkt geht weg — Server-Shutdown oder Seitennavigation.',
  'workbench.editors.websocket.timeline.closeCode.1002':
    'Der Endpunkt hat die Verbindung wegen eines Protokollfehlers beendet.',
  'workbench.editors.websocket.timeline.closeCode.1003':
    'Der Endpunkt hat Daten eines Typs erhalten, den er nicht annehmen kann.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'Im Close-Frame war kein Statuscode enthalten.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'Die Verbindung brach ohne Close-Frame ab.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'Eine Nachricht enthielt Daten, die nicht zu ihrem Typ passen, etwa ungültiges UTF-8 in einem Text-Frame.',
  'workbench.editors.websocket.timeline.closeCode.1008': 'Eine Nachricht verstieß gegen die Richtlinie des Endpunkts.',
  'workbench.editors.websocket.timeline.closeCode.1009': 'Eine Nachricht war zu groß für die Verarbeitung.',
  'workbench.editors.websocket.timeline.closeCode.1010':
    'Der Server hat eine vom Client geforderte Erweiterung nicht ausgehandelt.',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'Der Server stieß auf eine unerwartete Bedingung und konnte die Anfrage nicht erfüllen.',
  'workbench.editors.websocket.timeline.closeCode.1012': 'Der Server startet neu.',
  'workbench.editors.websocket.timeline.closeCode.1013': 'Der Server ist überlastet — später erneut versuchen.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'Ein Gateway oder Proxy erhielt eine ungültige Antwort vom Upstream-Server.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'Der TLS-Handshake ist fehlgeschlagen.',
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
  'workbench.editors.websocket.timeline.trustCertificate': 'Zertifikat vertrauen',
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
