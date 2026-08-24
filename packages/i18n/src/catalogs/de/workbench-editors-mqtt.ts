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
    'MQTT-Protokollversion der Sitzung. 5.0 schaltet Eigenschaften und Abonnementoptionen frei; 3.1.1 zielt auf Broker, die 5.0 ablehnen.',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.scheme.tooltip':
    'Das Schema wählt den Transport: mqtt/mqtts öffnen einen TCP-Socket in der Desktop-App oder auf dem Server; ws/wss fahren MQTT über WebSocket auf jedem Host.',
  'workbench.editors.mqtt.connect.label': 'Verbinden',
  'workbench.editors.mqtt.connect.pending':
    'Live-Sitzungen kommen mit einem kommenden Update — die Anfrage lässt sich jetzt schon verfassen, speichern und synchronisieren.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Nachricht',
  'workbench.editors.mqtt.tab.topics': 'Themen',
  'workbench.editors.mqtt.tab.auth': 'Autorisierung',
  'workbench.editors.mqtt.tab.properties': 'Eigenschaften',
  'workbench.editors.mqtt.tab.lastWill': 'Testament',
  'workbench.editors.mqtt.tab.spec': 'AsyncAPI',
  'workbench.editors.mqtt.tab.settings': 'Einstellungen',
  'workbench.editors.mqtt.qos.q0': 'QoS 0 · Höchstens einmal',
  'workbench.editors.mqtt.qos.q1': 'QoS 1 · Mindestens einmal',
  'workbench.editors.mqtt.qos.q2': 'QoS 2 · Genau einmal',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Senden',
  'workbench.editors.mqtt.topicPlaceholder': 'Zielthema, z. B. sensors/1/temperature',
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
  'workbench.editors.mqtt.props.buttonTooltip': 'Nachrichteneigenschaften',
  'workbench.editors.mqtt.props.hint': 'MQTT-5.0-Metadaten, die mit jeder Nachricht gesendet werden.',
  'workbench.editors.mqtt.props.v311':
    'Nachrichteneigenschaften sind ein MQTT-5.0-Feature — diese Anfrage zielt auf 3.1.1.',
  'workbench.editors.mqtt.props.userPropKey': 'Eigenschaft',
  'workbench.editors.mqtt.props.userPropValue': 'Wert',
  'workbench.editors.mqtt.props.addUserProp': 'Benutzereigenschaft',
  'workbench.editors.mqtt.props.removeUserProp': 'Benutzereigenschaft entfernen',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval (s)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator — Nutzlast als UTF-8-Text markieren',
  'workbench.editors.mqtt.saved.title': 'Gespeicherte Nachrichten',
  'workbench.editors.mqtt.saved.addTooltip': 'Aktuellen Entwurf als wiederverwendbare Nachricht speichern',
  'workbench.editors.mqtt.saved.emptyHint':
    'Speichere Nachrichten, um sie während einer aktiven Verbindung wiederzuverwenden.',
  'workbench.editors.mqtt.saved.defaultName': 'Nachricht',
  'workbench.editors.mqtt.saved.rename': 'Umbenennen',
  'workbench.editors.mqtt.saved.duplicate': 'Duplizieren',
  'workbench.editors.mqtt.saved.delete': 'Löschen',
  'workbench.editors.mqtt.topics.hint':
    'Abonnements, mit denen die Sitzung öffnet. Wildcards + und # sind willkommen; abgeschaltete Zeilen bleiben gespeichert, abonnieren aber nicht.',
  'workbench.editors.mqtt.topics.filterLabel': 'Themenfilter',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Themenfilter, z. B. sensors/+/temperature',
  'workbench.editors.mqtt.topics.optionsLabel': 'QoS / Abonnement',
  'workbench.editors.mqtt.topics.subscribeLabel': 'Beim Öffnen der Sitzung abonnieren',
  'workbench.editors.mqtt.topics.optionsHint': 'MQTT-5.0-Abonnementoptionen für diese Zeile.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local — eigene Veröffentlichungen dieses Clients nicht zurücksenden',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published — RETAIN-Flag unverändert weiterreichen',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Zurückgehaltene Nachrichten beim Abonnieren senden',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Nur bei einem neuen Abonnement senden',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · Keine zurückgehaltenen Nachrichten senden',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.auth.typeLabel': 'Typ',
  'workbench.editors.mqtt.auth.typeNone': 'Keine Authentifizierung',
  'workbench.editors.mqtt.auth.typeBasic': 'Basic-Authentifizierung',
  'workbench.editors.mqtt.auth.pending':
    'Benutzername/Passwort auf CONNECT kommt mit einem kommenden Update, zusammen mit der Sitzungsebene.',
  'workbench.editors.mqtt.userProps.hint':
    'Benutzereigenschaften auf CONNECT — freie Metadaten, die Broker und andere Werkzeuge lesen können.',
  'workbench.editors.mqtt.userProps.v311':
    'CONNECT-Benutzereigenschaften sind ein MQTT-5.0-Feature — diese Anfrage zielt auf 3.1.1.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Eigenschaft',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Wert',
  'workbench.editors.mqtt.will.hint':
    'Wird mit CONNECT beim Broker hinterlegt und von ihm veröffentlicht, falls die Sitzung ohne sauberes Trennen abbricht. Ein leeres Thema bedeutet kein Testament.',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Testament-Thema, z. B. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, in Sekunden — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayPlaceholder': 'Verzögerung (s)',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Testament-Nutzlast verfassen…',
  'workbench.editors.mqtt.spec.selectLabel': 'AsyncAPI-Spezifikation',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'AsyncAPI-Spezifikation verknüpfen',
  'workbench.editors.mqtt.spec.summary': '{servers} Server · {channels} Kanäle · {operations} Operationen',
  'workbench.editors.mqtt.spec.parseFailure': 'Spezifikation ließ sich nicht parsen: {message}',
  'workbench.editors.mqtt.spec.issues': '{count} Spezifikationsprobleme',
  'workbench.editors.mqtt.specFooter.using': 'Verwendet {name}',
  'workbench.editors.mqtt.specFooter.none': 'Keine AsyncAPI-Spezifikation verknüpft',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Kennung, die CONNECT trägt. Leer erzeugt bei jeder Verbindung eine neue; das Fortsetzen einer Broker-Sitzung braucht eine stabile ID.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Pro Verbindung erzeugt',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Beim Verbinden eine frische Broker-Sitzung beginnen. Ausschalten setzt Abonnements und wartende Nachrichten einer früheren Sitzung fort — das braucht ebenfalls eine stabile Client ID.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval (s)',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Wie lange der Broker die Sitzung nach dem Trennen behält. Mit aktivem Clean Start greift es nur, wenn eine spätere Verbindung die Sitzung fortsetzt.',
  'workbench.editors.mqtt.settings.v311Knob': 'Ein MQTT-5.0-Feature — diese Anfrage zielt auf 3.1.1.',
  'workbench.editors.mqtt.settings.zeroDefault': '0',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive (s)',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Herzschlag-Intervall, das die Sitzung dem Broker zusagt — der Client antwortet und sendet PINGREQ. Leer verwendet 60 s; 0 schaltet ab.',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Verbindungs-Timeout (ms)',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Wanduhr-Obergrenze nur für den Verbindungsaufbau — eine offene Sitzung hat keine Obergrenze. Leer verwendet den App-Standard.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': 'Standard',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Wie viele QoS-1/2-Nachrichten gleichzeitig zu diesem Client unterwegs sein dürfen. Leer überlässt es dem Broker.',
  'workbench.editors.mqtt.settings.brokerDefault': 'Broker-Standard',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size (Bytes)',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Größtes Paket, das dieser Client annimmt — größere verwirft der Broker. Leer setzt kein Limit.',
  'workbench.editors.mqtt.settings.noLimit': 'Kein Limit',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'SSL-Zertifikatsprüfung',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    'Das Broker-Zertifikat für mqtts/wss-Sitzungen gegen die Systemwurzeln prüfen. Für selbstsignierte Entwicklungs-Broker ausschalten.',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Diese MQTT-Anfrage wurde in einem anderen Tab gelöscht.',
  'workbench.editors.mqtt.toast.updateFailed': 'Speichern der MQTT-Anfrage fehlgeschlagen',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'Speichern der MQTT-Anfrage fehlgeschlagen: {message}',
} as const satisfies Catalog;
