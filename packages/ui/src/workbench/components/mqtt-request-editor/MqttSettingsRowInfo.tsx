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
 * each popover's section headers light their whole sub-slice (the
 * group-header idiom), so the headers partition the leg the rows
 * itemize.
 *
 * Card tokens ride raw (wire vocabulary — the column-card precedent);
 * only the caption is localized.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { MQTT_GROUP_LABEL_KEY, type MqttSettingsGroupKey } from './settings-groups';

/** One key per knob that opens a popover with the card — the Settings
 *  tab rows, the topic-row subscription options and the
 *  message-properties rows (section headers included). */
export type MqttInfoKey =
  | 'clientId'
  | 'cleanStart'
  | 'cleanSession'
  | 'sessionExpiry'
  | 'keepAlive'
  | 'timeout'
  | 'autoReconnect'
  | 'reconnectPeriod'
  | 'reconnectMaxAttempts'
  | 'reconnectBackoff'
  | 'receiveMaximum'
  | 'maxPacketSize'
  | 'topicAliasMaximum'
  | 'requestResponseInformation'
  | 'requestProblemInformation'
  | 'sslVerification'
  | 'clientCertificate'
  | 'sni'
  | 'alpn'
  | 'noLocal'
  | 'retainAsPublished'
  | 'retainHandling'
  | 'subscriptionId'
  | 'subscribeProperties'
  | 'subscribeSettings'
  | 'responseTopic'
  | 'correlationData'
  | 'messageExpiry'
  | 'contentType'
  | 'payloadFormatIndicator'
  | 'publishProperties'
  | 'publishSettings';

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
  dial: 'dial ≤ 30 s',
  reconnect: 'reconnect: every 5 s',
  reconnectLimit: 'retry ≤ 10 · backoff',
  verify: 'verify ✓',
  clientCert: 'client cert: reporter-1',
  sni: 'sni: broker.openheaders.com',
  alpn: 'alpn: mqtt',
  receiveMax: 'in-flight ≤ 20',
  maxPacket: 'packet ≤ 1 MB',
  topicAlias: 'aliases ≤ 10',
  rri: 'response info ✓',
  rpi: 'problem info ✓',
  filter: 'sensors/+/temp',
  qos: 'QoS 1',
  noLocal: 'no local ✓',
  rap: 'retain as published ✓',
  retained: 'retained: on subscribe',
  subId: 'sub id: 7',
  props: 'props: trace=on',
  pubTopic: 'sensors/1/temp',
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
  connection: ['clientId', 'cleanStart', 'keepAlive', 'dial'],
  resilience: ['reconnect', 'reconnectLimit'],
  session: ['sessionExpiry', 'receiveMax', 'maxPacket', 'topicAlias', 'rri', 'rpi'],
  tls: ['verify', 'clientCert', 'sni', 'alpn'],
};

/** Which slice of the example each knob lights. Rows light their
 * single token; the two options-popover section headers light their
 * whole sub-slice. */
const HIGHLIGHT: Record<MqttInfoKey, readonly TokenId[]> = {
  clientId: ['clientId'],
  cleanStart: ['cleanStart'],
  cleanSession: ['cleanStart'],
  sessionExpiry: ['sessionExpiry'],
  keepAlive: ['keepAlive'],
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
  sni: ['sni'],
  alpn: ['alpn'],
  noLocal: ['noLocal'],
  retainAsPublished: ['rap'],
  retainHandling: ['retained'],
  subscriptionId: ['subId'],
  subscribeProperties: ['props'],
  subscribeSettings: ['noLocal', 'rap', 'retained', 'subId'],
  responseTopic: ['respTopic'],
  correlationData: ['corr'],
  messageExpiry: ['msgExpiry'],
  contentType: ['contentType'],
  payloadFormatIndicator: ['pfi'],
  publishProperties: ['pubProps'],
  publishSettings: ['respTopic', 'corr', 'msgExpiry', 'contentType', 'pfi'],
};

function MqttExampleCard({ lit }: { lit: ReadonlySet<TokenId> }) {
  const t = useT();
  const tok = (id: TokenId) => <span className={`oh-info-eg-tok${lit.has(id) ? ' oh-info-eg-hl' : ''}`}>{EX[id]}</span>;
  return (
    <div className="oh-info-eg">
      <div className="oh-info-eg-cap">{t('workbench.editors.mqtt.settings.exampleCaption')}</div>
      <div className="oh-info-eg-card">
        <div className="oh-info-eg-line">
          <span className="oh-info-eg-method">CONNECT</span> {tok('url')}
          {' · '}
          {tok('version')}
        </div>
        <div className="oh-info-eg-line">
          {tok('clientId')}
          {' · '}
          {tok('cleanStart')}
          {' · '}
          {tok('sessionExpiry')}
          {' · '}
          {tok('keepAlive')}
          {' · '}
          {tok('dial')}
          {' · '}
          {tok('reconnect')}
          {' · '}
          {tok('reconnectLimit')}
          {' · '}
          {tok('verify')}
          {' · '}
          {tok('receiveMax')}
          {' · '}
          {tok('maxPacket')}
          {' · '}
          {tok('topicAlias')}
          {' · '}
          {tok('rri')}
          {' · '}
          {tok('rpi')}
        </div>
        <div className="oh-info-eg-line">
          {tok('clientCert')}
          {' · '}
          {tok('sni')}
          {' · '}
          {tok('alpn')}
        </div>
        <div className="oh-info-eg-line">
          <span className="oh-info-eg-method">SUBSCRIBE</span> {tok('filter')}
          {' · '}
          {tok('qos')}
        </div>
        <div className="oh-info-eg-line">
          {tok('noLocal')}
          {' · '}
          {tok('rap')}
          {' · '}
          {tok('retained')}
          {' · '}
          {tok('subId')}
          {' · '}
          {tok('props')}
        </div>
        <div className="oh-info-eg-line">
          <span className="oh-info-eg-method">PUBLISH</span> {tok('pubTopic')}
        </div>
        <div className="oh-info-eg-line">
          {tok('respTopic')}
          {' · '}
          {tok('corr')}
          {' · '}
          {tok('msgExpiry')}
          {' · '}
          {tok('contentType')}
          {' · '}
          {tok('pfi')}
          {' · '}
          {tok('pubProps')}
        </div>
      </div>
    </div>
  );
}

const TITLE_KEY: Record<MqttInfoKey, MessageKey> = {
  clientId: 'workbench.editors.mqtt.settings.clientIdLabel',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartLabel',
  cleanSession: 'workbench.editors.mqtt.settings.cleanSessionLabel',
  sessionExpiry: 'workbench.editors.mqtt.settings.sessionExpiryLabel',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveLabel',
  timeout: 'workbench.editors.mqtt.settings.timeoutLabel',
  autoReconnect: 'workbench.editors.request.settings.autoReconnect',
  reconnectPeriod: 'workbench.editors.request.settings.reconnectPeriod',
  reconnectMaxAttempts: 'workbench.editors.request.settings.reconnectMaxAttempts',
  reconnectBackoff: 'workbench.editors.request.settings.reconnectBackoff',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumLabel',
  maxPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeLabel',
  topicAliasMaximum: 'workbench.editors.mqtt.settings.topicAliasMaximumLabel',
  requestResponseInformation: 'workbench.editors.mqtt.settings.requestResponseInfoLabel',
  requestProblemInformation: 'workbench.editors.mqtt.settings.requestProblemInfoLabel',
  sslVerification: 'workbench.editors.request.settings.sslVerification',
  clientCertificate: 'workbench.editors.request.settings.clientCertificate',
  sni: 'workbench.editors.request.settings.sni',
  alpn: 'workbench.editors.mqtt.settings.alpnLabel',
  noLocal: 'workbench.editors.mqtt.topics.noLocal',
  retainAsPublished: 'workbench.editors.mqtt.topics.retainAsPublished',
  retainHandling: 'workbench.editors.mqtt.topics.retainHandling',
  subscriptionId: 'workbench.editors.mqtt.topics.subscriptionId',
  subscribeProperties: 'workbench.editors.mqtt.topics.subscribeProperties',
  subscribeSettings: 'workbench.editors.mqtt.topics.subscribeSettings',
  responseTopic: 'workbench.editors.mqtt.props.responseTopic',
  correlationData: 'workbench.editors.mqtt.props.correlationData',
  messageExpiry: 'workbench.editors.mqtt.props.messageExpiry',
  contentType: 'workbench.editors.mqtt.props.contentType',
  payloadFormatIndicator: 'workbench.editors.mqtt.props.payloadFormatIndicator',
  publishProperties: 'workbench.editors.mqtt.props.sectionProperties',
  publishSettings: 'workbench.editors.mqtt.props.sectionSettings',
};

const SUMMARY_KEY: Record<Exclude<MqttInfoKey, 'retainHandling'>, MessageKey> = {
  clientId: 'workbench.editors.mqtt.settings.clientIdHelp',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartHelp',
  cleanSession: 'workbench.editors.mqtt.settings.cleanStartHelp',
  sessionExpiry: 'workbench.editors.mqtt.settings.sessionExpiryHelp',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveHelp',
  timeout: 'workbench.editors.mqtt.settings.timeoutHelp',
  autoReconnect: 'workbench.editors.request.settings.autoReconnectInfo',
  reconnectPeriod: 'workbench.editors.request.settings.reconnectPeriodInfo',
  reconnectMaxAttempts: 'workbench.editors.request.settings.reconnectMaxAttemptsInfo',
  reconnectBackoff: 'workbench.editors.request.settings.reconnectBackoffInfo',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumHelp',
  maxPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeHelp',
  topicAliasMaximum: 'workbench.editors.mqtt.settings.topicAliasMaximumHelp',
  requestResponseInformation: 'workbench.editors.mqtt.settings.requestResponseInfoHelp',
  requestProblemInformation: 'workbench.editors.mqtt.settings.requestProblemInfoHelp',
  sslVerification: 'workbench.editors.request.settings.sslVerificationSummary',
  clientCertificate: 'workbench.editors.request.settings.clientCertificateInfo',
  sni: 'workbench.editors.request.settings.sniInfo',
  alpn: 'workbench.editors.mqtt.settings.alpnHelp',
  noLocal: 'workbench.editors.mqtt.topics.noLocalDesc',
  retainAsPublished: 'workbench.editors.mqtt.topics.retainAsPublishedDesc',
  subscriptionId: 'workbench.editors.mqtt.topics.subscriptionIdDesc',
  subscribeProperties: 'workbench.editors.mqtt.topics.subscribePropertiesDesc',
  subscribeSettings: 'workbench.editors.mqtt.topics.optionsHint',
  responseTopic: 'workbench.editors.mqtt.props.responseTopicDesc',
  correlationData: 'workbench.editors.mqtt.props.correlationDataDesc',
  messageExpiry: 'workbench.editors.mqtt.props.messageExpiryDesc',
  contentType: 'workbench.editors.mqtt.props.contentTypeDesc',
  payloadFormatIndicator: 'workbench.editors.mqtt.props.payloadFormatIndicatorDesc',
  publishProperties: 'workbench.editors.mqtt.props.sectionPropertiesDesc',
  publishSettings: 'workbench.editors.mqtt.props.hint',
};

/** The Settings-tab rows carry their group's label (the group headers
 * carry the tab name); the option and message-properties rows carry
 * their section's header; the topic-options section headers carry the
 * Topics tab, the message-properties ones the trigger's own name. */
const KICKER_KEY: Record<MqttInfoKey, MessageKey> = {
  clientId: MQTT_GROUP_LABEL_KEY.connection,
  cleanStart: MQTT_GROUP_LABEL_KEY.connection,
  cleanSession: MQTT_GROUP_LABEL_KEY.connection,
  sessionExpiry: MQTT_GROUP_LABEL_KEY.session,
  keepAlive: MQTT_GROUP_LABEL_KEY.connection,
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
  sni: MQTT_GROUP_LABEL_KEY.tls,
  alpn: MQTT_GROUP_LABEL_KEY.tls,
  noLocal: 'workbench.editors.mqtt.topics.subscribeSettings',
  retainAsPublished: 'workbench.editors.mqtt.topics.subscribeSettings',
  retainHandling: 'workbench.editors.mqtt.topics.subscribeSettings',
  subscriptionId: 'workbench.editors.mqtt.topics.subscribeSettings',
  subscribeProperties: 'workbench.editors.mqtt.tab.topics',
  subscribeSettings: 'workbench.editors.mqtt.tab.topics',
  responseTopic: 'workbench.editors.mqtt.props.sectionSettings',
  correlationData: 'workbench.editors.mqtt.props.sectionSettings',
  messageExpiry: 'workbench.editors.mqtt.props.sectionSettings',
  contentType: 'workbench.editors.mqtt.props.sectionSettings',
  payloadFormatIndicator: 'workbench.editors.mqtt.props.sectionSettings',
  publishProperties: 'workbench.editors.mqtt.props.buttonTooltip',
  publishSettings: 'workbench.editors.mqtt.props.buttonTooltip',
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
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one MQTT knob. */
export function mqttSettingsRowInfo(t: Translate, infoKey: MqttInfoKey): InfoPopoverContent {
  const base = {
    title: t(TITLE_KEY[infoKey]),
    kicker: t(KICKER_KEY[infoKey]),
    diagram: <MqttExampleCard lit={new Set(HIGHLIGHT[infoKey])} />,
  };
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
  return { ...base, summary: t(SUMMARY_KEY[infoKey]) };
}
