/**
 * MqttRequest codec — multi-file assembly.
 *
 * On disk, an MQTT request is a folder containing:
 *
 *   mqtt.yaml                  # manifest — identity, target, version knob, rows, will, spec binding
 *   payload.json / payload.txt # publish-compose draft (only when non-empty)
 *
 * The codec's job is translation between the runtime `MqttRequest`
 * object and the on-disk fan-out; the caller handles filesystem I/O.
 * Parse input: the caller lists every sibling it found on disk; the
 * codec splices the payload sibling into the runtime shape. Serialize
 * output: one mqtt.yaml string + the payload sibling when present —
 * named `payload.json` when the compose format is JSON (reviewers get
 * native highlighting), `payload.txt` otherwise (text/base64/hex all
 * author plain text).
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { MqttRequestSchema } from '../../schemas/mqtt-request';
import type {
  MqttLastWill,
  MqttMessageProperties,
  MqttRequest,
  MqttSavedMessage,
  MqttTopicRow,
  MqttUserPropertyRow,
} from '../../types/mqtt-request';
import { emitCanonicalYaml } from './canonical-emit';
import { MQTT_REQUEST_FIELD_ORDER } from './ordering';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

const PAYLOAD_JSON_FILE_NAME = 'payload.json';
const PAYLOAD_TEXT_FILE_NAME = 'payload.txt';

// ── Parse ─────────────────────────────────────────────────────────

export interface MqttRequestSiblingFile {
  /** Filename relative to the request folder, e.g. "payload.json". */
  fileName: string;
  content: string;
}

export interface MqttRequestCodecContext {
  /** Workspace-relative MQTT request folder path. */
  path: string;
  /** Every sibling file the caller found next to `mqtt.yaml`. The codec
   *  recognizes the payload sibling (either name) and ignores the rest
   *  (forward-compat). */
  siblings?: readonly MqttRequestSiblingFile[];
}

export function parseMqttRequest(yaml: string, context: MqttRequestCodecContext): ParsedDocument<MqttRequest> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;

  let payload = '';
  for (const sibling of context.siblings ?? []) {
    if (sibling.fileName === PAYLOAD_JSON_FILE_NAME || sibling.fileName === PAYLOAD_TEXT_FILE_NAME) {
      payload = sibling.content;
      break;
    }
  }

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    payload,
  };

  const value = v.parse(MqttRequestSchema, merged);
  return makeParsed(value, extractUnknownFields(raw, MqttRequestSchema, MQTT_REQUEST_FIELD_ORDER));
}

// ── Serialize ─────────────────────────────────────────────────────

export interface MqttRequestSerializeOutput {
  /** `mqtt.yaml` contents. */
  mqttYaml: string;
  /** Payload sibling when the request carries a composed draft; null otherwise. */
  payloadFile: MqttRequestSiblingFile | null;
}

export function serializeMqttRequest(write: WriteableDocument<MqttRequest>): MqttRequestSerializeOutput {
  // The manifest carries everything except the payload text, which
  // fans out into its own sibling so reviewers read the draft with
  // format-native highlighting and the manifest stays scannable.
  const value = canonicalizeMqttRequest(write.value);
  const manifestView = {
    ...value,
    payload: undefined,
  } as unknown as MqttRequest;

  const mqttYaml = emitCanonicalYaml(manifestView, MqttRequestSchema, MQTT_REQUEST_FIELD_ORDER, unknownFieldsOf(write));

  const payloadFileName = value.payloadFormat === 'json' ? PAYLOAD_JSON_FILE_NAME : PAYLOAD_TEXT_FILE_NAME;
  const payloadFile: MqttRequestSiblingFile | null =
    value.payload !== '' ? { fileName: payloadFileName, content: value.payload } : null;

  return { mqttYaml, payloadFile };
}

/**
 * Normalize row + nested-block key order so two clients building the
 * same request via different paths emit byte-identical YAML — same
 * architectural shape as `canonicalizeWebSocketRequest` (design §23.3).
 */
export function canonicalizeMqttRequest(request: MqttRequest): MqttRequest {
  return {
    ...request,
    topics: request.topics.map(canonicalTopicRow),
    savedMessages: request.savedMessages.map(canonicalSavedMessage),
    userProperties: request.userProperties.map(canonicalUserPropertyRow),
    ...(request.publishProperties !== undefined
      ? { publishProperties: canonicalMessageProperties(request.publishProperties) }
      : {}),
    ...(request.lastWill !== undefined ? { lastWill: canonicalLastWill(request.lastWill) } : {}),
  };
}

function canonicalUserPropertyRow(row: MqttUserPropertyRow): MqttUserPropertyRow {
  const out: MqttUserPropertyRow = { uid: row.uid, key: row.key, value: row.value };
  if (row.description !== undefined) out.description = row.description;
  if (row.enabled !== undefined) out.enabled = row.enabled;
  return out;
}

function canonicalMessageProperties(props: MqttMessageProperties): MqttMessageProperties {
  const out: MqttMessageProperties = {};
  if (props.userProperties !== undefined) out.userProperties = props.userProperties.map(canonicalUserPropertyRow);
  if (props.responseTopic !== undefined) out.responseTopic = props.responseTopic;
  if (props.correlationData !== undefined) out.correlationData = props.correlationData;
  if (props.messageExpiryInterval !== undefined) out.messageExpiryInterval = props.messageExpiryInterval;
  if (props.contentType !== undefined) out.contentType = props.contentType;
  if (props.payloadFormatIndicator !== undefined) out.payloadFormatIndicator = props.payloadFormatIndicator;
  return out;
}

function canonicalTopicRow(row: MqttTopicRow): MqttTopicRow {
  const out: MqttTopicRow = { uid: row.uid, topicFilter: row.topicFilter };
  if (row.qos !== undefined) out.qos = row.qos;
  if (row.subscribe !== undefined) out.subscribe = row.subscribe;
  if (row.description !== undefined) out.description = row.description;
  if (row.noLocal !== undefined) out.noLocal = row.noLocal;
  if (row.retainAsPublished !== undefined) out.retainAsPublished = row.retainAsPublished;
  if (row.retainHandling !== undefined) out.retainHandling = row.retainHandling;
  if (row.subscriptionId !== undefined) out.subscriptionId = row.subscriptionId;
  if (row.userProperties !== undefined) out.userProperties = row.userProperties.map(canonicalUserPropertyRow);
  return out;
}

function canonicalSavedMessage(row: MqttSavedMessage): MqttSavedMessage {
  const out: MqttSavedMessage = { uid: row.uid, name: row.name, topic: row.topic, payload: row.payload };
  if (row.format !== undefined) out.format = row.format;
  if (row.qos !== undefined) out.qos = row.qos;
  if (row.retain !== undefined) out.retain = row.retain;
  if (row.properties !== undefined) out.properties = canonicalMessageProperties(row.properties);
  return out;
}

function canonicalLastWill(will: MqttLastWill): MqttLastWill {
  const out: MqttLastWill = { topic: will.topic, payload: will.payload };
  if (will.format !== undefined) out.format = will.format;
  if (will.qos !== undefined) out.qos = will.qos;
  if (will.retain !== undefined) out.retain = will.retain;
  if (will.willDelayInterval !== undefined) out.willDelayInterval = will.willDelayInterval;
  if (will.properties !== undefined) out.properties = canonicalMessageProperties(will.properties);
  return out;
}
