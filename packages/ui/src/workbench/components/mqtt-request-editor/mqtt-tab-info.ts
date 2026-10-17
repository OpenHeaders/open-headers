/**
 * `(i)` popover content for the MQTT editor's tabs — one group-level
 * card per tab (what the tab holds, when it applies, where its values
 * come from), the settings rows' `InfoPopover` anatomy one level up.
 * The kicker is the packet the tab shapes, in wire vocabulary, raw (the
 * example card's token rule); Docs, Scripts and Spec shape no packet
 * and carry none. No example card: a tab is a group of knobs, not a
 * slice of the session the card draws.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { MqttTabKey } from './mqtt-tab-items';

const TITLE_KEY: Record<MqttTabKey, MessageKey> = {
  docs: 'workbench.editors.mqtt.tab.docs',
  message: 'workbench.editors.mqtt.tab.message',
  topics: 'workbench.editors.mqtt.tab.topics',
  auth: 'workbench.editors.mqtt.tab.auth',
  properties: 'workbench.editors.mqtt.tab.properties',
  lastwill: 'workbench.editors.mqtt.tab.lastWill',
  scripts: 'workbench.editors.mqtt.tab.scripts',
  settings: 'workbench.editors.mqtt.tab.settings',
  spec: 'workbench.editors.spec.tab',
};

const PACKET: Partial<Record<MqttTabKey, 'CONNECT' | 'SUBSCRIBE' | 'PUBLISH'>> = {
  message: 'PUBLISH',
  topics: 'SUBSCRIBE',
  auth: 'CONNECT',
  properties: 'CONNECT',
  lastwill: 'CONNECT',
  settings: 'CONNECT',
};

const SUMMARY_KEY: Record<MqttTabKey, MessageKey> = {
  docs: 'workbench.editors.mqtt.tabInfo.docs.summary',
  message: 'workbench.editors.mqtt.tabInfo.message.summary',
  topics: 'workbench.editors.mqtt.tabInfo.topics.summary',
  auth: 'workbench.editors.mqtt.tabInfo.auth.summary',
  properties: 'workbench.editors.mqtt.tabInfo.properties.summary',
  lastwill: 'workbench.editors.mqtt.tabInfo.lastWill.summary',
  scripts: 'workbench.editors.mqtt.tabInfo.scripts.summary',
  settings: 'workbench.editors.mqtt.tabInfo.settings.summary',
  spec: 'workbench.editors.mqtt.tabInfo.spec.summary',
};

const DETAIL_KEY: Record<MqttTabKey, MessageKey> = {
  docs: 'workbench.editors.mqtt.tabInfo.docs.detail',
  message: 'workbench.editors.mqtt.tabInfo.message.detail',
  topics: 'workbench.editors.mqtt.tabInfo.topics.detail',
  auth: 'workbench.editors.mqtt.tabInfo.auth.detail',
  properties: 'workbench.editors.mqtt.tabInfo.properties.detail',
  lastwill: 'workbench.editors.mqtt.tabInfo.lastWill.detail',
  scripts: 'workbench.editors.mqtt.tabInfo.scripts.detail',
  settings: 'workbench.editors.mqtt.tabInfo.settings.detail',
  spec: 'workbench.editors.mqtt.tabInfo.spec.detail',
};

/** Popover content for one editor tab. */
export function mqttTabInfo(t: Translate, tab: MqttTabKey): InfoPopoverContent {
  return {
    title: t(TITLE_KEY[tab]),
    kicker: PACKET[tab],
    summary: t(SUMMARY_KEY[tab]),
    description: t(DETAIL_KEY[tab]),
  };
}
