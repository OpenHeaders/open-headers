/**
 * Topical group vocabulary of the MQTT Settings tab — shared by the
 * live knob sections and each row's info-popover kicker, so both read
 * in the same order with the same labels. The request Settings tab's
 * `settings-groups` idiom brought to the session editor.
 */

import type { MessageKey } from '@openheaders/i18n';

export type MqttSettingsGroupKey = 'connection' | 'session' | 'tls';

export const MQTT_GROUP_ORDER: MqttSettingsGroupKey[] = ['connection', 'session', 'tls'];

export const MQTT_GROUP_LABEL_KEY: Record<MqttSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.mqtt.settings.group.connection',
  session: 'workbench.editors.mqtt.settings.group.session',
  tls: 'workbench.editors.mqtt.settings.group.tls',
};
