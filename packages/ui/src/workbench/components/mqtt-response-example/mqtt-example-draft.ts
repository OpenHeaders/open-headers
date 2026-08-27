/**
 * MQTT example editor draft model + the pure capture projections — the
 * `ws-example-draft` sibling for the MqttRequest family.
 *
 * The editable half is the captured REQUEST block (an example doubles
 * as an authored record): url, the publish compose (topic, payload,
 * encoding, QoS, retain), and the subscription rows. The version knob
 * is the capture's fact — identity chrome, never editable — and the
 * per-message properties / client id / SSL flag / timeout persist
 * verbatim through the draft without a viewer surface of their own.
 * The response block is session capture — CONNACK facts, the event
 * log, the end record — and stays a read-only fact rendered through
 * the result pane. Two pure projections feed save and derived-dirty;
 * the fingerprint compares the collapsed captured shape so trailing
 * ghost rows never read as edits.
 *
 * `MqttDraft` (the request editor's own form shape) satisfies
 * {@link MqttExampleDraft} structurally, so "Save Response" captures
 * straight off the editor draft through the same projection.
 */

import type {
  CapturedMqttRequest,
  CapturedMqttResponse,
  ExecutedMqttSnapshot,
  MqttPayloadFormat,
  MqttRequestProtocolVersion,
  MqttRequestQos,
  MqttResponseExample,
  MqttTopicRow,
} from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import {
  draftToProperties,
  type MqttMessagePropertiesDraft,
  propertiesToDraft,
  trimTopicRows,
} from '../mqtt-request-editor/draft';

export interface MqttExampleDraft {
  url: string;
  protocolVersion: MqttRequestProtocolVersion;
  topic: string;
  payload: string;
  payloadFormat: MqttPayloadFormat;
  qos: MqttRequestQos;
  retain: boolean;
  publishProperties: MqttMessagePropertiesDraft;
  topics: MqttTopicRow[];
  /** Client id as authored ('' = generated per connect). */
  clientId: string;
  sslVerification: boolean;
  timeoutMs: number | undefined;
}

export function mqttExampleToDraft(example: MqttResponseExample): MqttExampleDraft {
  return {
    url: example.request.url,
    protocolVersion: example.request.protocolVersion,
    topic: example.request.topic,
    payload: example.request.payload,
    payloadFormat: example.request.payloadFormat,
    qos: example.request.qos,
    retain: example.request.retain,
    publishProperties: propertiesToDraft(example.request.publishProperties),
    topics: example.request.topics.map((row) => ({ ...row })),
    clientId: example.request.clientId ?? '',
    sslVerification: example.request.sslVerification,
    timeoutMs: example.request.timeoutMs,
  };
}

/**
 * The persisted request block from a compose shape — the MQTT editor's
 * CURRENT draft at "Save Response" time (authored values, variable
 * refs unresolved) or the example editor's own draft at save. Both
 * speak this structural subset. Fields the entity leaves
 * optional-with-default persist CONCRETE — the session's facts, not
 * absences.
 */
export function capturedMqttRequestFromDraft(draft: MqttExampleDraft): CapturedMqttRequest {
  const properties = draftToProperties(draft.publishProperties);
  return {
    url: draft.url,
    protocolVersion: draft.protocolVersion,
    topic: draft.topic,
    payload: draft.payload,
    payloadFormat: draft.payloadFormat,
    qos: draft.qos,
    retain: draft.retain,
    ...(properties !== undefined ? { publishProperties: properties } : {}),
    topics: trimTopicRows(draft.topics),
    ...(draft.clientId === '' ? {} : { clientId: draft.clientId }),
    sslVerification: draft.sslVerification,
    ...(draft.timeoutMs === undefined ? {} : { timeoutMs: draft.timeoutMs }),
  };
}

/**
 * The persisted response block from a settled session snapshot — the
 * CONNACK facts, the event log, and the end record verbatim. Volatile
 * execution internals (`outcome`, `executedOn`, `proxyRoute`) stay
 * behind; callers only capture sessions that opened, so the CONNACK
 * is always present.
 */
export function capturedMqttResponseFromSnapshot(snapshot: ExecutedMqttSnapshot): CapturedMqttResponse | null {
  if (snapshot.connack === null) return null;
  return {
    connack: { ...snapshot.connack },
    clientId: snapshot.clientId,
    events: snapshot.events.map((event) => {
      if (event.kind === 'message') {
        return {
          kind: 'message' as const,
          direction: event.direction,
          topic: event.topic,
          payloadBase64: event.payloadBase64,
          qos: event.qos,
          retain: event.retain,
          dup: event.dup,
        };
      }
      if (event.kind === 'subscribed') {
        return { kind: 'subscribed' as const, grants: event.grants.map((g) => ({ ...g })) };
      }
      if (event.kind === 'unsubscribed') {
        return { kind: 'unsubscribed' as const, topicFilters: [...event.topicFilters] };
      }
      if (event.kind === 'lost') return { kind: 'lost' as const, end: event.end === null ? null : { ...event.end } };
      if (event.kind === 'reconnecting') {
        return {
          kind: 'reconnecting' as const,
          attempt: event.attempt,
          ...(event.error === undefined ? {} : { error: event.error }),
        };
      }
      return {
        kind: 'reconnected' as const,
        attempt: event.attempt,
        sessionPresent: event.sessionPresent,
        reasonCode: event.reasonCode,
        remainingLength: event.remainingLength,
      };
    }),
    droppedMessages: snapshot.droppedMessages,
    end: snapshot.end === null ? null : { ...snapshot.end },
    ...(snapshot.stopped === undefined ? {} : { stopped: snapshot.stopped }),
    ...(snapshot.reconnectRefused === undefined ? {} : { reconnectRefused: { ...snapshot.reconnectRefused } }),
    durationMs: snapshot.durationMs,
  };
}

/** Structural fingerprint over everything editable — compares the
 *  collapsed captured shape so ghost rows and untouched property
 *  fields never read as edits. */
export function mqttExampleDraftFingerprint(draft: MqttExampleDraft): string {
  return stableStringify(capturedMqttRequestFromDraft(draft));
}

/** Canonical-side fingerprint — same projection path as the form's. */
export function mqttExampleSignature(example: MqttResponseExample): string {
  return mqttExampleDraftFingerprint(mqttExampleToDraft(example));
}
