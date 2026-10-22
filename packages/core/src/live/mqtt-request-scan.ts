/**
 * Pure collector for every templatable string in an MQTT request,
 * grouped by the entity field it belongs to.
 *
 * Keep in lock-step with the MQTT executor (`mqtt-exec/execute.ts`):
 * every string it feeds through the session's `resolve` — at Connect
 * and on the compose publish rider — is a candidate for `{{VAR}}`
 * resolution and must be visible here. The version lens is the
 * executor's: the 5.0-only surfaces (CONNECT and per-message user
 * properties, the message property blocks) never reach a 3.1.1 wire,
 * so their templates do not count on one; a will without a topic is
 * held, never sent; a subscription row switched off never subscribes.
 *
 * The input is the entity's FIELD LIST, so the persisted entity and
 * the editor's save projection satisfy it alike — one walk feeds the
 * editor's lifecycle flag and tab dots, the Variable Scope panel and
 * every other reader of "which references does THIS request carry".
 */

import type { MqttMessageProperties, MqttRequest } from '../types';
import { collectAuthTemplateStrings, collectPairTemplateStrings } from './auth-scan';

export type MqttTemplateSource = Pick<
  MqttRequest,
  | 'url'
  | 'protocolVersion'
  | 'clientId'
  | 'auth'
  | 'userProperties'
  | 'lastWill'
  | 'topics'
  | 'topic'
  | 'payload'
  | 'publishProperties'
  | 'sniServerName'
  | 'alpnProtocol'
>;

/** The templates by the entity field they ride, in wire order. */
export interface MqttTemplateGroups {
  url: string[];
  auth: string[];
  /** The CONNECT user-property rows (5.0). */
  userProperties: string[];
  lastWill: string[];
  /** The subscription rows' filters and their 5.0 user properties. */
  topics: string[];
  /** The compose block the publish rider sends — topic, payload and
   *  the 5.0 per-message properties. */
  message: string[];
  /** The CONNECT knobs — the client id, the SNI override, the ALPN protocol. */
  settings: string[];
}

function collectMessageProperties(props: MqttMessageProperties | undefined, out: string[]): void {
  if (!props) return;
  collectPairTemplateStrings(props.userProperties ?? [], out);
  if (props.responseTopic) out.push(props.responseTopic);
  if (props.correlationData) out.push(props.correlationData);
  if (props.contentType) out.push(props.contentType);
}

export function collectMqttTemplateGroups(request: MqttTemplateSource): MqttTemplateGroups {
  const v5 = request.protocolVersion !== '3.1.1';

  const url: string[] = [];
  if (request.url) url.push(request.url);

  const auth: string[] = [];
  if (request.auth) collectAuthTemplateStrings(request.auth, auth);

  const userProperties: string[] = [];
  if (v5) collectPairTemplateStrings(request.userProperties, userProperties);

  const lastWill: string[] = [];
  const will = request.lastWill;
  if (will !== undefined && will.topic.trim() !== '') {
    lastWill.push(will.topic);
    if (will.payload) lastWill.push(will.payload);
    if (v5) collectMessageProperties(will.properties, lastWill);
  }

  const topics: string[] = [];
  for (const row of request.topics) {
    if (row.subscribe === false || row.topicFilter.trim() === '') continue;
    topics.push(row.topicFilter);
    if (v5) collectPairTemplateStrings(row.userProperties ?? [], topics);
  }

  const message: string[] = [];
  if (request.topic) message.push(request.topic);
  if (request.payload) message.push(request.payload);
  if (v5) collectMessageProperties(request.publishProperties, message);

  const settings: string[] = [];
  if (request.clientId) settings.push(request.clientId);
  if (request.sniServerName) settings.push(request.sniServerName);
  if (request.alpnProtocol) settings.push(request.alpnProtocol);

  return { url, auth, userProperties, lastWill, topics, message, settings };
}

/** Flat, order-preserving list of every templatable string in `request`. */
export function collectMqttRequestTemplateStrings(request: MqttTemplateSource): string[] {
  const g = collectMqttTemplateGroups(request);
  return [...g.url, ...g.auth, ...g.userProperties, ...g.lastWill, ...g.topics, ...g.message, ...g.settings];
}
