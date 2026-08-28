/**
 * Workbench editors — the MQTT client editor, German. Wire vocabulary
 * (mqtt/mqtts/ws/wss schemes, CONNECT / PUBLISH / RETAIN / PINGREQ
 * tokens, QoS, topic filters, AsyncAPI, the 5.0 property names the
 * spec fixes in English) rides raw inside keyed values. „Thema" =
 * topic; „Themenfilter" = topic filter; „Nutzlast" = payload;
 * „Testament" = last will; „Broker" stays the loanword.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsMqtt = {
  // ── MQTT request editor ─────────────────────────────────────────────
  'workbench.editors.mqtt.notFound': 'MQTT-Anfrage nicht gefunden.',
  'workbench.editors.mqtt.urlPlaceholder': 'mqtt://broker.openheaders.com:1883',
  'workbench.editors.mqtt.version.tooltip':
    'MQTT-Protokollversion der Sitzung.\n5.0 · Eigenschaften und Abonnementoptionen\n3.1.1 · Broker, die 5.0 ablehnen',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.version.lockedWhileConnected':
    'Die Version kann nicht geändert werden, solange die Sitzung verbunden ist.',
  'workbench.editors.mqtt.connect.label': 'Verbinden',
  'workbench.editors.mqtt.connect.disconnect': 'Trennen',
  'workbench.editors.mqtt.connect.cancel': 'Abbrechen',
  'workbench.editors.mqtt.connect.reconnectNow': 'Jetzt neu verbinden',
  'workbench.editors.mqtt.connect.reconnectNowHint':
    'Den nächsten Wiederverbindungsversuch ohne Ablauf der Wartezeit starten',
  'workbench.editors.mqtt.connect.browserHost': 'MQTT-Sitzungen laufen in der Desktop-App oder auf dem Server.',
  'workbench.editors.mqtt.connect.needsUrl': 'Geben Sie eine Broker-URL ein, um zu verbinden.',
  'workbench.editors.mqtt.connect.tcpSchemeBrowser':
    '{scheme}://-Sitzungen laufen in der Desktop-App oder auf dem Server — wechseln Sie zu ws:// oder wss://, um hier zu verbinden.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Nachricht',
  'workbench.editors.mqtt.tab.topics': 'Themen',
  'workbench.editors.mqtt.tab.auth': 'Autorisierung',
  'workbench.editors.mqtt.tab.properties': 'Eigenschaften',
  'workbench.editors.mqtt.tab.lastWill': 'Testament',
  'workbench.editors.mqtt.tab.spec': 'AsyncAPI',
  'workbench.editors.mqtt.tab.settings': 'Einstellungen',
  'workbench.editors.mqtt.qos.compactLabel': 'QoS:',
  'workbench.editors.mqtt.qos.meaning0': 'Höchstens einmal',
  'workbench.editors.mqtt.qos.meaning1': 'Mindestens einmal',
  'workbench.editors.mqtt.qos.meaning2': 'Genau einmal',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Senden',
  'workbench.editors.mqtt.topicPlaceholder': 'Zielthema',
  'workbench.editors.mqtt.topicExample': 'z. B. sensors/1/temperature',
  'workbench.editors.mqtt.payload.formatText': 'Text',
  'workbench.editors.mqtt.payload.formatJson': 'JSON',
  'workbench.editors.mqtt.payload.formatBase64': 'Base64',
  'workbench.editors.mqtt.payload.formatHex': 'Hexadezimal',
  'workbench.editors.mqtt.payload.invalidGate': 'Korrigiere zuerst die Kodierung der Nutzlast.',
  'workbench.editors.mqtt.payload.invalidBase64': 'Kein gültiges Base64 — veröffentlicht würden die dekodierten Bytes.',
  'workbench.editors.mqtt.payload.invalidHex':
    'Kein gültiges Hex — Paare aus 0-9 a-f dekodieren zu den veröffentlichten Bytes.',
  'workbench.editors.mqtt.payloadPlaceholder': 'Nutzlast zum Veröffentlichen verfassen…',
  'workbench.editors.mqtt.payloadPlaceholderBase64': 'Base64 der binären Nutzlast, z. B. aGVsbG8=…',
  'workbench.editors.mqtt.payloadPlaceholderHex': 'Hex der binären Nutzlast, z. B. 48656c6c6f…',
  'workbench.editors.mqtt.props.buttonTooltip': 'Nachrichtenoptionen',
  'workbench.editors.mqtt.props.hint': 'MQTT-5.0-Metadaten, die mit jeder Nachricht gesendet werden.',
  'workbench.editors.mqtt.props.v311':
    'Nachrichteneigenschaften sind ein MQTT-5.0-Feature — diese Anfrage zielt auf 3.1.1.',
  'workbench.editors.mqtt.props.userPropKey': 'Eigenschaft',
  'workbench.editors.mqtt.props.userPropValue': 'Wert',
  'workbench.editors.mqtt.props.addUserProp': 'Benutzereigenschaft',
  'workbench.editors.mqtt.props.removeUserProp': 'Benutzereigenschaft entfernen',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.responseTopicDesc':
    'Thema, auf dem der Empfänger antworten soll — Request/Response über Pub/Sub. Leer bedeutet, die Eigenschaft wird nicht gesendet.',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.correlationDataDesc':
    'Opakes Token, das der Empfänger auf seine Antwort übernimmt, damit sie dieser Nachricht zugeordnet werden kann. Leer bedeutet, die Eigenschaft wird nicht gesendet.',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval',
  'workbench.editors.mqtt.props.messageExpiryDesc':
    'Sekunden, die der Broker die Nachricht zustellbar hält; danach wird sie verworfen statt zugestellt. Leer bedeutet, die Nachricht läuft nie ab.',
  'workbench.editors.mqtt.props.messageExpiryPlaceholder': 'Kein Ablauf (Standard)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.contentTypeDesc':
    'MIME-Typ, der die Nutzlast beschreibt, unverändert an die Empfänger weitergereicht. Leer bedeutet, die Eigenschaft wird nicht gesendet.',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator',
  'workbench.editors.mqtt.props.payloadFormatIndicatorDesc':
    'Markiert die Nutzlast als UTF-8-Text statt unspezifizierter Bytes; Broker und Empfänger dürfen das validieren.',
  'workbench.editors.mqtt.props.nonePlaceholder': 'Keine (Standard)',
  'workbench.editors.mqtt.props.sectionProperties': 'Eigenschaften',
  'workbench.editors.mqtt.props.sectionPropertiesDesc':
    'Freie Schlüssel-Wert-Paare, die mit der Nachricht reisen — Anwendungsmetadaten, die der Broker unverändert durchreicht.',
  'workbench.editors.mqtt.props.sectionSettings': 'Einstellungen',
  'workbench.editors.mqtt.saved.title': 'Gespeicherte Nachrichten',
  'workbench.editors.mqtt.saved.addTooltip': 'Aktuellen Entwurf als wiederverwendbare Nachricht speichern',
  'workbench.editors.mqtt.saved.topicTagPlaceholder': 'Thema',
  'workbench.editors.mqtt.saved.showRail': 'Gespeicherte Nachrichten anzeigen',
  'workbench.editors.mqtt.saved.hideRail': 'Gespeicherte Nachrichten ausblenden',
  'workbench.editors.mqtt.saved.emptyHint':
    'Speichere Nachrichten, um sie während einer aktiven Verbindung wiederzuverwenden.',
  'workbench.editors.mqtt.saved.defaultName': 'Nachricht',
  'workbench.editors.mqtt.saved.sendTooltip': 'Diese gespeicherte Nachricht unverändert veröffentlichen',
  'workbench.editors.mqtt.saved.rename': 'Umbenennen',
  'workbench.editors.mqtt.saved.duplicate': 'Duplizieren',
  'workbench.editors.mqtt.saved.delete': 'Löschen',
  'workbench.editors.mqtt.topics.hint':
    'Abonnements, mit denen die Sitzung öffnet. Wildcards + und # sind willkommen; abgeschaltete Zeilen bleiben gespeichert, abonnieren aber nicht.',
  'workbench.editors.mqtt.topics.filterLabel': 'Thema',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Thema, z. B. sensors/+/temperature',
  'workbench.editors.mqtt.topics.qosColLabel': 'QoS',
  'workbench.editors.mqtt.topics.optionsColLabel': 'Optionen',
  'workbench.editors.mqtt.topics.optionsTooltip': 'Abonnementoptionen',
  'workbench.editors.mqtt.topics.subscribeColLabel': 'Abonnement',
  'workbench.editors.mqtt.topics.subscribeLabel': 'Beim Öffnen der Sitzung abonnieren',
  'workbench.editors.mqtt.topics.subscribeLiveLabel':
    'In der offenen Sitzung abonnieren / abbestellen — die gespeicherte Zeile bleibt unverändert',
  'workbench.editors.mqtt.topics.optionsHint': 'MQTT-5.0-Abonnementoptionen für diese Zeile.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local',
  'workbench.editors.mqtt.topics.noLocalDesc':
    'Der Broker sendet die eigenen Veröffentlichungen dieses Clients nicht an ihn zurück.',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published',
  'workbench.editors.mqtt.topics.retainAsPublishedDesc':
    'Nachrichten behalten das RETAIN-Flag genau wie veröffentlicht.',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandlingDesc':
    'Ob der Broker beim Einrichten dieses Abonnements vorhandene zurückgehaltene Nachrichten sendet.',
  'workbench.editors.mqtt.topics.retainHandlingValuesHeading': 'Werte',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Beim Abonnieren empfangen',
  'workbench.editors.mqtt.topics.retainHandling0Desc':
    'Der Broker sendet die zurückgehaltenen Nachrichten bei jedem Abonnieren.',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Nur neue Abonnements',
  'workbench.editors.mqtt.topics.retainHandling1Desc':
    'Der Broker sendet die zurückgehaltenen Nachrichten nur, wenn das Abonnement noch nicht besteht.',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · Nicht empfangen',
  'workbench.editors.mqtt.topics.retainHandling2Desc':
    'Der Broker sendet für dieses Abonnement keine zurückgehaltenen Nachrichten.',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.topics.subscriptionIdDesc':
    'Numerische Kennung, die der Broker an über dieses Abonnement zugestellte Nachrichten anhängt.',
  'workbench.editors.mqtt.topics.subscriptionIdPlaceholder': 'Keine (Standard)',
  'workbench.editors.mqtt.topics.subscribeProperties': 'Eigenschaften',
  'workbench.editors.mqtt.topics.subscribePropertiesDesc':
    'User Properties, die einmal mit dem SUBSCRIBE-Paket dieser Zeile gesendet werden. Ihre Bedeutung bestimmt der Broker; zugestellten Nachrichten werden sie nicht angehängt.',
  'workbench.editors.mqtt.topics.subscribeSettings': 'Einstellungen',
  'workbench.editors.mqtt.auth.help':
    'Werden als User Name und Password des CONNECT-Pakets auf jedem Host gesendet — beide MQTT-Versionen tragen sie. Variablen werden beim Verbinden aufgelöst; gespeicherte Beispiele erfassen die Zugangsdaten nie.',
  'workbench.editors.mqtt.userProps.hint':
    'Benutzereigenschaften auf CONNECT — freie Metadaten, die Broker und andere Werkzeuge lesen können.',
  'workbench.editors.mqtt.userProps.v311':
    'CONNECT-Benutzereigenschaften sind ein MQTT-5.0-Feature — diese Anfrage zielt auf 3.1.1.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Eigenschaft',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Wert',
  'workbench.editors.mqtt.will.hint':
    'Wird mit CONNECT beim Broker hinterlegt und von ihm veröffentlicht, falls die Sitzung ohne sauberes Trennen abbricht. Ein leeres Thema bedeutet kein Testament.',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Thema für das Testament',
  'workbench.editors.mqtt.will.topicExample': 'z. B. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, in Sekunden — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayLabel': 'Testament-Verzögerung',
  'workbench.editors.mqtt.will.delayPlaceholder': '0 s (Standard)',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Testament-Nutzlast verfassen…',
  'workbench.editors.mqtt.spec.selectLabel': 'AsyncAPI-Spezifikation',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'AsyncAPI-Spezifikation verknüpfen',
  'workbench.editors.mqtt.spec.summary': '{servers} Server · {channels} Kanäle · {operations} Operationen',
  'workbench.editors.mqtt.spec.parseFailure': 'Spezifikation ließ sich nicht parsen: {message}',
  'workbench.editors.mqtt.spec.issues': '{count} Spezifikationsprobleme',
  'workbench.editors.mqtt.spec.useExample': 'Beispielnachricht verwenden…',
  'workbench.editors.mqtt.spec.browser.hint':
    'Wähle eine Nachricht, um ihre Beispiel-Payload zu verfassen; eine Kanalnachricht füllt auch das Publish-Topic.',
  'workbench.editors.mqtt.spec.browser.servers': 'Servers',
  'workbench.editors.mqtt.spec.browser.channels': 'Channels',
  'workbench.editors.mqtt.spec.browser.operations': 'Operations',
  'workbench.editors.mqtt.spec.browser.components': 'Components',
  'workbench.editors.mqtt.specFooter.using': 'Verwendet {name}',
  'workbench.editors.mqtt.specFooter.none': 'Keine AsyncAPI-Spezifikation verknüpft',
  'workbench.editors.mqtt.settings.exampleCaption': 'Beispielsitzung',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Kennung, die CONNECT trägt. Leer erzeugt bei jeder Verbindung eine neue; das Fortsetzen einer Broker-Sitzung braucht eine stabile ID.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Auto — pro Verbindung erzeugt',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Beim Verbinden eine frische Broker-Sitzung beginnen. Ausschalten setzt Abonnements und wartende Nachrichten einer früheren Sitzung fort — das braucht ebenfalls eine stabile Client ID.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Wie lange der Broker die Sitzung nach dem Trennen behält — 0 beendet sie beim Trennen. Clean Start verwirft nur die vorige Sitzung beim Verbinden; das Intervall gilt für die neue in jedem Fall.',
  'workbench.editors.mqtt.settings.zeroDefault': '0 s (Standard)',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Herzschlag-Intervall, das die Sitzung dem Broker zusagt — der Client antwortet und sendet PINGREQ. Leer verwendet 60 s; 0 schaltet ab.',
  'workbench.editors.mqtt.settings.keepAlivePlaceholder': '60 s (Standard)',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Verbindungs-Timeout',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Wanduhr-Obergrenze nur für den Verbindungsaufbau — eine offene Sitzung hat keine Obergrenze. Leer nutzt die Standardfrist von 30 s.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': '30 s (Standard)',
  'workbench.editors.mqtt.settings.autoReconnectLabel': 'Automatisch neu verbinden',
  'workbench.editors.mqtt.settings.autoReconnectHelp':
    'Öffnet die Sitzung erneut, wenn eine offene Verbindung abbricht — Socket getrennt oder DISCONNECT vom Broker — und wählt im Wiederverbindungsintervall neu, bis sie wieder offen ist oder du trennst. Ein fehlgeschlagener Erstverbindungsversuch wird nie wiederholt. Standardmäßig aus.',
  'workbench.editors.mqtt.settings.reconnectPeriodLabel': 'Wiederverbindungsintervall',
  'workbench.editors.mqtt.settings.reconnectPeriodHelp':
    'Wartezeit zwischen zwei Wiederverbindungsversuchen. Leer nutzt den Standard von 5 s.',
  'workbench.editors.mqtt.settings.reconnectPeriodPlaceholder': '5 s (Standard)',
  'workbench.editors.mqtt.settings.reconnectMaxAttemptsLabel': 'Wiederverbindungsversuche',
  'workbench.editors.mqtt.settings.reconnectMaxAttemptsHelp':
    'Obergrenze aufeinanderfolgender Wiederverbindungsversuche nach einem Abbruch — eine gelungene Wiederverbindung setzt den Zähler zurück; eine erschöpfte Obergrenze beendet die Sitzung als Wiederverbindung aufgegeben. Leer versucht es weiter, bis der Broker zurück ist oder du trennst.',
  'workbench.editors.mqtt.settings.reconnectMaxAttemptsPlaceholder': 'Unbegrenzt (Standard)',
  'workbench.editors.mqtt.settings.reconnectBackoffLabel': 'Exponentielles Warten',
  'workbench.editors.mqtt.settings.reconnectBackoffHelp':
    'Verdoppelt die Wartezeit nach jedem fehlgeschlagenen Versuch — das Intervall, dann 2×, 4× … bis 60 s — mit leichtem Zufallsversatz, damit Clients nie im Gleichtakt neu wählen. Standardmäßig an; aus wartet jeder Versuch exakt das Intervall.',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Wie viele QoS-1/2-Nachrichten gleichzeitig zu diesem Client unterwegs sein dürfen. Leer erlaubt den Spezifikations-Standard von 65.535.',
  'workbench.editors.mqtt.settings.receiveMaximumPlaceholder': '65.535 (Standard)',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Größtes Paket, das dieser Client annimmt — größere verwirft der Broker. Leer setzt kein Limit.',
  'workbench.editors.mqtt.settings.noLimit': 'Kein Limit (Standard)',
  'workbench.editors.mqtt.settings.cleanSessionLabel': 'Clean Session',
  'workbench.editors.mqtt.settings.topicAliasMaximumLabel': 'Topic Alias Maximum',
  'workbench.editors.mqtt.settings.topicAliasMaximumHelp':
    'Wie viele Topic-Aliase der Broker gegenüber diesem Client verwenden darf — aliasierte Publishes tragen eine Nummer statt des Topics. Leer erlaubt keine, der Standard der Spezifikation.',
  'workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder': '0 (Standard)',
  'workbench.editors.mqtt.settings.requestResponseInfoLabel': 'Request Response Information',
  'workbench.editors.mqtt.settings.requestResponseInfoHelp':
    'Den Broker um Response Information im CONNACK bitten — das Basis-Topic für Anfrage/Antwort-Austausch. Standardmäßig aus.',
  'workbench.editors.mqtt.settings.requestProblemInfoLabel': 'Request Problem Information',
  'workbench.editors.mqtt.settings.requestProblemInfoHelp':
    'Dem Broker erlauben, Reason Strings und User Properties an Fehlerpakete anzuhängen. Standardmäßig an.',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'SSL-Zertifikatsprüfung',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    'Das Broker-Zertifikat für mqtts/wss-Sitzungen gegen die Systemwurzeln prüfen. Für selbstsignierte Entwicklungs-Broker ausschalten.',
  'workbench.editors.mqtt.settings.sslVerifyWarning':
    'Sitzungen überspringen die Prüfung der Broker-Identität — jedes Zertifikat wird akzeptiert, auch ' +
    'selbstsignierte und abgelaufene.',
  'workbench.editors.mqtt.settings.clientIdExample': 'z. B. reporter-1',
  'workbench.editors.mqtt.settings.clientCertificateHelp':
    'Einen Client-Zertifikat-Eintrag des Tresors im mqtts/wss-Handshake vorzeigen — für Broker, die Geräte per Zertifikat authentifizieren. Die Anfrage speichert nur den Eintragsnamen; jedes Gerät zeigt seinen eigenen Eintrag dieses Namens vor.',
  'workbench.editors.mqtt.settings.sniLabel': 'SNI-Servername',
  'workbench.editors.mqtt.settings.sniHelp':
    'Servername im TLS-Handshake von mqtts-Sitzungen — Broker hinter einem gemeinsamen Endpunkt wählen daran ihr Zertifikat. Leer sendet den URL-Host.',
  'workbench.editors.mqtt.settings.sniPlaceholder': 'Auto — der URL-Host',
  'workbench.editors.mqtt.settings.sniExample': 'z. B. broker.openheaders.com',
  'workbench.editors.mqtt.settings.alpnLabel': 'ALPN-Protokoll',
  'workbench.editors.mqtt.settings.alpnHelp':
    'Im TLS-Handshake von mqtts-Sitzungen angebotenes Anwendungsprotokoll — Broker, die MQTT auf einem gemeinsamen TLS-Port multiplexen, wählen daran. Leer bietet keines an.',
  'workbench.editors.mqtt.settings.alpnPlaceholder': 'Keines (Standard)',
  'workbench.editors.mqtt.settings.alpnExample': 'z. B. mqtt',
  'workbench.editors.mqtt.settings.group.connection': 'Verbindung',
  'workbench.editors.mqtt.settings.group.session': 'Sitzung — MQTT 5.0',
  'workbench.editors.mqtt.settings.group.tls': 'TLS & Vertrauen',
  'workbench.editors.mqtt.settings.groupInfo.connection':
    'Wie CONNECT die Sitzung öffnet: die präsentierte Identität, ob sie frisch startet, die zugesagten ' +
    'Herzschlag- und Aufbaufristen, und ob eine abgebrochene Verbindung wieder geöffnet wird.',
  'workbench.editors.mqtt.settings.groupInfo.session':
    'MQTT-5.0-Bedingungen, die CONNECT dem Broker anbietet: wie lange die Sitzung eine Trennung überlebt, plus ' +
    'die Obergrenzen für gleichzeitige Nachrichten und Paketgröße, die dieser Client akzeptiert.',
  'workbench.editors.mqtt.settings.groupInfo.tls':
    'Wie mqtts/wss-Sitzungen Vertrauen herstellen: ob das Broker-Zertifikat gegen die Systemwurzeln geprüft wird, welches Client-Zertifikat dieses Gerät vorzeigt, sowie SNI-Name und ALPN-Angebot im Handshake.',
  'workbench.editors.mqtt.settings.sessionV311': 'MQTT-5.0-Regler — diese Anfrage zielt auf 3.1.1.',
  // ── Sitzungsbereich ─────────────────────────────────────────────────
  'workbench.editors.mqtt.session.emptyTitle': 'Antwort',
  'workbench.editors.mqtt.session.emptyHint': 'Verbinden, um Nachrichten zu senden und zu empfangen.',
  'workbench.editors.mqtt.session.connectFailed': 'Die Sitzung konnte nicht geöffnet werden',
  'workbench.editors.mqtt.session.connectingBadge': 'Verbindet',
  'workbench.editors.mqtt.session.connectedBadge': 'Verbunden',
  'workbench.editors.mqtt.session.notSubscribed': 'Keine Themen abonniert',
  'workbench.editors.mqtt.session.subscribedOne': '1 Thema abonniert',
  'workbench.editors.mqtt.session.subscribedMany': '{count} Themen abonniert',
  'workbench.editors.mqtt.session.tab.timeline': 'Zeitverlauf',
  'workbench.editors.mqtt.session.tab.connection': 'Verbindung',
  'workbench.editors.mqtt.session.duration': '{ms} ms',
  'workbench.editors.mqtt.session.sendIdle': 'Verbinden Sie sich, um Nachrichten zu veröffentlichen.',
  'workbench.editors.mqtt.session.sendFailed': 'Die Nachricht konnte nicht veröffentlicht werden',
  'workbench.editors.mqtt.session.subscribeFailed': 'Das Abonnement konnte nicht geändert werden',
  'workbench.editors.mqtt.session.hostNotice': 'Läuft auf dem Browser-Socket — {knobs} gelten auf diesem Host nicht.',
  'workbench.editors.mqtt.session.knobSslVerify': 'die deaktivierte SSL-Prüfung',
  'workbench.editors.mqtt.session.disconnectedTag': 'Getrennt',
  'workbench.editors.mqtt.session.brokerDisconnectedTag': 'Vom Broker getrennt',
  'workbench.editors.mqtt.session.severedTag': 'Verbindung abgerissen',
  'workbench.editors.mqtt.session.stoppedTag': 'Gestoppt',
  'workbench.editors.mqtt.session.connectFailedTag': 'Verbindung fehlgeschlagen',
  'workbench.editors.mqtt.session.abortedTag': 'Abgebrochen',
  'workbench.editors.mqtt.timeline.aborted': 'Verbindung abgebrochen',
  'workbench.editors.mqtt.timeline.abortedDisconnected': 'Vom Broker getrennt',
  'workbench.editors.mqtt.timeline.lost': 'Verbindung verloren',
  'workbench.editors.mqtt.timeline.reconnecting': 'Wiederverbindungsversuch {attempt}',
  'workbench.editors.mqtt.timeline.reconnected': 'Wieder mit dem Broker verbunden',
  'workbench.editors.mqtt.session.reconnectingBadge': 'Verbinde neu',
  'workbench.editors.mqtt.session.reconnectRefusedTag': 'Wiederverbindung abgelehnt',
  'workbench.editors.mqtt.session.reconnectRefused': 'Wiederverbindung abgelehnt: {reason}',
  'workbench.editors.mqtt.timeline.reconnectingAfter': 'Wiederverbindungsversuch {attempt} nach {delay}',
  'workbench.editors.mqtt.timeline.reconnectingNow': 'Wiederverbindungsversuch {attempt} jetzt',
  'workbench.editors.mqtt.timeline.reconnectedDroppedOne': 'eine unbestätigte Nachricht verworfen',
  'workbench.editors.mqtt.timeline.reconnectedDroppedMany': '{count} unbestätigte Nachrichten verworfen',
  'workbench.editors.mqtt.session.reconnectExhaustedTag': 'Wiederverbindung aufgegeben',
  'workbench.editors.mqtt.session.reconnectExhausted': 'Wiederverbindung aufgegeben nach {attempts}',
  'workbench.editors.mqtt.session.reconnectExhaustedReason': 'Wiederverbindung aufgegeben nach {attempts}: {reason}',
  'workbench.editors.mqtt.session.reconnectAttemptsOne': 'einem Versuch',
  'workbench.editors.mqtt.session.reconnectAttemptsMany': '{count} Versuchen',
  'workbench.editors.mqtt.session.cleanDisconnect': 'saubere Trennung',
  'workbench.editors.mqtt.session.brokerDisconnect': 'der Broker sendete DISCONNECT: {reason}',
  'workbench.editors.mqtt.session.brokerDisconnectBare': 'der Broker sendete DISCONNECT',
  'workbench.editors.mqtt.session.severed': 'die Verbindung endete ohne DISCONNECT',
  'workbench.editors.mqtt.session.connectionClientId': 'Client-ID',
  'workbench.editors.mqtt.session.connectionReason': 'CONNACK-Grund',
  'workbench.editors.mqtt.session.connectionSessionPresent': 'Sitzung vorhanden',
  'workbench.editors.mqtt.session.yes': 'Ja',
  'workbench.editors.mqtt.session.no': 'Nein',
  'workbench.editors.mqtt.session.connectionNote':
    'Die CONNACK-Fakten, wie der Broker sie beantwortet hat — Grundcodes wortgetreu, Namen daneben.',
  // ── Nachrichten-Zeitverlauf ─────────────────────────────────────────
  'workbench.editors.mqtt.timeline.connecting': 'Verbindet',
  'workbench.editors.mqtt.timeline.connected': 'Mit dem Broker verbunden',
  'workbench.editors.mqtt.timeline.disconnected': 'Getrennt',
  'workbench.editors.mqtt.timeline.stopped': 'Gestoppt',
  'workbench.editors.mqtt.timeline.subscribed': 'Abonniert:',
  'workbench.editors.mqtt.timeline.unsubscribed': 'Abbestellt:',
  'workbench.editors.mqtt.timeline.grantFailed': 'Abgelehnt, Code {code}',
  'workbench.editors.mqtt.timeline.grantFailedNamed': '{name} ({code})',
  'workbench.editors.mqtt.timeline.noMatches': 'Keine Nachrichten entsprechen dem Filter.',
  'workbench.editors.mqtt.timeline.searchMessages': 'Nachrichten durchsuchen',
  'workbench.editors.mqtt.timeline.messageCount': '{count} Nachrichten',
  'workbench.editors.mqtt.timeline.dropped': '{count} ältere Nachrichten aus der Aufzeichnung entfernt',
  'workbench.editors.mqtt.timeline.topicFilterAll': 'Alle Topics',
  'workbench.editors.mqtt.timeline.filterAll': 'Alle',
  'workbench.editors.mqtt.timeline.filterSent': 'Gesendet',
  'workbench.editors.mqtt.timeline.filterReceived': 'Empfangen',
  'workbench.editors.mqtt.timeline.newestFirst': 'Neueste zuerst',
  'workbench.editors.mqtt.timeline.oldestFirst': 'Älteste zuerst',
  'workbench.editors.mqtt.timeline.sortOrder': 'Sortierung',
  'workbench.editors.mqtt.timeline.clearMessages': 'Nachrichten leeren',
  'workbench.editors.mqtt.timeline.trustCertificate': 'Zertifikat vertrauen',
  'workbench.editors.mqtt.timeline.newMessages': 'Neue Nachrichten',
  'workbench.editors.mqtt.timeline.binaryMessage': 'Binäre Nutzlast ({bytes} Bytes)',
  'workbench.editors.mqtt.timeline.byteCount': '{bytes} B',
  'workbench.editors.mqtt.timeline.retainedTag': 'Retained',
  'workbench.editors.mqtt.timeline.sentAria': 'Gesendet',
  'workbench.editors.mqtt.timeline.receivedAria': 'Empfangen',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Diese MQTT-Anfrage wurde in einem anderen Tab gelöscht.',
  'workbench.editors.mqtt.toast.updateFailed': 'Speichern der MQTT-Anfrage fehlgeschlagen',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'Speichern der MQTT-Anfrage fehlgeschlagen: {message}',
  'workbench.editors.mqtt.session.saveResponse': 'Antwort speichern',
  'workbench.editors.mqtt.toast.savedExample': 'Beispiel „{name}“ gespeichert',
  'workbench.editors.mqtt.toast.saveExampleFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.mqtt.toast.saveExampleFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  'workbench.editors.mqttExample.loading': 'Beispiel wird geladen…',
  'workbench.editors.mqttExample.notFound':
    'Dieses Beispiel existiert nicht mehr — es wurde vielleicht in einem anderen Tab gelöscht.',
  'workbench.editors.mqttExample.openInRequest': 'In der Anfrage öffnen',
  'workbench.editors.mqttExample.openInRequestTooltip':
    'Die übergeordnete MQTT-Anfrage mit dieser erfassten Form als ungespeicherte Änderungen öffnen.',
  'workbench.editors.mqttExample.capturedTooltip': 'Erfasst am {date}',
  'workbench.editors.mqttExample.toast.deletedOtherTab': 'Dieses Beispiel wurde in einem anderen Tab gelöscht.',
  'workbench.editors.mqttExample.toast.saveFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.mqttExample.toast.saveFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
} as const satisfies Catalog;
