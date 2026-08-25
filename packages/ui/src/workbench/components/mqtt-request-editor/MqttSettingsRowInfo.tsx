/**
 * `(i)` info-popover content for the MQTT editor's knobs — the request
 * Settings tab's `SettingsRowInfo` idiom brought to the session:
 * kicker, title, the shared example card with the popover's slice lit,
 * then the knob's own copy.
 *
 * Every popover leads with the SAME canonical example session — one
 * CONNECT and one SUBSCRIBE — and lights its own token, so reading
 * across the Settings rows and the topic-row subscription options
 * builds one coherent picture of a single session seen knob by knob.
 * The Settings-tab rows partition the CONNECT tokens; the topic-row
 * options partition the SUBSCRIBE tokens; the options popover's two
 * section headers light their whole sub-slice (the group-header
 * idiom), so the headers partition the leg the rows itemize.
 *
 * Card tokens ride raw (wire vocabulary — the column-card precedent);
 * only the caption is localized.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { MQTT_GROUP_LABEL_KEY, type MqttSettingsGroupKey } from './settings-groups';

/** One key per knob that opens a popover with the card — the Settings
 *  tab rows plus the topic-row subscription options (the two section
 *  headers included). */
export type MqttInfoKey =
  | 'clientId'
  | 'cleanStart'
  | 'sessionExpiry'
  | 'keepAlive'
  | 'timeout'
  | 'receiveMaximum'
  | 'maxPacketSize'
  | 'sslVerification'
  | 'noLocal'
  | 'retainAsPublished'
  | 'retainHandling'
  | 'subscriptionId'
  | 'subscribeProperties'
  | 'subscribeSettings';

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
  verify: 'verify ✓',
  receiveMax: 'in-flight ≤ 20',
  maxPacket: 'packet ≤ 1 MB',
  filter: 'sensors/+/temp',
  qos: 'QoS 1',
  noLocal: 'no local ✓',
  rap: 'retain as published ✓',
  retained: 'retained: on subscribe',
  subId: 'sub id: 7',
  props: 'props: trace=on',
} as const;

type TokenId = keyof typeof EX;

/** Which slice of the example each Settings-tab group lights — the
 * group headers partition the CONNECT leg their rows itemize, the
 * options popover's section-header idiom. */
const GROUP_TOKENS: Record<MqttSettingsGroupKey, readonly TokenId[]> = {
  connection: ['clientId', 'cleanStart', 'keepAlive', 'dial'],
  session: ['sessionExpiry', 'receiveMax', 'maxPacket'],
  tls: ['verify'],
};

/** Which slice of the example each knob lights. Rows light their
 * single token; the two options-popover section headers light their
 * whole sub-slice. */
const HIGHLIGHT: Record<MqttInfoKey, readonly TokenId[]> = {
  clientId: ['clientId'],
  cleanStart: ['cleanStart'],
  sessionExpiry: ['sessionExpiry'],
  keepAlive: ['keepAlive'],
  timeout: ['dial'],
  receiveMaximum: ['receiveMax'],
  maxPacketSize: ['maxPacket'],
  sslVerification: ['verify'],
  noLocal: ['noLocal'],
  retainAsPublished: ['rap'],
  retainHandling: ['retained'],
  subscriptionId: ['subId'],
  subscribeProperties: ['props'],
  subscribeSettings: ['noLocal', 'rap', 'retained', 'subId'],
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
          {tok('verify')}
          {' · '}
          {tok('receiveMax')}
          {' · '}
          {tok('maxPacket')}
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
      </div>
    </div>
  );
}

const TITLE_KEY: Record<MqttInfoKey, MessageKey> = {
  clientId: 'workbench.editors.mqtt.settings.clientIdLabel',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartLabel',
  sessionExpiry: 'workbench.editors.mqtt.settings.sessionExpiryLabel',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveLabel',
  timeout: 'workbench.editors.mqtt.settings.timeoutLabel',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumLabel',
  maxPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeLabel',
  sslVerification: 'workbench.editors.mqtt.settings.sslVerifyLabel',
  noLocal: 'workbench.editors.mqtt.topics.noLocal',
  retainAsPublished: 'workbench.editors.mqtt.topics.retainAsPublished',
  retainHandling: 'workbench.editors.mqtt.topics.retainHandling',
  subscriptionId: 'workbench.editors.mqtt.topics.subscriptionId',
  subscribeProperties: 'workbench.editors.mqtt.topics.subscribeProperties',
  subscribeSettings: 'workbench.editors.mqtt.topics.subscribeSettings',
};

const SUMMARY_KEY: Record<Exclude<MqttInfoKey, 'retainHandling'>, MessageKey> = {
  clientId: 'workbench.editors.mqtt.settings.clientIdHelp',
  cleanStart: 'workbench.editors.mqtt.settings.cleanStartHelp',
  sessionExpiry: 'workbench.editors.mqtt.settings.sessionExpiryHelp',
  keepAlive: 'workbench.editors.mqtt.settings.keepAliveHelp',
  timeout: 'workbench.editors.mqtt.settings.timeoutHelp',
  receiveMaximum: 'workbench.editors.mqtt.settings.receiveMaximumHelp',
  maxPacketSize: 'workbench.editors.mqtt.settings.maxPacketSizeHelp',
  sslVerification: 'workbench.editors.mqtt.settings.sslVerifyHelp',
  noLocal: 'workbench.editors.mqtt.topics.noLocalDesc',
  retainAsPublished: 'workbench.editors.mqtt.topics.retainAsPublishedDesc',
  subscriptionId: 'workbench.editors.mqtt.topics.subscriptionIdDesc',
  subscribeProperties: 'workbench.editors.mqtt.topics.subscribePropertiesDesc',
  subscribeSettings: 'workbench.editors.mqtt.topics.optionsHint',
};

/** The Settings-tab rows carry their group's label (the group headers
 * carry the tab name); the option rows carry their section's header;
 * the section headers carry the Topics tab. */
const KICKER_KEY: Record<MqttInfoKey, MessageKey> = {
  clientId: MQTT_GROUP_LABEL_KEY.connection,
  cleanStart: MQTT_GROUP_LABEL_KEY.connection,
  sessionExpiry: MQTT_GROUP_LABEL_KEY.session,
  keepAlive: MQTT_GROUP_LABEL_KEY.connection,
  timeout: MQTT_GROUP_LABEL_KEY.connection,
  receiveMaximum: MQTT_GROUP_LABEL_KEY.session,
  maxPacketSize: MQTT_GROUP_LABEL_KEY.session,
  sslVerification: MQTT_GROUP_LABEL_KEY.tls,
  noLocal: 'workbench.editors.mqtt.topics.subscribeSettings',
  retainAsPublished: 'workbench.editors.mqtt.topics.subscribeSettings',
  retainHandling: 'workbench.editors.mqtt.topics.subscribeSettings',
  subscriptionId: 'workbench.editors.mqtt.topics.subscribeSettings',
  subscribeProperties: 'workbench.editors.mqtt.tab.topics',
  subscribeSettings: 'workbench.editors.mqtt.tab.topics',
};

const GROUP_SUMMARY_KEY: Record<MqttSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.mqtt.settings.groupInfo.connection',
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
