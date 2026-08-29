/**
 * MQTT request editor draft — the form-local shape plus the
 * draft ⇄ entity projections. Mirrors the WebSocket editor's `draft.ts`
 * anatomy: `draftFromMqttRequest` populates the form,
 * `buildMqttRequestUpdates` emits the save patch, and
 * `canonicalMqttRequestProjection` projects the live entity into the
 * same shape so the dirty fingerprint compares apples-to-apples
 * (derived dirty — never setDirty).
 *
 * The per-message property blocks are held concrete in the form (every
 * field present, '' / undefined = untouched) and collapse back to the
 * entity's optional block on save — an all-empty block emits
 * `undefined`, which the update builder reads as CLEAR for the
 * container-scalar paths (publishProperties / lastWill / specLink):
 * every previously-saved leaf tombstones, so clearing the last field
 * of a saved block honestly unsets it instead of re-priming.
 */

import type {
  MqttAuth,
  MqttLastWill,
  MqttMessageProperties,
  MqttPayloadFormat,
  MqttRequest,
  MqttRequestProtocolVersion,
  MqttRequestQos,
  MqttSavedMessage,
  MqttSpecLink,
  MqttTopicRow,
  MqttUserPropertyRow,
  ProxyMode,
  TlsVersion,
} from '@openheaders/core/types';
import { binaryEncodingError } from '@openheaders/core/utils';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';

/** Concrete form shape for one per-message 5.0 property block. */
export interface MqttMessagePropertiesDraft {
  userProperties: MqttUserPropertyRow[];
  responseTopic: string;
  correlationData: string;
  messageExpiryInterval: number | undefined;
  contentType: string;
  payloadFormatIndicator: boolean;
}

/** Concrete form shape for the last-will block ('' topic + payload = no will). */
export interface MqttLastWillDraft {
  topic: string;
  payload: string;
  format: MqttPayloadFormat;
  qos: MqttRequestQos;
  retain: boolean;
  willDelayInterval: number | undefined;
  properties: MqttMessagePropertiesDraft;
}

export interface MqttDraft {
  /** Docs-tab markdown; always concrete in the form (`''` = no docs). */
  description: string;
  url: string;
  /** Concrete in the form — absent on the entity reads as `5.0`. */
  protocolVersion: MqttRequestProtocolVersion;
  topic: string;
  payload: string;
  /** Concrete — absent on the entity reads as `text`. */
  payloadFormat: MqttPayloadFormat;
  /** Concrete — absent on the entity reads as 0. */
  qos: MqttRequestQos;
  /** Concrete — absent on the entity reads as off. */
  retain: boolean;
  publishProperties: MqttMessagePropertiesDraft;
  /** Topics-grid rows keep the entity shape; the grid's trailing ghost
   *  trims away in the save projection like the WS header rows. */
  topics: MqttTopicRow[];
  savedMessages: MqttSavedMessage[];
  /** CONNECT user-property rows ride the shared KeyValueTable shape. */
  userProperties: KeyValueRow[];
  /** Concrete in the form — absent on the entity reads as none. */
  auth: MqttAuth;
  lastWill: MqttLastWillDraft;
  specLink: MqttSpecLink | undefined;
  clientId: string;
  /** Concrete — absent on the entity reads as on (the safe default). */
  cleanStart: boolean;
  sessionExpiryInterval: number | undefined;
  keepAlive: number | undefined;
  receiveMaximum: number | undefined;
  maximumPacketSize: number | undefined;
  topicAliasMaximum: number | undefined;
  /** Concrete — absent on the entity reads as off (the spec default). */
  requestResponseInformation: boolean;
  /** Concrete — absent on the entity reads as on (the spec default). */
  requestProblemInformation: boolean;
  timeoutMs: number | undefined;
  /** Concrete — absent on the entity reads as off. */
  autoReconnect: boolean;
  reconnectPeriodMs: number | undefined;
  reconnectMaxAttempts: number | undefined;
  /** Concrete — absent on the entity reads as a fixed period. */
  reconnectBackoff: boolean;
  /** The dial policy — `undefined` = system DNS / the host's proxy
   *  planes (the HTTP request's knobs on the broker dial). */
  resolveToAddress: string | undefined;
  proxyMode: ProxyMode | undefined;
  proxyUrl: string | undefined;
  proxyCredentialRef: string | undefined;
  /** Concrete — absent on the entity reads as verify-on. */
  sslVerification: boolean;
  clientCertificateRef: string | undefined;
  tlsMinVersion: TlsVersion | undefined;
  tlsMaxVersion: TlsVersion | undefined;
  tlsCipherSuites: string | undefined;
  sniServerName: string | undefined;
  alpnProtocol: string | undefined;
}

export interface MqttRequestUpdates {
  description: string;
  url: string;
  protocolVersion: MqttRequestProtocolVersion;
  topic: string;
  payload: string;
  payloadFormat: MqttPayloadFormat;
  qos: MqttRequestQos;
  retain: boolean;
  publishProperties: MqttMessageProperties | undefined;
  topics: MqttTopicRow[];
  savedMessages: MqttSavedMessage[];
  userProperties: MqttUserPropertyRow[];
  auth: MqttAuth;
  lastWill: MqttLastWill | undefined;
  specLink: MqttSpecLink | undefined;
  clientId: string;
  cleanStart: boolean;
  sessionExpiryInterval: number | undefined;
  keepAlive: number | undefined;
  receiveMaximum: number | undefined;
  maximumPacketSize: number | undefined;
  topicAliasMaximum: number | undefined;
  requestResponseInformation: boolean;
  requestProblemInformation: boolean;
  timeoutMs: number | undefined;
  autoReconnect: boolean;
  reconnectPeriodMs: number | undefined;
  reconnectMaxAttempts: number | undefined;
  reconnectBackoff: boolean;
  resolveToAddress: string | undefined;
  proxyMode: ProxyMode | undefined;
  proxyUrl: string | undefined;
  proxyCredentialRef: string | undefined;
  sslVerification: boolean;
  clientCertificateRef: string | undefined;
  tlsMinVersion: TlsVersion | undefined;
  tlsMaxVersion: TlsVersion | undefined;
  tlsCipherSuites: string | undefined;
  sniServerName: string | undefined;
  alpnProtocol: string | undefined;
}

export function emptyMessagePropertiesDraft(): MqttMessagePropertiesDraft {
  return {
    userProperties: [],
    responseTopic: '',
    correlationData: '',
    messageExpiryInterval: undefined,
    contentType: '',
    payloadFormatIndicator: false,
  };
}

export function propertiesToDraft(props: MqttMessageProperties | undefined): MqttMessagePropertiesDraft {
  return {
    userProperties: (props?.userProperties ?? []).map((row) => ({ ...row })),
    responseTopic: props?.responseTopic ?? '',
    correlationData: props?.correlationData ?? '',
    messageExpiryInterval: props?.messageExpiryInterval,
    contentType: props?.contentType ?? '',
    payloadFormatIndicator: props?.payloadFormatIndicator ?? false,
  };
}

/** Collapse a concrete property-block draft to the persisted optional
 *  shape — `undefined` when every field is untouched. */
export function draftToProperties(draft: MqttMessagePropertiesDraft): MqttMessageProperties | undefined {
  const rows = draft.userProperties.filter((row) => row.key.trim() !== '');
  const out: MqttMessageProperties = {
    ...(rows.length > 0 ? { userProperties: rows.map(canonicalUserPropertyRow) } : {}),
    ...(draft.responseTopic !== '' ? { responseTopic: draft.responseTopic } : {}),
    ...(draft.correlationData !== '' ? { correlationData: draft.correlationData } : {}),
    ...(draft.messageExpiryInterval !== undefined ? { messageExpiryInterval: draft.messageExpiryInterval } : {}),
    ...(draft.contentType !== '' ? { contentType: draft.contentType } : {}),
    ...(draft.payloadFormatIndicator ? { payloadFormatIndicator: true } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

function canonicalUserPropertyRow(row: MqttUserPropertyRow): MqttUserPropertyRow {
  return {
    uid: row.uid,
    key: row.key,
    value: row.value,
    ...(row.description?.trim() ? { description: row.description } : {}),
    ...(row.enabled !== undefined ? { enabled: row.enabled } : {}),
  };
}

export function userPropertiesToRows(rows: readonly MqttUserPropertyRow[]): KeyValueRow[] {
  return rows.map((row) =>
    makeKvRow({
      uid: row.uid,
      key: row.key,
      value: row.value,
      description: row.description ?? '',
      enabled: row.enabled ?? true,
    }),
  );
}

export function rowsToUserProperties(rows: KeyValueRow[]): MqttUserPropertyRow[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      ...(r.description?.trim() ? { description: r.description } : {}),
      enabled: r.enabled,
    }));
}

/** Trim the Topics grid's trailing ghost + unfilled rows away, keeping
 *  only the fields each row actually carries. */
export function trimTopicRows(rows: MqttTopicRow[]): MqttTopicRow[] {
  return rows
    .filter((row) => row.topicFilter.trim() !== '')
    .map((row) => {
      const userProperties = (row.userProperties ?? []).filter((p) => p.key.trim() !== '');
      return {
        uid: row.uid,
        topicFilter: row.topicFilter,
        ...(row.qos !== undefined ? { qos: row.qos } : {}),
        ...(row.subscribe !== undefined ? { subscribe: row.subscribe } : {}),
        ...(row.description?.trim() ? { description: row.description } : {}),
        ...(row.noLocal !== undefined ? { noLocal: row.noLocal } : {}),
        ...(row.retainAsPublished !== undefined ? { retainAsPublished: row.retainAsPublished } : {}),
        ...(row.retainHandling !== undefined ? { retainHandling: row.retainHandling } : {}),
        ...(row.subscriptionId !== undefined ? { subscriptionId: row.subscriptionId } : {}),
        ...(userProperties.length > 0 ? { userProperties: userProperties.map(canonicalUserPropertyRow) } : {}),
      };
    });
}

export function emptyLastWillDraft(): MqttLastWillDraft {
  return {
    topic: '',
    payload: '',
    format: 'text',
    qos: 0,
    retain: false,
    willDelayInterval: undefined,
    properties: emptyMessagePropertiesDraft(),
  };
}

export function lastWillToDraft(will: MqttLastWill | undefined): MqttLastWillDraft {
  if (!will) return emptyLastWillDraft();
  return {
    topic: will.topic,
    payload: will.payload,
    format: will.format ?? 'text',
    qos: will.qos ?? 0,
    retain: will.retain ?? false,
    willDelayInterval: will.willDelayInterval,
    properties: propertiesToDraft(will.properties),
  };
}

/** A will exists once it has a topic — the wire requires one; an
 *  empty-topic draft saves as "no will". */
export function draftToLastWill(draft: MqttLastWillDraft): MqttLastWill | undefined {
  if (draft.topic.trim() === '') return undefined;
  const properties = draftToProperties(draft.properties);
  return {
    topic: draft.topic,
    payload: draft.payload,
    ...(draft.format !== 'text' ? { format: draft.format } : {}),
    ...(draft.qos !== 0 ? { qos: draft.qos } : {}),
    ...(draft.retain ? { retain: true } : {}),
    ...(draft.willDelayInterval !== undefined ? { willDelayInterval: draft.willDelayInterval } : {}),
    ...(properties !== undefined ? { properties } : {}),
  };
}

export function draftFromMqttRequest(req: MqttRequest): MqttDraft {
  return {
    description: req.description ?? '',
    url: req.url,
    protocolVersion: req.protocolVersion ?? '5.0',
    topic: req.topic,
    payload: req.payload,
    payloadFormat: req.payloadFormat ?? 'text',
    qos: req.qos ?? 0,
    retain: req.retain ?? false,
    publishProperties: propertiesToDraft(req.publishProperties),
    topics: req.topics.map((row) => ({ ...row })),
    savedMessages: req.savedMessages.map((row) => ({ ...row })),
    userProperties: userPropertiesToRows(req.userProperties),
    auth: req.auth ?? { type: 'none' },
    lastWill: lastWillToDraft(req.lastWill),
    specLink: req.specLink,
    clientId: req.clientId ?? '',
    cleanStart: req.cleanStart ?? true,
    sessionExpiryInterval: req.sessionExpiryInterval,
    keepAlive: req.keepAlive,
    receiveMaximum: req.receiveMaximum,
    maximumPacketSize: req.maximumPacketSize,
    topicAliasMaximum: req.topicAliasMaximum,
    requestResponseInformation: req.requestResponseInformation ?? false,
    requestProblemInformation: req.requestProblemInformation ?? true,
    timeoutMs: req.timeoutMs,
    autoReconnect: req.autoReconnect ?? false,
    reconnectPeriodMs: req.reconnectPeriodMs,
    reconnectMaxAttempts: req.reconnectMaxAttempts,
    reconnectBackoff: req.reconnectBackoff ?? true,
    resolveToAddress: req.resolveToAddress,
    proxyMode: req.proxyMode,
    proxyUrl: req.proxyUrl,
    proxyCredentialRef: req.proxyCredentialRef,
    sslVerification: req.sslVerification ?? true,
    clientCertificateRef: req.clientCertificateRef,
    tlsMinVersion: req.tlsMinVersion,
    tlsMaxVersion: req.tlsMaxVersion,
    tlsCipherSuites: req.tlsCipherSuites,
    sniServerName: req.sniServerName,
    alpnProtocol: req.alpnProtocol,
  };
}

export function buildMqttRequestUpdates(draft: MqttDraft): MqttRequestUpdates {
  return {
    description: draft.description,
    url: draft.url,
    protocolVersion: draft.protocolVersion,
    topic: draft.topic,
    payload: draft.payload,
    payloadFormat: draft.payloadFormat,
    qos: draft.qos,
    retain: draft.retain,
    publishProperties: draftToProperties(draft.publishProperties),
    topics: trimTopicRows(draft.topics),
    savedMessages: draft.savedMessages,
    userProperties: rowsToUserProperties(draft.userProperties),
    auth: draft.auth,
    lastWill: draftToLastWill(draft.lastWill),
    specLink: draft.specLink,
    clientId: draft.clientId,
    cleanStart: draft.cleanStart,
    sessionExpiryInterval: draft.sessionExpiryInterval,
    keepAlive: draft.keepAlive,
    receiveMaximum: draft.receiveMaximum,
    maximumPacketSize: draft.maximumPacketSize,
    topicAliasMaximum: draft.topicAliasMaximum,
    requestResponseInformation: draft.requestResponseInformation,
    requestProblemInformation: draft.requestProblemInformation,
    timeoutMs: draft.timeoutMs,
    autoReconnect: draft.autoReconnect,
    reconnectPeriodMs: draft.reconnectPeriodMs,
    reconnectMaxAttempts: draft.reconnectMaxAttempts,
    reconnectBackoff: draft.reconnectBackoff,
    resolveToAddress: draft.resolveToAddress,
    proxyMode: draft.proxyMode,
    proxyUrl: draft.proxyUrl,
    proxyCredentialRef: draft.proxyCredentialRef,
    sslVerification: draft.sslVerification,
    clientCertificateRef: draft.clientCertificateRef,
    tlsMinVersion: draft.tlsMinVersion,
    tlsMaxVersion: draft.tlsMaxVersion,
    tlsCipherSuites: draft.tlsCipherSuites,
    sniServerName: draft.sniServerName,
    alpnProtocol: draft.alpnProtocol,
  };
}

/** Project a live `MqttRequest` into the same shape
 *  `buildMqttRequestUpdates` emits — fingerprint comparison stays
 *  apples-to-apples. */
export function canonicalMqttRequestProjection(req: MqttRequest): MqttRequestUpdates {
  return buildMqttRequestUpdates(draftFromMqttRequest(req));
}

// ── Saved-message compose binding ───────────────────────────────────
//
// The compose surface is the SELECTED saved row's editor (the
// reference client's model): loading fills the whole compose, and
// every compose edit mirrors back into the selected row within the
// same draft update. All four helpers are pure projections over the
// same field set: topic, payload, encoding, qos, retain, properties.

/** The compose block captured as one saved row — optional fields
 *  absent at their defaults (the `+` capture and the mirror share it). */
export function composeAsSavedMessage(draft: MqttDraft, uid: string, name: string): MqttSavedMessage {
  const properties = draftToProperties(draft.publishProperties);
  return {
    uid,
    name,
    topic: draft.topic,
    payload: draft.payload,
    ...(draft.payloadFormat !== 'text' ? { format: draft.payloadFormat } : {}),
    ...(draft.qos !== 0 ? { qos: draft.qos } : {}),
    ...(draft.retain ? { retain: true } : {}),
    ...(properties !== undefined ? { properties } : {}),
  };
}

/** One saved row filling the whole compose — the click-to-load leg. */
export function loadSavedMessageIntoCompose(draft: MqttDraft, row: MqttSavedMessage): MqttDraft {
  return {
    ...draft,
    topic: row.topic,
    payload: row.payload,
    payloadFormat: row.format ?? 'text',
    qos: row.qos ?? 0,
    retain: row.retain ?? false,
    publishProperties: propertiesToDraft(row.properties),
  };
}

/** Does the row hold exactly what the compose shows? Stored optional
 *  fields read at their defaults; properties compare canonicalized. */
export function savedRowMatchesCompose(draft: MqttDraft, row: MqttSavedMessage): boolean {
  if (
    row.topic !== draft.topic ||
    row.payload !== draft.payload ||
    (row.format ?? 'text') !== draft.payloadFormat ||
    (row.qos ?? 0) !== draft.qos ||
    (row.retain ?? false) !== draft.retain
  ) {
    return false;
  }
  const rowProperties = draftToProperties(propertiesToDraft(row.properties));
  const composeProperties = draftToProperties(draft.publishProperties);
  return stableStringify(rowProperties ?? null) === stableStringify(composeProperties ?? null);
}

/** Mirror the compose into the selected saved row — the write-through
 *  leg. Identity-stable: no selection, a vanished row, or an already-
 *  matching row returns the SAME draft object (no render churn). */
export function mirrorComposeIntoSaved(draft: MqttDraft, selectedUid: string | null): MqttDraft {
  if (selectedUid === null) return draft;
  const index = draft.savedMessages.findIndex((row) => row.uid === selectedUid);
  if (index === -1) return draft;
  const row = draft.savedMessages[index];
  if (savedRowMatchesCompose(draft, row)) return draft;
  const savedMessages = draft.savedMessages.slice();
  savedMessages[index] = composeAsSavedMessage(draft, row.uid, row.name);
  return { ...draft, savedMessages };
}

// ── Compose-payload encoding validation ─────────────────────────────

/**
 * Validate the compose payload against its ENCODING. `base64` / `hex`
 * author binary payloads, so malformed input gates Send honestly
 * (Phase C) and shows inline before that — the shared core gate the
 * executor decodes by. `text` / `json` always pass — JSON syntax is a
 * display concern, the payload travels verbatim.
 */
export function payloadEncodingError(payload: string, format: MqttPayloadFormat): 'base64' | 'hex' | null {
  return format === 'base64' || format === 'hex' ? binaryEncodingError(payload, format) : null;
}
