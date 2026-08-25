/**
 * Compose-surface vocabulary shared by the editor's modules: the
 * ENCODING → Monaco-language map (base64/hex author plain text), the
 * URL scheme surgery behind the header's scheme select and the
 * connect gate, and the publish wire the compose block emits — one
 * projection for the Send button, the ⌘/Ctrl+Shift+Enter chord, and
 * nothing else (saved rows publish AS STORED).
 */

import type { MqttPublishWire } from '@openheaders/core/bridge';
import type { MqttPayloadFormat } from '@openheaders/core/types';
import type { LanguageId } from '@openheaders/ui/workbench/languages/registry';
import { draftToProperties, type MqttDraft } from './draft';

/** Monaco language per compose ENCODING — base64/hex author plain text. */
export const PAYLOAD_FORMAT_LANGUAGE = {
  text: 'text',
  json: 'json',
  base64: 'text',
  hex: 'text',
} as const satisfies Record<MqttPayloadFormat, LanguageId>;

export const MQTT_SCHEMES = ['mqtt', 'mqtts', 'ws', 'wss'] as const;
export type MqttScheme = (typeof MQTT_SCHEMES)[number];

export const schemeOf = (url: string): MqttScheme => {
  for (const scheme of ['mqtts', 'mqtt', 'wss', 'ws'] as const) {
    if (url.startsWith(`${scheme}://`)) return scheme;
  }
  return 'mqtt';
};

/** Rewrite the URL's scheme prefix — string surgery on the draft URL
 *  only (templates and schemeless authorities stay as typed). */
export const withScheme = (url: string, scheme: MqttScheme): string => {
  for (const existing of ['mqtts', 'mqtt', 'wss', 'ws'] as const) {
    if (url.startsWith(`${existing}://`)) return `${scheme}://${url.slice(existing.length + 3)}`;
  }
  return `${scheme}://${url}`;
};

/** The compose block as one publish wire — templates unresolved (the
 *  executor resolves per send), optional fields absent at defaults. */
export const composePublishWire = (draft: MqttDraft): MqttPublishWire => {
  const properties = draftToProperties(draft.publishProperties);
  return {
    topic: draft.topic,
    payload: draft.payload,
    ...(draft.payloadFormat !== 'text' ? { format: draft.payloadFormat } : {}),
    ...(draft.qos !== 0 ? { qos: draft.qos } : {}),
    ...(draft.retain ? { retain: true } : {}),
    ...(properties !== undefined ? { properties } : {}),
  };
};
