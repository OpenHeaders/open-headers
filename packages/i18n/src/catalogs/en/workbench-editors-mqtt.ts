/**
 * Workbench editors — the MQTT client editor. Wire vocabulary
 * (mqtt/mqtts/ws/wss schemes, CONNECT/PUBLISH/SUBSCRIBE tokens, QoS,
 * topic filters, AsyncAPI) rides raw inside keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsMqtt = {
  // ── MQTT request editor ─────────────────────────────────────────────
  'workbench.editors.mqtt.notFound': 'MQTT request not found.',
  'workbench.editors.mqtt.urlPlaceholder': 'mqtt://broker.openheaders.com:1883',
  'workbench.editors.mqtt.version.tooltip':
    'MQTT protocol version the session speaks.\n5.0 · properties and subscription options\n3.1.1 · brokers that refuse 5.0',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.version.lockedWhileConnected': "Can't change version while connected.",
  'workbench.editors.mqtt.connect.label': 'Connect',
  'workbench.editors.mqtt.connect.disconnect': 'Disconnect',
  'workbench.editors.mqtt.connect.cancel': 'Cancel',
  'workbench.editors.mqtt.connect.reconnectNow': 'Reconnect now',
  'workbench.editors.mqtt.connect.reconnectNowHint': 'Dial the next reconnect attempt without waiting out the period',
  'workbench.editors.mqtt.connect.needsUrl': 'Enter a broker URL to connect.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Message',
  'workbench.editors.mqtt.tab.topics': 'Topics',
  'workbench.editors.mqtt.tab.auth': 'Authorization',
  'workbench.editors.mqtt.tab.properties': 'Properties',
  'workbench.editors.mqtt.tab.lastWill': 'Last Will',
  'workbench.editors.mqtt.tab.settings': 'Settings',
  // The tabs' (i) popovers — one card per tab: what it holds, when it
  // applies, where its values come from. The packet kicker rides raw.
  'workbench.editors.mqtt.tabInfo.docs.summary': 'Markdown notes kept with this request and shown to whoever opens it.',
  'workbench.editors.mqtt.tabInfo.docs.detail': 'Notes for people; nothing here reaches the broker.',
  'workbench.editors.mqtt.tabInfo.message.summary':
    'The topic, payload, QoS and retain flag that Send publishes, with the messages you saved for reuse.',
  'workbench.editors.mqtt.tabInfo.message.detail':
    'Publish properties (5.0) ride the Properties gear on the compose bar; variables resolve at Send.',
  'workbench.editors.mqtt.tabInfo.topics.summary':
    'The subscriptions the session opens right after the broker accepts the connection, one filter per row.',
  'workbench.editors.mqtt.tabInfo.topics.detail':
    'Wildcards + and # are welcome; toggled-off rows stay saved and do not subscribe; 5.0 options sit behind each row’s gear.',
  'workbench.editors.mqtt.tabInfo.auth.summary':
    'User Name and Password in the CONNECT packet; both MQTT versions carry them.',
  'workbench.editors.mqtt.tabInfo.auth.detail':
    'None sends no credential, Inherit takes the collection or workspace auth; variables resolve at Connect.',
  'workbench.editors.mqtt.tabInfo.properties.summary':
    'User properties sent once on CONNECT; free-form metadata the broker and other tooling can read.',
  'workbench.editors.mqtt.tabInfo.properties.detail':
    'An MQTT 5.0 feature; on a 3.1.1 session the rows stay saved and are not sent.',
  'workbench.editors.mqtt.tabInfo.lastWill.summary':
    'Registered with the broker on CONNECT and published for you if the session drops without a clean disconnect.',
  'workbench.editors.mqtt.tabInfo.lastWill.detail':
    'A will registers only with a topic; a block without one is kept, not sent. The delay and the properties are 5.0.',
  'workbench.editors.mqtt.tabInfo.scripts.summary':
    'Four hooks around the session: Before connect, Before publish, On message, After close.',
  'workbench.editors.mqtt.tabInfo.scripts.detail':
    'Collection and workspace scripts run around this request’s own; runs and failures show in the session’s Scripts tab.',
  'workbench.editors.mqtt.tabInfo.settings.summary':
    'The session’s CONNECT knobs: client id, clean start, keep-alive, session limits, reconnect policy, TLS.',
  'workbench.editors.mqtt.tabInfo.settings.detail':
    'A row left blank inherits the collection or workspace value; the request’s own values dot their rows.',
  'workbench.editors.mqtt.tabInfo.spec.summary':
    'Link an AsyncAPI spec to compose from its channels and example messages.',
  'workbench.editors.mqtt.tabInfo.spec.detail':
    'A binding is metadata about the request, not part of the session; nothing is sent.',
  'workbench.editors.mqtt.qos.compactLabel': 'QoS:',
  'workbench.editors.mqtt.qos.meaning0': 'At most once',
  'workbench.editors.mqtt.qos.meaning1': 'At least once',
  'workbench.editors.mqtt.qos.meaning2': 'Exactly once',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Send',
  // The Message bar's (i) cards — each lights its slice of the shared
  // example session's PUBLISH line.
  'workbench.editors.mqtt.composeInfo.topic':
    'The topic Send publishes to; a concrete name, no wildcards. Variables resolve at Send.',
  'workbench.editors.mqtt.composeInfo.qos':
    'The delivery level the broker owes this message; a subscriber receives it at the lower of this and its own subscription’s QoS.',
  'workbench.editors.mqtt.composeInfo.retain':
    'Asks the broker to keep this message as the topic’s latest and hand it to every new subscriber; an empty retained payload clears it.',
  'workbench.editors.mqtt.topicPlaceholder': 'Topic to publish to',
  'workbench.editors.mqtt.topicExample': 'e.g. sensors/1/temperature',
  'workbench.editors.mqtt.payload.formatText': 'Text',
  'workbench.editors.mqtt.payload.formatJson': 'JSON',
  'workbench.editors.mqtt.payload.formatBase64': 'Base64',
  'workbench.editors.mqtt.payload.formatHex': 'Hexadecimal',
  'workbench.editors.mqtt.payload.invalidGate': 'Fix the payload encoding first.',
  'workbench.editors.mqtt.payload.invalidBase64': 'Not valid Base64 — the decoded bytes are what would publish.',
  'workbench.editors.mqtt.payload.invalidHex': 'Not valid hex — pairs of 0-9 a-f digits decode to the published bytes.',
  'workbench.editors.mqtt.payloadPlaceholder': 'Compose the payload to publish…',
  'workbench.editors.mqtt.payloadPlaceholderBase64': 'Base64 of the binary payload, e.g. aGVsbG8=…',
  'workbench.editors.mqtt.payloadPlaceholderHex': 'Hex of the binary payload, e.g. 48656c6c6f…',
  'workbench.editors.mqtt.props.hint': 'MQTT 5.0 metadata sent with each message.',
  'workbench.editors.mqtt.props.title': 'Message properties',
  'workbench.editors.mqtt.props.gearLabel': 'Properties',
  'workbench.editors.mqtt.props.userProperties': 'User properties',
  'workbench.editors.mqtt.props.v5Note':
    'An MQTT 5.0 feature; on a 3.1.1 session the values stay saved and are not sent.',
  'workbench.editors.mqtt.props.v5GateLine': 'V3.1.1: values saved, not sent. V5 only',
  'workbench.editors.mqtt.props.v5Switch': 'Switch request to V5',
  'workbench.editors.mqtt.props.userPropKey': 'Property',
  'workbench.editors.mqtt.props.userPropValue': 'Value',
  'workbench.editors.mqtt.props.addUserProp': 'User property',
  'workbench.editors.mqtt.props.removeUserProp': 'Remove user property',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.responseTopicDesc':
    'Topic the receiver is asked to reply on — request/response over pub/sub. Empty means the property is not sent.',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.correlationDataDesc':
    'Opaque token the receiver copies onto its reply so the response can be matched to this message. Empty means the property is not sent.',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval',
  'workbench.editors.mqtt.props.messageExpiryDesc':
    'Seconds the broker keeps the message deliverable; once elapsed it is dropped instead of delivered. Empty means the message never expires.',
  'workbench.editors.mqtt.props.messageExpiryPlaceholder': 'No expiry (default)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.contentTypeDesc':
    'MIME type describing the payload, passed to receivers verbatim. Empty means the property is not sent.',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator',
  'workbench.editors.mqtt.props.payloadFormatIndicatorDesc':
    'Marks the payload as UTF-8 text rather than unspecified bytes; the broker and receivers may validate it.',
  'workbench.editors.mqtt.props.nonePlaceholder': 'None (default)',
  'workbench.editors.mqtt.props.sectionPropertiesDesc':
    'Free-form key–value pairs carried with the message — application metadata the broker passes through verbatim.',
  'workbench.editors.mqtt.saved.title': 'Saved messages',
  'workbench.editors.mqtt.saved.addTooltip': 'Save the current compose as a reusable message',
  'workbench.editors.mqtt.saved.topicTagPlaceholder': 'topic',
  'workbench.editors.mqtt.saved.showRail': 'Show saved messages',
  'workbench.editors.mqtt.saved.hideRail': 'Hide saved messages',
  'workbench.editors.mqtt.saved.emptyHint': 'Save messages to reuse them during an active connection.',
  'workbench.editors.mqtt.saved.defaultName': 'Message',
  'workbench.editors.mqtt.saved.sendTooltip': 'Publish this saved message as stored',
  'workbench.editors.mqtt.saved.rename': 'Rename',
  'workbench.editors.mqtt.saved.duplicate': 'Duplicate',
  'workbench.editors.mqtt.saved.delete': 'Delete',
  'workbench.editors.mqtt.topics.filterLabel': 'Topic',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Topic, e.g. sensors/+/temperature',
  'workbench.editors.mqtt.topics.qosColLabel': 'QoS',
  'workbench.editors.mqtt.topics.optionsColLabel': 'Options',
  'workbench.editors.mqtt.topics.optionsGearLabel': 'Subscription',
  'workbench.editors.mqtt.topics.optionsTitle': 'Subscription options',
  'workbench.editors.mqtt.topics.subscribeColLabel': 'Subscribe',
  'workbench.editors.mqtt.topics.subscribeLabel': 'Subscribe when the session opens',
  'workbench.editors.mqtt.topics.subscribeLiveLabel':
    'Subscribe / unsubscribe on the open session — the saved row is not edited',
  // The Topics table's column-header (i) cards — each lights its slice
  // of the shared example session's SUBSCRIBE leg.
  'workbench.editors.mqtt.topics.colInfo.filter':
    'The topic filter this row subscribes to; one SUBSCRIBE per row. + matches one level, # everything below it; variables resolve at Connect.',
  'workbench.editors.mqtt.topics.colInfo.qos':
    'The highest QoS the broker may deliver on this subscription; a message published at a lower level arrives at its own.',
  'workbench.editors.mqtt.topics.qosLevelsHeading': 'Levels',
  'workbench.editors.mqtt.topics.colInfo.options':
    'The MQTT 5.0 subscription options and user properties sent with this row’s SUBSCRIBE; a 3.1.1 session sends the filter and QoS alone.',
  'workbench.editors.mqtt.topics.colInfo.subscribe':
    'Whether the row subscribes when the session opens; off keeps it saved and silent. While connected the switch is the live toggle, and a refused grant marks the row.',
  'workbench.editors.mqtt.topics.optionsHint': 'MQTT 5.0 subscription options for this row.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local',
  'workbench.editors.mqtt.topics.noLocalDesc': 'The broker does not echo this client’s own publishes back to it.',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published',
  'workbench.editors.mqtt.topics.retainAsPublishedDesc':
    'Messages keep the RETAIN flag exactly as they were published.',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandlingDesc':
    'Whether the broker sends existing retained messages when this subscription is made.',
  'workbench.editors.mqtt.topics.retainHandlingValuesHeading': 'Values',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Receive on subscribe',
  'workbench.editors.mqtt.topics.retainHandling0Desc':
    'The broker sends the retained messages every time this subscription is made.',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · New subscriptions only',
  'workbench.editors.mqtt.topics.retainHandling1Desc':
    'The broker sends the retained messages only if this subscription does not already exist.',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · Don’t receive',
  'workbench.editors.mqtt.topics.retainHandling2Desc': 'The broker sends no retained messages for this subscription.',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.topics.subscriptionIdDesc':
    'A numeric id the broker attaches to messages delivered through this subscription.',
  'workbench.editors.mqtt.topics.subscriptionIdPlaceholder': 'None (default)',
  'workbench.editors.mqtt.topics.subscribeProperties': 'Subscription properties',
  'workbench.editors.mqtt.topics.subscribePropertiesDesc':
    'The Subscription Identifier the SUBSCRIBE packet carries as a property; the broker returns it on every message delivered through this subscription.',
  'workbench.editors.mqtt.topics.subscribeUserPropertiesDesc':
    'User Properties sent once with this row’s SUBSCRIBE packet. The broker defines their meaning; they are not attached to delivered messages.',
  'workbench.editors.mqtt.auth.help':
    'Sent as the CONNECT packet’s User Name and Password on every host — both MQTT versions carry them. Variables resolve at Connect; saved examples never capture the credential.',
  'workbench.editors.mqtt.auth.inheritUnsupported': '{type} — from {source} — cannot be applied to an MQTT session.',
  'workbench.editors.mqtt.auth.ownUnsupported': '{type} cannot be applied to an MQTT session.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Property',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Value',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Topic for the will',
  'workbench.editors.mqtt.will.topicExample': 'e.g. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, seconds — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayLabel': 'Will delay',
  'workbench.editors.mqtt.will.propsTitle': 'Will properties',
  'workbench.editors.mqtt.will.propsSummary':
    'MQTT 5.0 properties of the will message, registered inside CONNECT; the broker attaches them when it publishes the will.',
  'workbench.editors.mqtt.will.delayPlaceholder': '0 s (default)',
  // The Last Will bar's (i) cards — each lights its slice of the will
  // line on the shared example session's CONNECT leg.
  'workbench.editors.mqtt.will.info.topic':
    'The topic the broker publishes the will to; a concrete name, no wildcards. Without one no will is registered.',
  'workbench.editors.mqtt.will.info.qos': 'The delivery level the broker uses when it publishes the will.',
  'workbench.editors.mqtt.will.info.retain':
    'Keeps the will as the topic’s latest once published — how a status topic still reads offline after the drop.',
  'workbench.editors.mqtt.will.info.delay':
    'Seconds the broker waits after the session drops before publishing the will; a reconnect within the window cancels it. MQTT 5.0.',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Compose the will payload…',
  'workbench.editors.mqtt.spec.selectLabel': 'AsyncAPI spec',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'Link an AsyncAPI spec',
  'workbench.editors.mqtt.spec.summary': '{servers} servers · {channels} channels · {operations} operations',
  'workbench.editors.mqtt.spec.parseFailure': 'Spec did not parse: {message}',
  'workbench.editors.mqtt.spec.issues': '{count} spec issues',
  'workbench.editors.mqtt.spec.useExample': 'Use example message…',
  'workbench.editors.mqtt.spec.browser.hint':
    'Pick a message to compose its example payload; a channel message also fills the publish topic.',
  'workbench.editors.mqtt.spec.browser.servers': 'Servers',
  'workbench.editors.mqtt.spec.browser.channels': 'Channels',
  'workbench.editors.mqtt.spec.browser.operations': 'Operations',
  'workbench.editors.mqtt.spec.browser.components': 'Components',
  'workbench.editors.mqtt.settings.exampleCaption': 'Example session',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Identifier the CONNECT carries. Empty generates a fresh one per connect; resuming a broker session needs a stable ID.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Auto — generated on connect',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Start a fresh broker session on connect. Turn off to resume subscriptions and queued messages from a prior session — that also needs a stable Client ID.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'How long the broker keeps the session after disconnect — 0 ends it at disconnect. Clean Start only discards the previous session at connect; the interval governs the new one either way.',
  'workbench.editors.mqtt.settings.zeroDefault': '0 s (default)',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Ping interval the session promises the broker — the client answers and emits PINGREQ. Empty uses 60 s; 0 disables keep-alive.',
  'workbench.editors.mqtt.settings.keepAlivePlaceholder': '60 s (default)',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Connect timeout',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Wall-clock ceiling on the connection dial only — an open session has no ceiling. Empty uses the 30 s default.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': '30 s (default)',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'How many QoS 1/2 messages may be in flight toward this client at once. Empty allows the spec default of 65,535.',
  'workbench.editors.mqtt.settings.receiveMaximumPlaceholder': '65,535 (default)',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Largest packet this client accepts — the broker drops bigger ones. Empty sets no limit.',
  'workbench.editors.mqtt.settings.noLimit': 'No limit (default)',
  'workbench.editors.mqtt.settings.cleanSessionLabel': 'Clean Session',
  'workbench.editors.mqtt.settings.topicAliasMaximumLabel': 'Topic Alias Maximum',
  'workbench.editors.mqtt.settings.topicAliasMaximumHelp':
    'How many topic aliases the broker may address this client with — aliased publishes carry a number instead of the topic. Empty allows none, the spec default.',
  'workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder': '0 (default)',
  'workbench.editors.mqtt.settings.requestResponseInfoLabel': 'Request Response Information',
  'workbench.editors.mqtt.settings.requestResponseInfoHelp':
    'Ask the broker for Response Information on CONNACK — the base topic for request/response exchanges. Off by default.',
  'workbench.editors.mqtt.settings.requestProblemInfoLabel': 'Request Problem Information',
  'workbench.editors.mqtt.settings.requestProblemInfoHelp':
    'Allow the broker to attach Reason Strings and user properties to failure packets. On by default.',
  'workbench.editors.mqtt.settings.clientIdExample': 'e.g. reporter-1',
  'workbench.editors.mqtt.settings.alpnLabel': 'ALPN protocol',
  'workbench.editors.mqtt.settings.alpnHelp':
    'Application protocol offered in the TLS handshake of mqtts sessions — brokers multiplexing MQTT on a shared TLS port select on it. Empty offers none.',
  'workbench.editors.mqtt.settings.alpnPlaceholder': 'None (default)',
  'workbench.editors.mqtt.settings.alpnExample': 'e.g. mqtt',
  'workbench.editors.mqtt.settings.group.connection': 'Connection',
  'workbench.editors.mqtt.settings.group.session': 'Session — MQTT 5.0',
  'workbench.editors.mqtt.settings.group.tls': 'TLS & trust',
  'workbench.editors.mqtt.settings.group.resilience': 'Session resilience',
  'workbench.editors.mqtt.settings.groupInfo.resilience':
    'Whether a dropped connection reopens and how patiently: the redial period, the attempt cap, and the exponential backoff between attempts.',
  'workbench.editors.mqtt.settings.groupInfo.connection':
    'How the CONNECT opens the session: the identity it presents, whether it starts fresh, and the ping and dial ceilings it promises.',
  'workbench.editors.mqtt.settings.groupInfo.session':
    'MQTT 5.0 terms the CONNECT offers the broker: how long the session outlives a disconnect, plus the in-flight and packet-size ceilings this client accepts.',
  'workbench.editors.mqtt.settings.groupInfo.tls':
    'How mqtts/wss sessions establish trust: whether the broker certificate is verified against the system roots, the client certificate this device presents, the TLS version window and cipher list, and the SNI name and ALPN offer on the handshake.',
  'workbench.editors.mqtt.settings.sessionV311': 'MQTT 5.0 knobs — this request targets 3.1.1.',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.mqtt.session.emptyTitle': 'Response',
  'workbench.editors.mqtt.session.emptyHint': 'Connect to send and receive messages.',
  'workbench.editors.mqtt.session.connectFailed': 'Opening the session failed',
  'workbench.editors.mqtt.session.connectingBadge': 'Connecting',
  'workbench.editors.mqtt.session.connectedBadge': 'Connected',
  'workbench.editors.mqtt.session.notSubscribed': 'Not subscribed to any topics',
  'workbench.editors.mqtt.session.subscribedOne': 'Subscribed to 1 topic',
  'workbench.editors.mqtt.session.subscribedMany': 'Subscribed to {count} topics',
  'workbench.editors.mqtt.session.tab.timeline': 'Timeline',
  'workbench.editors.mqtt.session.tab.connection': 'Connection',
  'workbench.editors.mqtt.session.tab.scripts': 'Scripts',
  'workbench.editors.mqtt.tab.scripts': 'Scripts',
  'workbench.editors.mqtt.timeline.script': '{hook} — {levels}',
  'workbench.editors.mqtt.timeline.scriptFailed': '{hook} failed — {error}',
  'workbench.editors.mqtt.timeline.scriptDropped': '{hook} dropped the message — {level}',
  'workbench.editors.mqtt.timeline.scriptAttempt': 'attempt {attempt}',
  'workbench.editors.mqtt.session.scripts.empty': 'No script has run in this session.',
  'workbench.editors.mqtt.session.scripts.console': 'Console',
  'workbench.editors.mqtt.session.scripts.tests': 'Tests',
  'workbench.editors.mqtt.session.scripts.consoleEmpty': 'Nothing logged.',
  'workbench.editors.mqtt.session.scripts.testsEmpty': 'No assertions registered.',
  'workbench.editors.mqtt.session.scripts.attempt': 'attempt {attempt}',
  'workbench.editors.mqtt.session.scripts.atMessage': 'event {index}',
  'workbench.editors.mqtt.session.scripts.tag': 'Scripts · {count}',
  'workbench.editors.mqtt.session.scripts.tagTitle': 'Session scripts',
  'workbench.editors.mqtt.session.scripts.tagSummary':
    'The hooks that ran in this session, with the levels that contributed.',
  'workbench.editors.mqtt.session.scripts.tagSummaryFailed': 'A hook failed — its last error is listed under it.',
  'workbench.editors.mqtt.session.scripts.runs': '{count} runs',
  'workbench.editors.mqtt.session.scripts.runsOne': '1 run',
  'workbench.editors.mqtt.session.scripts.failed': '{count} failed',
  'workbench.editors.mqtt.session.scripts.dropped': '{count} dropped',
  'workbench.editors.mqtt.session.scripts.marksCapped':
    'Per-event detail stopped after {count} runs; the hooks keep running and the full counts land when the session settles.',
  'workbench.editors.mqtt.session.duration': '{ms} ms',
  'workbench.editors.mqtt.session.sendIdle': 'Connect to publish messages.',
  'workbench.editors.mqtt.session.sendFailed': 'Publishing the message failed',
  'workbench.editors.mqtt.session.subscribeFailed': 'Changing the subscription failed',
  'workbench.editors.mqtt.session.hostNotice': 'Running on the browser socket — {knobs} do not apply on this host.',
  'workbench.editors.mqtt.session.knobSslVerify': 'disabled SSL verification',
  'workbench.editors.mqtt.session.disconnectedTag': 'Disconnected',
  'workbench.editors.mqtt.session.brokerDisconnectedTag': 'Disconnected by broker',
  'workbench.editors.mqtt.session.severedTag': 'Connection severed',
  'workbench.editors.mqtt.session.stoppedTag': 'Stopped',
  'workbench.editors.mqtt.session.connectFailedTag': 'Connect failed',
  'workbench.editors.mqtt.session.abortedTag': 'Aborted',
  'workbench.editors.mqtt.timeline.aborted': 'Connection aborted',
  'workbench.editors.mqtt.timeline.abortedDisconnected': 'Disconnected from broker',
  'workbench.editors.mqtt.timeline.lost': 'Connection lost',
  'workbench.editors.mqtt.timeline.reconnecting': 'Reconnect attempt {attempt}',
  'workbench.editors.mqtt.timeline.reconnected': 'Reconnected to broker',
  'workbench.editors.mqtt.session.reconnectingBadge': 'Reconnecting',
  'workbench.editors.mqtt.session.reconnectRefusedTag': 'Reconnect refused',
  'workbench.editors.mqtt.session.reconnectRefused': 'reconnect refused: {reason}',
  'workbench.editors.mqtt.timeline.reconnectingAfter': 'Reconnect attempt {attempt} after {delay}',
  'workbench.editors.mqtt.timeline.reconnectingNow': 'Reconnect attempt {attempt} now',
  'workbench.editors.mqtt.timeline.reconnectedDroppedOne': 'one unacknowledged message dropped',
  'workbench.editors.mqtt.timeline.reconnectedDroppedMany': '{count} unacknowledged messages dropped',
  'workbench.editors.mqtt.session.reconnectExhaustedTag': 'Reconnect gave up',
  'workbench.editors.mqtt.session.reconnectExhausted': 'reconnect gave up after {attempts}',
  'workbench.editors.mqtt.session.reconnectExhaustedReason': 'reconnect gave up after {attempts}: {reason}',
  'workbench.editors.mqtt.session.reconnectAttemptsOne': 'one attempt',
  'workbench.editors.mqtt.session.reconnectAttemptsMany': '{count} attempts',
  'workbench.editors.mqtt.session.cleanDisconnect': 'clean disconnect',
  'workbench.editors.mqtt.session.brokerDisconnect': 'broker sent DISCONNECT: {reason}',
  'workbench.editors.mqtt.session.brokerDisconnectBare': 'broker sent DISCONNECT',
  'workbench.editors.mqtt.session.severed': 'the connection ended without a DISCONNECT',
  'workbench.editors.mqtt.session.connectionClientId': 'Client ID',
  'workbench.editors.mqtt.session.connectionReason': 'CONNACK reason',
  'workbench.editors.mqtt.session.connectionSessionPresent': 'Session present',
  'workbench.editors.mqtt.session.yes': 'Yes',
  'workbench.editors.mqtt.session.no': 'No',
  'workbench.editors.mqtt.session.connectionNote':
    'The CONNACK facts as the broker answered them — reason codes verbatim, names beside them.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.mqtt.timeline.connecting': 'Connecting',
  'workbench.editors.mqtt.timeline.connected': 'Connected to broker',
  'workbench.editors.mqtt.timeline.disconnected': 'Disconnected from broker',
  'workbench.editors.mqtt.timeline.stopped': 'Stopped',
  'workbench.editors.mqtt.timeline.subscribed': 'Subscribed to',
  'workbench.editors.mqtt.timeline.unsubscribed': 'Unsubscribed from',
  'workbench.editors.mqtt.timeline.grantFailed': 'Refused, code {code}',
  'workbench.editors.mqtt.timeline.grantFailedNamed': '{name} ({code})',
  'workbench.editors.mqtt.timeline.noMatches': 'No messages match the filter.',
  'workbench.editors.mqtt.timeline.searchMessages': 'Search messages',
  'workbench.editors.mqtt.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} message', other: '{count} messages' }),
  'workbench.editors.mqtt.timeline.messageCountFiltered': '{shown} of {total} messages',
  'workbench.editors.mqtt.timeline.dropped': '{count} older messages rolled off the capture',
  'workbench.editors.mqtt.timeline.topicFilterAll': 'All topics',
  'workbench.editors.mqtt.timeline.filterAll': 'All',
  'workbench.editors.mqtt.timeline.filterSent': 'Sent',
  'workbench.editors.mqtt.timeline.filterReceived': 'Received',
  'workbench.editors.mqtt.timeline.filterLifecycle': 'Lifecycle only',
  'workbench.editors.mqtt.timeline.newestFirst': 'Newest first',
  'workbench.editors.mqtt.timeline.oldestFirst': 'Oldest first',
  'workbench.editors.mqtt.timeline.sortOrder': 'Sort order',
  'workbench.editors.mqtt.timeline.sortBy': 'Sort by',
  'workbench.editors.mqtt.timeline.view': 'View',
  'workbench.editors.mqtt.timeline.viewTooltip': 'Display options',
  'workbench.editors.mqtt.timeline.viewGroup': 'Group',
  'workbench.editors.mqtt.timeline.groupByTopic': 'Group by topic',
  'workbench.editors.mqtt.timeline.groupByDirection': 'Group by direction',
  'workbench.editors.mqtt.timeline.rowsPerGroup': 'Rows per group',
  'workbench.editors.mqtt.timeline.noLimit': 'No limit',
  'workbench.editors.mqtt.timeline.clearMessages': 'Clear messages',
  'workbench.editors.mqtt.timeline.clear': 'Clear',
  'workbench.editors.mqtt.timeline.filterAllMessages': 'All messages',
  'workbench.editors.mqtt.timeline.directionFilter': 'Message direction',
  'workbench.editors.mqtt.timeline.trustCertificate': 'Trust certificate',
  'workbench.editors.mqtt.timeline.newMessages': 'New messages',
  'workbench.editors.mqtt.timeline.binaryMessage': 'Binary payload ({bytes} bytes)',
  'workbench.editors.mqtt.timeline.emptyMessage': '(empty)',
  'workbench.editors.mqtt.timeline.copyMessage': 'Copy message',
  'workbench.editors.mqtt.timeline.info.label': 'Message details',
  'workbench.editors.mqtt.timeline.info.size': 'Size',
  'workbench.editors.mqtt.timeline.info.sentAsWritten': 'Sent as written',
  'workbench.editors.mqtt.timeline.retainedTag': 'Retained',
  'workbench.editors.mqtt.timeline.sentAria': 'Sent',
  'workbench.editors.mqtt.timeline.receivedAria': 'Received',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'This MQTT request was deleted in another tab.',
  'workbench.editors.mqtt.toast.updateFailed': 'Saving the MQTT request failed',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'Saving the MQTT request failed: {message}',
  'workbench.editors.mqtt.session.saveResponse': 'Save Response',
  'workbench.editors.mqtt.toast.savedExample': 'Saved example {name}',
  'workbench.editors.mqtt.toast.saveExampleFailed': 'Saving the example failed',
  'workbench.editors.mqtt.toast.saveExampleFailedDetail': 'Saving the example failed: {message}',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.mqttExample.loading': 'Loading example…',
  'workbench.editors.mqttExample.notFound': 'This example is gone — it may have been deleted in another tab.',
  'workbench.editors.mqttExample.openInRequest': 'Open in Request',
  'workbench.editors.mqttExample.openInRequestTooltip':
    'Open the parent MQTT request with this captured shape as unsaved edits.',
  'workbench.editors.mqttExample.capturedTooltip': 'Captured {date}',
  'workbench.editors.mqttExample.toast.deletedOtherTab': 'This example was deleted in another tab.',
  'workbench.editors.mqttExample.toast.saveFailed': 'Saving the example failed',
  'workbench.editors.mqttExample.toast.saveFailedDetail': 'Saving the example failed: {message}',
} as const satisfies Catalog;
