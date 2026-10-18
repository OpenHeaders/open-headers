/**
 * `(i)` info-popover content for the MQTT editor's knobs — the request
 * Settings tab's `SettingsRowInfo` idiom brought to the session:
 * kicker, title, the shared example card with the popover's slice lit,
 * then the knob's own copy.
 *
 * Every popover leads with the SAME canonical example session — one
 * CONNECT, one SUBSCRIBE, one PUBLISH — and lights its own token, so
 * reading across the Settings rows, the topic-row subscription options
 * and the message-properties popover builds one coherent picture of a
 * single session seen knob by knob. The Settings-tab rows partition
 * the CONNECT tokens; the topic-row options partition the SUBSCRIBE
 * tokens; the message-properties rows partition the PUBLISH tokens;
 * each gear popover's title card lights its whole sub-slice (the
 * group-header idiom), so the titles partition the leg the rows
 * itemize.
 *
 * The rows of the shared blocks (dial, session resilience, TLS &
 * trust) compose the blocks' own copy — summary, description,
 * glossary — under this editor's card; the dial leg is the card's one
 * variant slot (the shared `DIAL_LEG_TEXT` vocabulary). Card tokens
 * ride raw (wire vocabulary — the column-card precedent); only the
 * caption is localized.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { DIAL_LEG_TEXT, type DialInfoKey, dialRowInfo, isDialInfoKey } from '../shared/dial/dial-row-info';
import { isResilienceInfoKey, resilienceRowInfo } from '../shared/resilience/resilience-row-info';
import { isTlsTrustInfoKey, type TlsTrustInfoKey, tlsTrustRowInfo } from '../shared/tls-trust/tls-trust-row-info';
import { MQTT_GROUP_LABEL_KEY, type MqttSettingsGroupKey } from './settings-groups';

/** The reconnect quartet MQTT seats on the shared resilience block —
 *  the liveness rows never render here (keep-alive is the protocol's
 *  own CONNECT knob). */
export type MqttResilienceInfoKey = 'autoReconnect' | 'reconnectPeriod' | 'reconnectMaxAttempts' | 'reconnectBackoff';

/** The editor's own knobs — the Settings-tab rows, the Topics table's
 *  column headers, the topic-row subscription options and the
 *  message-properties rows (section headers included). */
type MqttOwnInfoKey =
  | 'topicFilter'
  | 'subscribeQos'
  | 'subscribeOptions'
  | 'subscribe'
  | 'publishTopic'
  | 'publishQos'
  | 'publishRetain'
  | 'willTopic'
  | 'willQos'
  | 'willRetain'
  | 'willDelay'
  | 'willProperties'
  | 'willUserProperties'
  | 'willResponseTopic'
  | 'willCorrelationData'
  | 'willMessageExpiry'
  | 'willContentType'
  | 'willPayloadFormatIndicator'
  | 'clientId'
  | 'executionPlace'
  | 'cleanStart'
  | 'cleanSession'
  | 'sessionExpiry'
  | 'keepAlive'
  | 'timeout'
  | 'receiveMaximum'
  | 'maxPacketSize'
  | 'topicAliasMaximum'
  | 'requestResponseInformation'
  | 'requestProblemInformation'
  | 'alpn'
  | 'noLocal'
  | 'retainAsPublished'
  | 'retainHandling'
  | 'subscriptionId'
  | 'subscriptionOptions'
  | 'subscribeProperties'
  | 'subscribeUserProperties'
  | 'responseTopic'
  | 'correlationData'
  | 'messageExpiry'
  | 'contentType'
  | 'payloadFormatIndicator'
  | 'publishProperties'
  | 'publishUserProperties';

/** One key per knob that opens a popover with the card. */
export type MqttInfoKey = MqttOwnInfoKey | DialInfoKey | TlsTrustInfoKey | MqttResilienceInfoKey;

/** The three gear popovers' cards — the Message bar's and the Last
 *  Will bar's properties gear, the Topics row's options gear. Their
 *  kicker is the PACKET the gear's values ride, raw (the tab cards'
 *  rule): the one word that tells the four user-property homes apart. */
export type GearInfoKey =
  | 'publishProperties'
  | 'publishUserProperties'
  | 'responseTopic'
  | 'correlationData'
  | 'messageExpiry'
  | 'contentType'
  | 'payloadFormatIndicator'
  | 'willProperties'
  | 'willUserProperties'
  | 'willResponseTopic'
  | 'willCorrelationData'
  | 'willMessageExpiry'
  | 'willContentType'
  | 'willPayloadFormatIndicator'
  | 'subscriptionOptions'
  | 'noLocal'
  | 'retainAsPublished'
  | 'retainHandling'
  | 'subscribeProperties'
  | 'subscribeUserProperties'
  | 'subscriptionId';

const GEAR_PACKET: Record<GearInfoKey, 'CONNECT' | 'SUBSCRIBE' | 'PUBLISH'> = {
  publishProperties: 'PUBLISH',
  publishUserProperties: 'PUBLISH',
  responseTopic: 'PUBLISH',
  correlationData: 'PUBLISH',
  messageExpiry: 'PUBLISH',
  contentType: 'PUBLISH',
  payloadFormatIndicator: 'PUBLISH',
  willProperties: 'CONNECT',
  willUserProperties: 'CONNECT',
  willResponseTopic: 'CONNECT',
  willCorrelationData: 'CONNECT',
  willMessageExpiry: 'CONNECT',
  willContentType: 'CONNECT',
  willPayloadFormatIndicator: 'CONNECT',
  subscriptionOptions: 'SUBSCRIBE',
  noLocal: 'SUBSCRIBE',
  retainAsPublished: 'SUBSCRIBE',
  retainHandling: 'SUBSCRIBE',
  subscribeProperties: 'SUBSCRIBE',
  subscribeUserProperties: 'SUBSCRIBE',
  subscriptionId: 'SUBSCRIBE',
};

const isGearInfoKey = (key: MqttInfoKey): key is GearInfoKey => key in GEAR_PACKET;

/** The packet a gear card's knob rides — the gear popovers' title row
 *  wears it as a mark, the same word their cards carry as the kicker. */
export const mqttGearPacket = (key: GearInfoKey): 'CONNECT' | 'SUBSCRIBE' | 'PUBLISH' => GEAR_PACKET[key];

/** The single session every popover illustrates. Holding one example
 * fixed across all popovers lets the user map each knob onto the same
 * concrete session. */
const EX = {
  url: 'mqtts://broker.openheaders.com:8883',
  version: 'MQTT 5.0',
  clientId: 'id: reporter-1',
  cleanStart: 'clean start ✓',
  sessionExpiry: 'expiry: 300 s',
  keepAlive: 'keep-alive: 60 s',
  route: 'direct',
  dial: 'dial ≤ 30 s',
  reconnect: 'reconnect: every 5 s',
  reconnectLimit: 'retry ≤ 10 · backoff',
  receiveMax: 'in-flight ≤ 20',
  maxPacket: 'packet ≤ 1 MB',
  topicAlias: 'aliases ≤ 10',
  rri: 'response info ✓',
  rpi: 'problem info ✓',
  tlsWindow: 'TLS 1.2–1.3',
  verify: 'verify ✓',
  suite: 'TLS_AES_128_GCM_SHA256',
  clientCert: 'client cert: reporter-1',
  sni: 'sni: broker.openheaders.com',
  alpn: 'alpn: mqtt',
  willTopic: 'will: clients/reporter-1/status',
  willQos: 'QoS 1',
  willRetain: 'retain ✓',
  willDelay: 'will delay: 10 s',
  willProps: 'props ✓',
  subscribe: 'SUBSCRIBE',
  filter: 'sensors/+/temp',
  qos: 'QoS 1',
  noLocal: 'no local ✓',
  rap: 'retain as published ✓',
  retained: 'retained: on subscribe',
  subId: 'sub id: 7',
  props: 'props: trace=on',
  pubTopic: 'sensors/1/temp',
  pubQos: 'QoS 1',
  pubRetain: 'retain ✓',
  respTopic: 'reply to: sensors/1/ack',
  corr: 'corr: 42',
  msgExpiry: 'expires: 60 s',
  contentType: 'type: application/json',
  pfi: 'utf-8 ✓',
  pubProps: 'props: trace=on',
} as const;

type TokenId = keyof typeof EX;

/** Which slice of the example each Settings-tab group lights — the
 * group headers partition the CONNECT leg their rows itemize, the
 * options popover's section-header idiom. */
const GROUP_TOKENS: Record<MqttSettingsGroupKey, readonly TokenId[]> = {
  connection: ['clientId', 'cleanStart', 'keepAlive', 'route', 'dial'],
  resilience: ['reconnect', 'reconnectLimit'],
  session: ['sessionExpiry', 'receiveMax', 'maxPacket', 'topicAlias', 'rri', 'rpi'],
  tls: ['tlsWindow', 'verify', 'suite', 'clientCert', 'sni', 'alpn'],
};

/** Which slice of the example each knob lights. Rows light their
 * single token (the TLS window is one token — min and max both light
 * it); the gear popovers' title and section cards light their whole
 * sub-slice; the Topics table's column headers partition the SUBSCRIBE
 * leg — the Subscribe column lights the opener itself; the Message
 * bar's knobs light the PUBLISH line, the Last Will bar's the will line
 * of the CONNECT leg. The will's properties popover — the Message
 * popover on its will leg — lights the will line's one properties
 * token from every card: the Will Properties travel INSIDE CONNECT,
 * so a PUBLISH token would place them on the wrong packet. */
const HIGHLIGHT: Record<MqttInfoKey, readonly TokenId[]> = {
  topicFilter: ['filter'],
  subscribeQos: ['qos'],
  subscribeOptions: ['noLocal', 'rap', 'retained', 'subId', 'props'],
  subscribe: ['subscribe'],
  publishTopic: ['pubTopic'],
  publishQos: ['pubQos'],
  publishRetain: ['pubRetain'],
  willTopic: ['willTopic'],
  willQos: ['willQos'],
  willRetain: ['willRetain'],
  willDelay: ['willDelay'],
  willProperties: ['willProps'],
  willUserProperties: ['willProps'],
  willResponseTopic: ['willProps'],
  willCorrelationData: ['willProps'],
  willMessageExpiry: ['willProps'],
  willContentType: ['willProps'],
  willPayloadFormatIndicator: ['willProps'],
  clientId: ['clientId'],
  executionPlace: ['route'],
  cleanStart: ['cleanStart'],
  cleanSession: ['cleanStart'],
  sessionExpiry: ['sessionExpiry'],
  keepAlive: ['keepAlive'],
  resolveToAddress: ['route'],
  proxy: ['route'],
  proxyUrl: ['route'],
  proxyCredentials: ['route'],
  timeout: ['dial'],
  autoReconnect: ['reconnect'],
  reconnectPeriod: ['reconnect'],
  reconnectMaxAttempts: ['reconnectLimit'],
  reconnectBackoff: ['reconnectLimit'],
  receiveMaximum: ['receiveMax'],
  maxPacketSize: ['maxPacket'],
  topicAliasMaximum: ['topicAlias'],
  requestResponseInformation: ['rri'],
  requestProblemInformation: ['rpi'],
  sslVerification: ['verify'],
  clientCertificate: ['clientCert'],
  tlsMin: ['tlsWindow'],
  tlsMax: ['tlsWindow'],
  tlsCipherSuites: ['suite'],
  sni: ['sni'],
  alpn: ['alpn'],
  noLocal: ['noLocal'],
  retainAsPublished: ['rap'],
  retainHandling: ['retained'],
  subscriptionId: ['subId'],
  subscriptionOptions: ['noLocal', 'rap', 'retained'],
  subscribeProperties: ['subId'],
  subscribeUserProperties: ['props'],
  responseTopic: ['respTopic'],
  correlationData: ['corr'],
  messageExpiry: ['msgExpiry'],
  contentType: ['contentType'],
  payloadFormatIndicator: ['pfi'],
  publishProperties: ['respTopic', 'corr', 'msgExpiry', 'contentType', 'pfi', 'pubProps'],
  publishUserProperties: ['pubProps'],
};

/** Rows that swap the route slot to their own dial leg. */
const DIAL_VARIANT: Partial<Record<MqttInfoKey, string>> = DIAL_LEG_TEXT;

function MqttExampleCard({ lit, routeText }: { lit: ReadonlySet<TokenId>; routeText?: string }) {
  const t = useT();
  const tok = (id: TokenId, text: string = EX[id]) => ({ id, text });
  const lines: ExampleCardLine<TokenId>[] = [
    { opener: 'CONNECT', tokens: [tok('url'), tok('version')] },
    {
      tokens: [
        tok('clientId'),
        tok('cleanStart'),
        tok('sessionExpiry'),
        tok('keepAlive'),
        tok('route', routeText),
        tok('dial'),
        tok('reconnect'),
        tok('reconnectLimit'),
        tok('receiveMax'),
        tok('maxPacket'),
        tok('topicAlias'),
        tok('rri'),
        tok('rpi'),
      ],
    },
    { tokens: [tok('tlsWindow'), tok('verify'), tok('suite'), tok('clientCert'), tok('sni'), tok('alpn')] },
    { tokens: [tok('willTopic'), tok('willQos'), tok('willRetain'), tok('willDelay'), tok('willProps')] },
    { opener: tok('subscribe'), tokens: [tok('filter'), tok('qos')] },
    { tokens: [tok('noLocal'), tok('rap'), tok('retained'), tok('subId'), tok('props')] },
    { opener: 'PUBLISH', tokens: [tok('pubTopic'), tok('pubQos'), tok('pubRetain')] },
    {
      tokens: [tok('respTopic'), tok('corr'), tok('msgExpiry'), tok('contentType'), tok('pfi'), tok('pubProps')],
    },
  ];
  return <ExampleCard caption={t('workbench.editors.mqtt.settings.exampleCaption')} lines={lines} lit={lit} />;
}

const TITLE_KEY: Record<MqttOwnInfoKey, MessageKey> = {
  topicFilter: 'workbench.editors.mqtt.topics.filterLabel',
  subscribeQos: 'workbench.editors.mqtt.topics.qosColLabel',
  subscribeOptions: 'workbench.editors.mqtt.topics.optionsColLabel',
  subscribe: 'workbench.editors.mqtt.topics.subscribeColLabel',
  publishTopic: 'workbench.editors.mqtt.topics.filterLabel',
  publishQos: 'workbench.editors.mqtt.topics.qosColLabel',
  publishRetain: 'workbench.editors.mqtt.retainLabel',
  willTopic: 'workbench.editors.mqtt.topics.filterLabel',
  willQos: 'workbench.editors.mqtt.topics.qosColLabel',
  willRetain: 'workbench.editors.mqtt.retainLabel',
  willDelay: 'workbench.editors.mqtt.will.delayLabel',
  willProperties: 'workbench.editors.mqtt.will.propsTitle',
  willUserProperties: 'workbench.editors.mqtt.props.userProperties',
  willResponseTopic: 'workbench.editors.mqtt.props.responseTopic',
  willCorrelationData: 'workbench.editors.mqtt.props.correlationData',
  willMessageExpiry: 'workbench.editors.mqtt.props.messageExpiry',
  willContentType: 'workbench.editors.mqtt.props.contentType',
  willPayloadFormatIndicator: 'workbench.editors.mqtt.props.payloadFormatIndicator',
  clientId: 'workbench.editors.mqtt.settings.clientIdLabel',
  executionPlace: 'workbench.editors.request.settings.executionPlace',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartLabel',
  cleanSession: 'workbench.editors.mqtt.settings.cleanSessionLabel',
  sessionExpiry: 'workbench.editors.mqtt.settings.sessionExpiryLabel',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveLabel',
  timeout: 'workbench.editors.mqtt.settings.timeoutLabel',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumLabel',
  maxPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeLabel',
  topicAliasMaximum: 'workbench.editors.mqtt.settings.topicAliasMaximumLabel',
  requestResponseInformation: 'workbench.editors.mqtt.settings.requestResponseInfoLabel',
  requestProblemInformation: 'workbench.editors.mqtt.settings.requestProblemInfoLabel',
  alpn: 'workbench.editors.mqtt.settings.alpnLabel',
  noLocal: 'workbench.editors.mqtt.topics.noLocal',
  retainAsPublished: 'workbench.editors.mqtt.topics.retainAsPublished',
  retainHandling: 'workbench.editors.mqtt.topics.retainHandling',
  subscriptionId: 'workbench.editors.mqtt.topics.subscriptionId',
  subscriptionOptions: 'workbench.editors.mqtt.topics.optionsTitle',
  subscribeProperties: 'workbench.editors.mqtt.topics.subscribeProperties',
  subscribeUserProperties: 'workbench.editors.mqtt.props.userProperties',
  responseTopic: 'workbench.editors.mqtt.props.responseTopic',
  correlationData: 'workbench.editors.mqtt.props.correlationData',
  messageExpiry: 'workbench.editors.mqtt.props.messageExpiry',
  contentType: 'workbench.editors.mqtt.props.contentType',
  payloadFormatIndicator: 'workbench.editors.mqtt.props.payloadFormatIndicator',
  publishProperties: 'workbench.editors.mqtt.props.title',
  publishUserProperties: 'workbench.editors.mqtt.props.userProperties',
};

const SUMMARY_KEY: Record<Exclude<MqttOwnInfoKey, 'retainHandling'>, MessageKey> = {
  topicFilter: 'workbench.editors.mqtt.topics.colInfo.filter',
  subscribeQos: 'workbench.editors.mqtt.topics.colInfo.qos',
  subscribeOptions: 'workbench.editors.mqtt.topics.colInfo.options',
  subscribe: 'workbench.editors.mqtt.topics.colInfo.subscribe',
  publishTopic: 'workbench.editors.mqtt.composeInfo.topic',
  publishQos: 'workbench.editors.mqtt.composeInfo.qos',
  publishRetain: 'workbench.editors.mqtt.composeInfo.retain',
  willTopic: 'workbench.editors.mqtt.will.info.topic',
  willQos: 'workbench.editors.mqtt.will.info.qos',
  willRetain: 'workbench.editors.mqtt.will.info.retain',
  willDelay: 'workbench.editors.mqtt.will.info.delay',
  willProperties: 'workbench.editors.mqtt.will.propsSummary',
  willUserProperties: 'workbench.editors.mqtt.props.sectionPropertiesDesc',
  willResponseTopic: 'workbench.editors.mqtt.props.responseTopicDesc',
  willCorrelationData: 'workbench.editors.mqtt.props.correlationDataDesc',
  willMessageExpiry: 'workbench.editors.mqtt.props.messageExpiryDesc',
  willContentType: 'workbench.editors.mqtt.props.contentTypeDesc',
  willPayloadFormatIndicator: 'workbench.editors.mqtt.props.payloadFormatIndicatorDesc',
  clientId: 'workbench.editors.mqtt.settings.clientIdHelp',
  executionPlace: 'workbench.editors.request.settings.executionPlaceInfo',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartHelp',
  cleanSession: 'workbench.editors.mqtt.settings.cleanStartHelp',
  sessionExpiry: 'workbench.editors.mqtt.settings.sessionExpiryHelp',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveHelp',
  timeout: 'workbench.editors.mqtt.settings.timeoutHelp',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumHelp',
  maxPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeHelp',
  topicAliasMaximum: 'workbench.editors.mqtt.settings.topicAliasMaximumHelp',
  requestResponseInformation: 'workbench.editors.mqtt.settings.requestResponseInfoHelp',
  requestProblemInformation: 'workbench.editors.mqtt.settings.requestProblemInfoHelp',
  alpn: 'workbench.editors.mqtt.settings.alpnHelp',
  noLocal: 'workbench.editors.mqtt.topics.noLocalDesc',
  retainAsPublished: 'workbench.editors.mqtt.topics.retainAsPublishedDesc',
  subscriptionId: 'workbench.editors.mqtt.topics.subscriptionIdDesc',
  subscriptionOptions: 'workbench.editors.mqtt.topics.optionsHint',
  subscribeProperties: 'workbench.editors.mqtt.topics.subscribePropertiesDesc',
  subscribeUserProperties: 'workbench.editors.mqtt.topics.subscribeUserPropertiesDesc',
  responseTopic: 'workbench.editors.mqtt.props.responseTopicDesc',
  correlationData: 'workbench.editors.mqtt.props.correlationDataDesc',
  messageExpiry: 'workbench.editors.mqtt.props.messageExpiryDesc',
  contentType: 'workbench.editors.mqtt.props.contentTypeDesc',
  payloadFormatIndicator: 'workbench.editors.mqtt.props.payloadFormatIndicatorDesc',
  publishProperties: 'workbench.editors.mqtt.props.hint',
  publishUserProperties: 'workbench.editors.mqtt.props.sectionPropertiesDesc',
};

/** The three gear popovers' title cards carry the 5.0 rule as their
 *  description — the one line the retired version hint used to say,
 *  now read where the disabled controls are explained. */
const DESCRIPTION_KEY: Partial<Record<MqttOwnInfoKey, MessageKey>> = {
  publishProperties: 'workbench.editors.mqtt.props.v5Note',
  willProperties: 'workbench.editors.mqtt.props.v5Note',
  subscriptionOptions: 'workbench.editors.mqtt.props.v5Note',
};

/** The Settings-tab rows carry their group's label (the group headers
 * carry the tab name); the Topics table's column headers carry the
 * Topics tab; the two compose bars' knobs carry their tab; the gear
 * popovers' cards carry their packet (`GEAR_PACKET`, not here). */
const KICKER_KEY: Record<Exclude<MqttInfoKey, GearInfoKey>, MessageKey> = {
  topicFilter: 'workbench.editors.mqtt.tab.topics',
  subscribeQos: 'workbench.editors.mqtt.tab.topics',
  subscribeOptions: 'workbench.editors.mqtt.tab.topics',
  subscribe: 'workbench.editors.mqtt.tab.topics',
  publishTopic: 'workbench.editors.mqtt.tab.message',
  publishQos: 'workbench.editors.mqtt.tab.message',
  publishRetain: 'workbench.editors.mqtt.tab.message',
  willTopic: 'workbench.editors.mqtt.tab.lastWill',
  willQos: 'workbench.editors.mqtt.tab.lastWill',
  willRetain: 'workbench.editors.mqtt.tab.lastWill',
  willDelay: 'workbench.editors.mqtt.tab.lastWill',
  clientId: MQTT_GROUP_LABEL_KEY.connection,
  executionPlace: MQTT_GROUP_LABEL_KEY.connection,
  cleanStart: MQTT_GROUP_LABEL_KEY.connection,
  cleanSession: MQTT_GROUP_LABEL_KEY.connection,
  sessionExpiry: MQTT_GROUP_LABEL_KEY.session,
  keepAlive: MQTT_GROUP_LABEL_KEY.connection,
  resolveToAddress: MQTT_GROUP_LABEL_KEY.connection,
  proxy: MQTT_GROUP_LABEL_KEY.connection,
  proxyUrl: MQTT_GROUP_LABEL_KEY.connection,
  proxyCredentials: MQTT_GROUP_LABEL_KEY.connection,
  timeout: MQTT_GROUP_LABEL_KEY.connection,
  autoReconnect: MQTT_GROUP_LABEL_KEY.resilience,
  reconnectPeriod: MQTT_GROUP_LABEL_KEY.resilience,
  reconnectMaxAttempts: MQTT_GROUP_LABEL_KEY.resilience,
  reconnectBackoff: MQTT_GROUP_LABEL_KEY.resilience,
  receiveMaximum: MQTT_GROUP_LABEL_KEY.session,
  maxPacketSize: MQTT_GROUP_LABEL_KEY.session,
  topicAliasMaximum: MQTT_GROUP_LABEL_KEY.session,
  requestResponseInformation: MQTT_GROUP_LABEL_KEY.session,
  requestProblemInformation: MQTT_GROUP_LABEL_KEY.session,
  sslVerification: MQTT_GROUP_LABEL_KEY.tls,
  clientCertificate: MQTT_GROUP_LABEL_KEY.tls,
  tlsMin: MQTT_GROUP_LABEL_KEY.tls,
  tlsMax: MQTT_GROUP_LABEL_KEY.tls,
  tlsCipherSuites: MQTT_GROUP_LABEL_KEY.tls,
  sni: MQTT_GROUP_LABEL_KEY.tls,
  alpn: MQTT_GROUP_LABEL_KEY.tls,
};

const GROUP_SUMMARY_KEY: Record<MqttSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.mqtt.settings.groupInfo.connection',
  resilience: 'workbench.editors.mqtt.settings.groupInfo.resilience',
  session: 'workbench.editors.mqtt.settings.groupInfo.session',
  tls: 'workbench.editors.mqtt.settings.groupInfo.tls',
};

/** Popover content for a Settings-tab group header: the group's whole
 * sub-slice of the shared example lit at once. */
export function mqttSettingsGroupInfo(t: Translate, group: MqttSettingsGroupKey): InfoPopoverContent {
  return {
    title: t(MQTT_GROUP_LABEL_KEY[group]),
    kicker: t('workbench.editors.mqtt.tab.settings'),
    diagram: <MqttExampleCard lit={new Set(GROUP_TOKENS[group])} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one MQTT knob. */
export function mqttSettingsRowInfo(t: Translate, infoKey: MqttInfoKey): InfoPopoverContent {
  const kicker = isGearInfoKey(infoKey) ? GEAR_PACKET[infoKey] : t(KICKER_KEY[infoKey]);
  const card = {
    diagram: <MqttExampleCard lit={new Set(HIGHLIGHT[infoKey])} routeText={DIAL_VARIANT[infoKey]} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  };
  if (isDialInfoKey(infoKey)) return { ...dialRowInfo(t, infoKey, kicker), ...card };
  if (isTlsTrustInfoKey(infoKey)) return { ...tlsTrustRowInfo(t, infoKey, kicker), ...card };
  if (isResilienceInfoKey(infoKey)) return { ...resilienceRowInfo(t, infoKey, kicker, 'none'), ...card };
  const base = { title: t(TITLE_KEY[infoKey]), kicker, ...card };
  if (infoKey === 'subscribeQos' || infoKey === 'publishQos' || infoKey === 'willQos') {
    return {
      ...base,
      summary: t(SUMMARY_KEY[infoKey]),
      sections: [
        {
          heading: t('workbench.editors.mqtt.topics.qosLevelsHeading'),
          items: [
            { label: '0', desc: t('workbench.editors.mqtt.qos.meaning0') },
            { label: '1', desc: t('workbench.editors.mqtt.qos.meaning1') },
            { label: '2', desc: t('workbench.editors.mqtt.qos.meaning2') },
          ],
        },
      ],
    };
  }
  if (infoKey === 'retainHandling') {
    return {
      ...base,
      summary: t('workbench.editors.mqtt.topics.retainHandlingDesc'),
      sections: [
        {
          heading: t('workbench.editors.mqtt.topics.retainHandlingValuesHeading'),
          layout: 'stacked',
          items: [
            {
              label: t('workbench.editors.mqtt.topics.retainHandling0'),
              desc: t('workbench.editors.mqtt.topics.retainHandling0Desc'),
            },
            {
              label: t('workbench.editors.mqtt.topics.retainHandling1'),
              desc: t('workbench.editors.mqtt.topics.retainHandling1Desc'),
            },
            {
              label: t('workbench.editors.mqtt.topics.retainHandling2'),
              desc: t('workbench.editors.mqtt.topics.retainHandling2Desc'),
            },
          ],
        },
      ],
    };
  }
  const descriptionKey = DESCRIPTION_KEY[infoKey];
  return {
    ...base,
    summary: t(SUMMARY_KEY[infoKey]),
    ...(descriptionKey !== undefined ? { description: t(descriptionKey) } : {}),
  };
}
