/**
 * MQTT session executor — host-neutral orchestration of one live
 * session: resolve `{{ref}}` templates through the SAME 4-scope
 * pipeline HTTP sends ride (url / client id / auth / will / user
 * properties / subscription filters at Connect; every rider's fields per send
 * through the retained resolver — or through a host-injected
 * {@link ExecuteMqttSessionOptions.resolution} closure), drive the
 * MQTT protocol over the injected byte-stream
 * {@link MqttByteTransport}, feed the flush-batched `mqttStreamEvent`
 * emitter, and settle with an {@link ExecutedMqttSnapshot} when the
 * session ends.
 *
 * The protocol driver lives HERE, above the protocol-blind transport
 * (the socketio-controller posture, whole-protocol scale): CONNECT is
 * sent when the byte stream establishes, the session resolves OPEN on
 * an accepting CONNACK — a refusal reason rides the error VERBATIM,
 * never synthesized — enabled subscription rows SUBSCRIBE at open with
 * SUBACK grants recorded per row (QoS downgrades honest), the driver
 * answers keep-alive (PINGREQ on the interval) and runs the QoS 1/2
 * ack flows both directions (inbound QoS 2 = the full PUBREC/PUBCOMP
 * exactly-once handshake), DISCONNECT-then-close is the clean
 * Disconnect, a broker DISCONNECT records its reason verbatim, and
 * Stop-abort materializes what arrived.
 *
 * Version lens: the entity's `protocolVersion` KNOB maps onto the wire
 * level once, here — and every 5.0-only surface (properties,
 * subscription options, reason codes) is simply NOT APPLIED on a
 * 3.1.1 session, mirroring the editor's disabled-honest rendering
 * (the codec stays encode-strict underneath either way).
 *
 * Failure discipline: everything that can go wrong before the wire —
 * an empty or foreign-scheme URL, unresolved variables, a malformed
 * base64/hex payload — returns a STRUCTURED failed-outcome snapshot
 * naming the gap, never a throw. Once open, the end record (client DISCONNECT,
 * broker DISCONNECT with reason, or the honest `null` for a severed
 * connection) is the story.
 *
 * Capture law with the ratified rolling retention: PUBLISH payloads
 * verbatim (base64), BOTH directions in packet order, flags as facts;
 * the capture keeps the most RECENT events under the byte/count caps
 * and `droppedMessages` counts what rolled off — honest, never silent.
 */

import type { MqttPublishWire, MqttStreamEventWire, MqttSubscriptionWire } from '@openheaders/core/bridge';
import {
  createMqttStreamDecoder,
  encodeMqttPacket,
  MQTT_CONNACK_RETURN_CODE_NAMES,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  type MqttProperties,
  type MqttProtocolVersion,
  type MqttSubscription,
  type MqttUserProperty,
  type MqttWill,
  mqttReasonCodeName,
} from '@openheaders/core/mqtt';
import type {
  ExecutedMqttEnd,
  ExecutedMqttEvent,
  ExecutedMqttSnapshot,
  ExecutedProxyRoute,
  MqttMessageProperties,
  MqttPayloadFormat,
  MqttRequest,
  MqttUserPropertyRow,
} from '@openheaders/core/types';
import { decodeBase64Bytes, encodeBase64Bytes, generateUid } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '../../entity/request-store';
import { buildResolver } from '../request-exec/resolver-scope';
import { registerActiveSend } from '../request-exec/send-stream';
import { createMqttStreamEmitter, registerActiveMqttSession } from './session-plane';
import type { MqttByteTransport, MqttStreamWriter } from './transport';

/** Rolling-retention caps on the captured payload bytes / event count
 *  — the always-on host never buffers unbounded, and the session is
 *  NOT aborted past them: the oldest events roll off and
 *  `droppedMessages` records the truncation. */
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;
const MAX_CAPTURE_EVENTS = 10_000;

/** Keep Alive when the entity leaves the knob empty — the reference
 *  default; 0 disables the contract. */
const DEFAULT_KEEP_ALIVE_S = 60;

export interface ExecuteMqttSessionOptions {
  /** `null` = the runtime-Active workspace via the module mirrors;
   *  a string pins that workspace's scopes (forwarded sends). */
  workspaceId: string | null;
  /** Tri-state: string pins an env, explicit `null` resolves with no
   *  environment, absent defers to the scope's active pointer. */
  environmentId: string | null | undefined;
  /** Host wire capability. */
  transport: MqttByteTransport;
  /** Caller-minted id — Stop hook on the shared active-send registry
   *  + the rider registry key. REQUIRED: a session is interactive by
   *  nature, there is no fire-and-forget leg. */
  sendId: string;
  /** Live-frame sink (`mqttStreamEvent` broadcasts). */
  emitStreamEvent?: (event: MqttStreamEventWire) => void;
  /** Host-injected template resolution — the WS executor's exact
   *  contract, for surfaces whose variable scopes live OUTSIDE the
   *  oracle module mirrors. */
  resolution?: (template: string, unresolved: Set<string>) => string;
}

/** Decode a compose payload per its authored ENCODING — base64/hex
 *  author the published BYTES, text/json publish the UTF-8. */
function decodeComposePayload(
  payload: string,
  format: MqttPayloadFormat | undefined,
): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  if (format === 'base64') {
    const compact = payload.replace(/\s/g, '');
    const bytes = decodeBase64Bytes(compact);
    if (bytes === null || compact.length % 4 !== 0) {
      return { ok: false, error: 'The payload is not valid Base64.' };
    }
    return { ok: true, bytes };
  }
  if (format === 'hex') {
    const compact = payload.replace(/\s/g, '');
    if (!/^[0-9a-fA-F]*$/.test(compact) || compact.length % 2 !== 0) {
      return { ok: false, error: 'The payload is not valid hex.' };
    }
    const bytes = new Uint8Array(compact.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16);
    return { ok: true, bytes };
  }
  return { ok: true, bytes: new TextEncoder().encode(payload) };
}

/** Map an entity/rider per-message property block onto the wire
 *  property record, resolving every string field. 5.0 sessions only —
 *  the caller holds the version lens. */
function wireMessageProperties(
  props: MqttMessageProperties | undefined,
  resolveStr: (s: string) => string,
): MqttProperties | undefined {
  if (props === undefined) return undefined;
  const rows = (props.userProperties ?? []).filter((row) => row.enabled !== false && row.key.trim() !== '');
  const out: MqttProperties = {
    ...(rows.length > 0
      ? { userProperties: rows.map((row) => ({ key: resolveStr(row.key), value: resolveStr(row.value) })) }
      : {}),
    ...(props.responseTopic !== undefined && props.responseTopic !== ''
      ? { responseTopic: resolveStr(props.responseTopic) }
      : {}),
    ...(props.correlationData !== undefined && props.correlationData !== ''
      ? { correlationData: new TextEncoder().encode(resolveStr(props.correlationData)) }
      : {}),
    ...(props.messageExpiryInterval !== undefined ? { messageExpiryInterval: props.messageExpiryInterval } : {}),
    ...(props.contentType !== undefined && props.contentType !== ''
      ? { contentType: resolveStr(props.contentType) }
      : {}),
    ...(props.payloadFormatIndicator === true ? { payloadFormatIndicator: 1 } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Map subscription-row user properties onto the SUBSCRIBE property
 *  pairs — enabled rows with a key, both sides resolved. 5.0 sessions
 *  only (the caller holds the version lens); the pairs ride ONCE on
 *  the row's SUBSCRIBE packet, never on delivered messages. */
function wireSubscribeUserProps(
  rows: MqttUserPropertyRow[] | undefined,
  resolveStr: (s: string) => string,
): MqttUserProperty[] | undefined {
  const kept = (rows ?? []).filter((row) => row.enabled !== false && row.key.trim() !== '');
  return kept.length > 0 ? kept.map((row) => ({ key: resolveStr(row.key), value: resolveStr(row.value) })) : undefined;
}

/** One SUBSCRIBE unit: the per-row options plus the packet-level 5.0
 *  properties (Subscription Identifier, User Properties) — those are
 *  per-SUBSCRIBE, so an entry carrying either needs its own packet. */
interface SubscribeEntry {
  subscription: MqttSubscription;
  subscriptionId?: number;
  userProperties?: MqttUserProperty[];
}

/** The CONNACK refusal set — the version scopes the numeric space.
 *  Any nonzero code refuses: 5.0 refusals are >= 0x80, and a nonzero
 *  code BELOW that on a 5.0 session is a 3.1.1-form answer from a
 *  3.1.1-only broker (aedes: 0x01 Unacceptable protocol version) —
 *  named from the 3.1.1 table rather than opening a session the
 *  broker is already closing. */
function connackRefusalMessage(reasonCode: number, version: MqttProtocolVersion): string | null {
  if (reasonCode === 0) return null;
  const name =
    version === MQTT_PROTOCOL_VERSIONS.v5 && reasonCode >= 0x80
      ? mqttReasonCodeName(reasonCode, 'connack')
      : MQTT_CONNACK_RETURN_CODE_NAMES[reasonCode];
  return name !== undefined
    ? `The broker refused the connection: ${name} (code ${reasonCode}).`
    : `The broker refused the connection (code ${reasonCode}).`;
}

/** Decoded byte length of a base64 payload without re-decoding it. */
function byteLengthOfBase64(base64: string): number {
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return (base64.length / 4) * 3 - padding;
}

export function errorMqttSnapshot(message: string): ExecutedMqttSnapshot {
  return {
    outcome: { kind: 'failed', error: message },
    connack: null,
    clientId: '',
    events: [],
    droppedMessages: 0,
    end: null,
    durationMs: 0,
  };
}

export async function executeMqttSession(
  request: MqttRequest,
  options: ExecuteMqttSessionOptions,
): Promise<ExecutedMqttSnapshot> {
  // ── Variable resolution (the HTTP sends' exact pipeline) ──
  const resolveWith = options.resolution ?? (await buildOracleResolution(request, options));

  const unresolved = new Set<string>();
  const resolveStr = (s: string): string => resolveWith(s, unresolved);

  const version: MqttProtocolVersion =
    request.protocolVersion === '3.1.1' ? MQTT_PROTOCOL_VERSIONS.v311 : MQTT_PROTOCOL_VERSIONS.v5;
  const v5 = version === MQTT_PROTOCOL_VERSIONS.v5;

  const url = resolveStr(request.url).trim();
  // Blank client id = generated per connect (session resumption needs
  // a stable one — the Settings help copy carries that interaction).
  const configuredClientId = resolveStr(request.clientId ?? '').trim();
  const clientId = configuredClientId !== '' ? configuredClientId : `oh-${generateUid()}${generateUid()}`;

  // Session credential (Basic) — resolved with the other Connect-time
  // templates; an empty resolved field reads as absent (partial
  // configs stay saveable — the WS bearer posture). The password
  // travels verbatim (no trim — spaces are legal); a 3.1.1
  // password-sans-username is rejected by the encode-strict codec and
  // surfaces as the CONNECT compose error.
  const basicAuth = request.auth?.type === 'basic' ? request.auth : null;
  const authUsername = basicAuth !== null ? resolveStr(basicAuth.username).trim() : '';
  const authPassword = basicAuth !== null ? resolveStr(basicAuth.password) : '';

  // CONNECT-level user properties + the 5.0 connect knobs — applied on
  // 5.0 sessions only (the disabled-honest lens; the editor keeps the
  // surfaces inert on 3.1.1).
  const connectUserProps = v5
    ? request.userProperties
        .filter((row) => row.enabled !== false && row.key.trim() !== '')
        .map((row) => ({ key: resolveStr(row.key), value: resolveStr(row.value) }))
    : [];
  const connectProperties: MqttProperties = {
    ...(v5 && request.sessionExpiryInterval !== undefined
      ? { sessionExpiryInterval: request.sessionExpiryInterval }
      : {}),
    ...(v5 && request.receiveMaximum !== undefined ? { receiveMaximum: request.receiveMaximum } : {}),
    ...(v5 && request.maximumPacketSize !== undefined ? { maximumPacketSize: request.maximumPacketSize } : {}),
    ...(connectUserProps.length > 0 ? { userProperties: connectUserProps } : {}),
  };

  // The will registers on CONNECT — a topic makes it exist (the entity
  // law); its payload decodes per its authored ENCODING pre-wire.
  let will: MqttWill | undefined;
  if (request.lastWill !== undefined && request.lastWill.topic.trim() !== '') {
    const willTopic = resolveStr(request.lastWill.topic).trim();
    const willPayload = decodeComposePayload(resolveStr(request.lastWill.payload), request.lastWill.format);
    if (!willPayload.ok) return errorMqttSnapshot(`Last will: ${willPayload.error}`);
    const willProps: MqttProperties = {
      ...(v5 ? (wireMessageProperties(request.lastWill.properties, resolveStr) ?? {}) : {}),
      ...(v5 && request.lastWill.willDelayInterval !== undefined
        ? { willDelayInterval: request.lastWill.willDelayInterval }
        : {}),
    };
    will = {
      topic: willTopic,
      payload: willPayload.bytes,
      qos: request.lastWill.qos ?? 0,
      retain: request.lastWill.retain ?? false,
      ...(Object.keys(willProps).length > 0 ? { properties: willProps } : {}),
    };
  }

  // Enabled subscription rows SUBSCRIBE at open — filters resolved at
  // Connect; the 5.0 per-row options apply on 5.0 sessions only.
  const openRows = request.topics.filter((row) => row.subscribe !== false && row.topicFilter.trim() !== '');
  const openSubscriptions = openRows.map((row): SubscribeEntry => {
    const userProperties = v5 ? wireSubscribeUserProps(row.userProperties, resolveStr) : undefined;
    return {
      subscription: {
        topicFilter: resolveStr(row.topicFilter).trim(),
        qos: row.qos ?? 0,
        ...(v5 && row.noLocal !== undefined ? { noLocal: row.noLocal } : {}),
        ...(v5 && row.retainAsPublished !== undefined ? { retainAsPublished: row.retainAsPublished } : {}),
        ...(v5 && row.retainHandling !== undefined ? { retainHandling: row.retainHandling } : {}),
      },
      ...(v5 && row.subscriptionId !== undefined ? { subscriptionId: row.subscriptionId } : {}),
      ...(userProperties !== undefined ? { userProperties } : {}),
    };
  });

  if (unresolved.size > 0) {
    return errorMqttSnapshot(
      `Request has unresolved variables (${[...unresolved].join(', ')}). Define them in vault, environment, collection, or workspace before connecting.`,
    );
  }
  if (url === '') return errorMqttSnapshot('URL is empty');
  if (!/^(mqtts?|wss?):\/\//i.test(url)) {
    return errorMqttSnapshot('The URL must start with mqtt://, mqtts://, ws:// or wss://.');
  }

  const keepAlive = request.keepAlive ?? DEFAULT_KEEP_ALIVE_S;

  // ── The live session on the sendId spine ──
  return new Promise<ExecutedMqttSnapshot>((resolve) => {
    const emitter =
      options.emitStreamEvent !== undefined ? createMqttStreamEmitter(options.sendId, options.emitStreamEvent) : null;
    const controller = new AbortController();
    let stopped = false;
    let opened = false;
    /** The transport reached the broker (socket up, CONNECT sent) —
     *  even when no CONNACK ever arrived. */
    let socketConnected = false;
    let connack: ExecutedMqttSnapshot['connack'] = null;
    let refusalMessage: string | null = null;
    let end: ExecutedMqttEnd = null;
    let proxyRoute: ExecutedProxyRoute | undefined;
    let settled = false;
    const events: ExecutedMqttEvent[] = [];
    let capturedBytes = 0;
    let droppedMessages = 0;
    const startedAt = performance.now();
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

    // The incremental decoder both wire families feed — packets span
    // TCP chunks AND WebSocket frames (the ratified fork-2 posture).
    const decoder = createMqttStreamDecoder(version);

    // Packet-id space shared across PUBLISH/SUBSCRIBE/UNSUBSCRIBE —
    // one 16-bit allocator skipping ids still awaiting an ack.
    let nextPacketId = 0;
    const pendingSubAcks = new Map<string, { filters: string[]; resolveAck?: (reasonCode: number | null) => void }>();
    const outboundQos = new Map<number, 1 | 2>();
    const inboundQos2 = new Set<number>();
    const allocPacketId = (): number => {
      do {
        nextPacketId = (nextPacketId % 0xffff) + 1;
      } while (
        outboundQos.has(nextPacketId) ||
        pendingSubAcks.has(`s${nextPacketId}`) ||
        pendingSubAcks.has(`u${nextPacketId}`)
      );
      return nextPacketId;
    };

    const record = (event: ExecutedMqttEvent, byteLength: number): void => {
      events.push(event);
      capturedBytes += byteLength;
      while (events.length > 0 && (capturedBytes > MAX_CAPTURE_BYTES || events.length > MAX_CAPTURE_EVENTS)) {
        const rolled = events.shift();
        if (rolled === undefined) break;
        if (rolled.kind === 'message') capturedBytes -= byteLengthOfBase64(rolled.payloadBase64);
        droppedMessages += 1;
      }
    };

    const unregisterSend = registerActiveSend(options.sendId, () => {
      stopped = true;
      controller.abort();
    });
    let unregisterSession: (() => void) | null = null;

    const settle = (errorMessage?: string): void => {
      if (settled) return;
      settled = true;
      if (keepAliveTimer !== null) clearInterval(keepAliveTimer);
      keepAliveTimer = null;
      unregisterSend();
      unregisterSession?.();
      // A rider still waiting on a broker ack settles honestly instead
      // of hanging past the session.
      for (const pending of pendingSubAcks.values()) pending.resolveAck?.(null);
      pendingSubAcks.clear();
      emitter?.end();
      const durationMs = Math.round(performance.now() - startedAt);
      if (!opened) {
        // A user-initiated end (Stop-abort, or the header's Cancel
        // riding the clean-close rider — the pre-open close() stamps
        // `end.by = 'client'`) settles as the ABORTED outcome, not a
        // failure. A broker refusal stays a refusal even when the
        // user also cancelled.
        const aborted = refusalMessage === null && (stopped || end?.by === 'client');
        resolve({
          outcome: aborted
            ? { kind: 'aborted' }
            : { kind: 'failed', error: refusalMessage ?? errorMessage ?? 'The session ended before it opened.' },
          connack,
          clientId,
          events: [],
          droppedMessages: 0,
          // An abort that tore down an ESTABLISHED broker socket keeps
          // its end record — the disconnect is a real event to log; a
          // cancel before the socket ever came up carries none.
          end: aborted && socketConnected && end !== null ? end : null,
          durationMs,
        });
        return;
      }
      resolve({
        outcome: { kind: 'connected' },
        connack,
        clientId,
        events,
        droppedMessages,
        end,
        ...(stopped ? { stopped: true } : {}),
        durationMs,
        ...(proxyRoute !== undefined ? { proxyRoute } : {}),
      });
    };

    let writer: MqttStreamWriter | null = null;
    /** Encode one packet against the session's version and write it —
     *  a failure reports as the returned string, never a throw. */
    const sendPacket = (packet: MqttPacket): string | null => {
      if (writer === null || settled) return 'The session is not open.';
      const encoded = encodeMqttPacket(packet, version);
      if (!encoded.ok) return encoded.error;
      writer.write(encoded.bytes);
      return null;
    };

    const subscribeBatch = (
      batch: SubscribeEntry[],
      resolveAck?: (reasonCode: number | null) => void,
    ): string | null => {
      if (batch.length === 0) return null;
      const packetId = allocPacketId();
      // Packet-level 5.0 properties come off the batch head — the
      // open-time split guarantees an entry carrying any is alone.
      const properties: MqttProperties = {
        ...(batch[0].subscriptionId !== undefined ? { subscriptionIdentifiers: [batch[0].subscriptionId] } : {}),
        ...(batch[0].userProperties !== undefined ? { userProperties: batch[0].userProperties } : {}),
      };
      const error = sendPacket({
        type: 'subscribe',
        packetId,
        subscriptions: batch.map((entry) => entry.subscription),
        ...(Object.keys(properties).length > 0 ? { properties } : {}),
      });
      if (error !== null) return error;
      pendingSubAcks.set(`s${packetId}`, {
        filters: batch.map((entry) => entry.subscription.topicFilter),
        ...(resolveAck !== undefined ? { resolveAck } : {}),
      });
      return null;
    };

    // `remainingLength` is the frame's Remaining Length as the stream
    // decoder observed it — a framing fact the CONNACK capture records.
    const handlePacket = (packet: MqttPacket, remainingLength: number): void => {
      switch (packet.type) {
        case 'connack': {
          if (opened) return;
          connack = { sessionPresent: packet.sessionPresent, reasonCode: packet.reasonCode, remainingLength };
          const refusal = connackRefusalMessage(packet.reasonCode, version);
          if (refusal !== null) {
            // The refusal reason IS the classified pre-open error —
            // verbatim; the broker closes, and so do we.
            refusalMessage = refusal;
            writer?.end();
            return;
          }
          opened = true;
          emitter?.open({
            sessionPresent: packet.sessionPresent,
            reasonCode: packet.reasonCode,
            remainingLength,
            clientId,
            ...(proxyRoute !== undefined ? { proxyRoute } : {}),
          });
          // Open-time subscriptions: rows without packet-level 5.0
          // properties ride ONE packet (grants positional per row);
          // a row carrying a Subscription Identifier or User
          // Properties needs its own packet (those are per-SUBSCRIBE,
          // not per-row).
          const ridesAlone = (entry: SubscribeEntry): boolean =>
            entry.subscriptionId !== undefined || entry.userProperties !== undefined;
          subscribeBatch(openSubscriptions.filter((entry) => !ridesAlone(entry)));
          for (const entry of openSubscriptions.filter(ridesAlone)) {
            subscribeBatch([entry]);
          }
          if (keepAlive > 0) {
            keepAliveTimer = setInterval(() => {
              sendPacket({ type: 'pingreq' });
            }, keepAlive * 1000);
          }
          return;
        }
        case 'publish': {
          // Inbound QoS 2 runs the full exactly-once handshake: a
          // redelivery of an id still awaiting PUBREL answers PUBREC
          // again without double-recording.
          if (packet.qos === 2 && packet.packetId !== null) {
            const duplicate = inboundQos2.has(packet.packetId);
            sendPacket({ type: 'pubrec', packetId: packet.packetId, reasonCode: null });
            if (duplicate) return;
            inboundQos2.add(packet.packetId);
          } else if (packet.qos === 1 && packet.packetId !== null) {
            sendPacket({ type: 'puback', packetId: packet.packetId, reasonCode: null });
          }
          const payloadBase64 = encodeBase64Bytes(packet.payload);
          record(
            {
              kind: 'message',
              direction: 'down',
              topic: packet.topic,
              payloadBase64,
              qos: packet.qos,
              retain: packet.retain,
              dup: packet.dup,
            },
            packet.payload.byteLength,
          );
          emitter?.item({
            kind: 'message',
            direction: 'down',
            topic: packet.topic,
            payloadBase64,
            qos: packet.qos,
            retain: packet.retain,
            dup: packet.dup,
            atMs: Date.now(),
          });
          return;
        }
        case 'pubrel': {
          inboundQos2.delete(packet.packetId);
          sendPacket({ type: 'pubcomp', packetId: packet.packetId, reasonCode: null });
          return;
        }
        case 'puback': {
          if (outboundQos.get(packet.packetId) === 1) outboundQos.delete(packet.packetId);
          return;
        }
        case 'pubrec': {
          if (outboundQos.get(packet.packetId) === 2) {
            sendPacket({ type: 'pubrel', packetId: packet.packetId, reasonCode: null });
          }
          return;
        }
        case 'pubcomp': {
          if (outboundQos.get(packet.packetId) === 2) outboundQos.delete(packet.packetId);
          return;
        }
        case 'suback': {
          const pending = pendingSubAcks.get(`s${packet.packetId}`);
          if (pending === undefined) return;
          pendingSubAcks.delete(`s${packet.packetId}`);
          const grants = pending.filters.map((topicFilter, index) => ({
            topicFilter,
            reasonCode: packet.reasonCodes[index] ?? 0x80,
          }));
          record({ kind: 'subscribed', grants }, 0);
          emitter?.item({ kind: 'subscribed', grants, atMs: Date.now() });
          pending.resolveAck?.(grants[0]?.reasonCode ?? null);
          return;
        }
        case 'unsuback': {
          const pending = pendingSubAcks.get(`u${packet.packetId}`);
          if (pending === undefined) return;
          pendingSubAcks.delete(`u${packet.packetId}`);
          record({ kind: 'unsubscribed', topicFilters: pending.filters }, 0);
          emitter?.item({ kind: 'unsubscribed', topicFilters: pending.filters, atMs: Date.now() });
          pending.resolveAck?.(packet.reasonCodes[0] ?? null);
          return;
        }
        case 'disconnect': {
          // Broker-initiated DISCONNECT — reason verbatim; the client
          // closes the connection per spec and the settle follows the
          // socket.
          if (end === null) end = { by: 'broker', reasonCode: packet.reasonCode };
          writer?.end();
          return;
        }
        // PINGRESP absorbs; a broker never sends PINGREQ/SUBSCRIBE/…
        // toward a client — read-tolerantly ignored.
        default:
          return;
      }
    };

    writer = options.transport.connect(
      {
        url,
        ...(request.sslVerification !== undefined ? { sslVerification: request.sslVerification } : {}),
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      },
      {
        onConnect: (route) => {
          socketConnected = true;
          if (route !== undefined) proxyRoute = { plane: 'system', ...route };
          const error = sendPacket({
            type: 'connect',
            clientId,
            cleanStart: request.cleanStart ?? true,
            keepAlive,
            ...(authUsername !== '' ? { username: authUsername } : {}),
            ...(authPassword !== '' ? { password: new TextEncoder().encode(authPassword) } : {}),
            ...(will !== undefined ? { will } : {}),
            ...(Object.keys(connectProperties).length > 0 ? { properties: connectProperties } : {}),
          });
          if (error !== null) {
            refusalMessage = `The CONNECT packet did not compose: ${error}`;
            controller.abort();
          }
        },
        onData: (chunk) => {
          for (const event of decoder.push(chunk)) {
            if (!event.ok) {
              // A malformed BODY resynchronizes at the next boundary;
              // an untrustworthy FIXED HEADER poisons the framing —
              // nothing more can be read, so the session tears down.
              if (event.fatal) {
                if (!opened) refusalMessage = `The broker sent unreadable data: ${event.error}`;
                writer?.end();
                return;
              }
              continue;
            }
            handlePacket(event.packet, event.remainingLength);
            if (settled) return;
          }
        },
        onEnd: (error) => settle(error?.message),
      },
      controller.signal,
    );

    unregisterSession = registerActiveMqttSession(options.sendId, {
      publish: (message: MqttPublishWire) => {
        if (settled || !opened) return { success: false, error: 'The session is not open.' };
        const sendUnresolved = new Set<string>();
        const riderResolve = (s: string): string => resolveWith(s, sendUnresolved);
        const topic = riderResolve(message.topic).trim();
        const payloadText = riderResolve(message.payload);
        const properties = v5 ? wireMessageProperties(message.properties, riderResolve) : undefined;
        if (sendUnresolved.size > 0) {
          return { success: false, error: `Message has unresolved variables (${[...sendUnresolved].join(', ')}).` };
        }
        const decoded = decodeComposePayload(payloadText, message.format);
        if (!decoded.ok) return { success: false, error: decoded.error };
        const qos = message.qos ?? 0;
        const packetId = qos > 0 ? allocPacketId() : null;
        const error = sendPacket({
          type: 'publish',
          topic,
          payload: decoded.bytes,
          qos,
          retain: message.retain ?? false,
          dup: false,
          packetId,
          ...(properties !== undefined ? { properties } : {}),
        });
        if (error !== null) return { success: false, error };
        if (packetId !== null && qos > 0) outboundQos.set(packetId, qos as 1 | 2);
        const payloadBase64 = encodeBase64Bytes(decoded.bytes);
        record(
          { kind: 'message', direction: 'up', topic, payloadBase64, qos, retain: message.retain ?? false, dup: false },
          decoded.bytes.byteLength,
        );
        emitter?.item({
          kind: 'message',
          direction: 'up',
          topic,
          payloadBase64,
          qos,
          retain: message.retain ?? false,
          dup: false,
          atMs: Date.now(),
        });
        return { success: true };
      },
      setSubscription: (subscription: MqttSubscriptionWire) => {
        if (settled || !opened) {
          return Promise.resolve({ success: false, error: 'The session is not open.' });
        }
        const sendUnresolved = new Set<string>();
        const riderResolve = (s: string): string => resolveWith(s, sendUnresolved);
        const topicFilter = riderResolve(subscription.topicFilter).trim();
        const userProperties =
          v5 && subscription.subscribe ? wireSubscribeUserProps(subscription.userProperties, riderResolve) : undefined;
        if (sendUnresolved.size > 0) {
          return Promise.resolve({
            success: false,
            error: `Subscription has unresolved variables (${[...sendUnresolved].join(', ')}).`,
          });
        }
        return new Promise((resolveRider) => {
          const resolveAck = (reasonCode: number | null): void => {
            if (settled) {
              resolveRider({ success: false, error: 'The session ended before the broker answered.' });
              return;
            }
            resolveRider({ success: true, ...(reasonCode !== null ? { grantCode: reasonCode } : {}) });
          };
          if (subscription.subscribe) {
            const error = subscribeBatch(
              [
                {
                  subscription: {
                    topicFilter,
                    qos: subscription.qos ?? 0,
                    ...(v5 && subscription.noLocal !== undefined ? { noLocal: subscription.noLocal } : {}),
                    ...(v5 && subscription.retainAsPublished !== undefined
                      ? { retainAsPublished: subscription.retainAsPublished }
                      : {}),
                    ...(v5 && subscription.retainHandling !== undefined
                      ? { retainHandling: subscription.retainHandling }
                      : {}),
                  },
                  ...(v5 && subscription.subscriptionId !== undefined
                    ? { subscriptionId: subscription.subscriptionId }
                    : {}),
                  ...(userProperties !== undefined ? { userProperties } : {}),
                },
              ],
              resolveAck,
            );
            if (error !== null) resolveRider({ success: false, error });
            return;
          }
          const packetId = allocPacketId();
          const error = sendPacket({ type: 'unsubscribe', packetId, topicFilters: [topicFilter] });
          if (error !== null) {
            resolveRider({ success: false, error });
            return;
          }
          pendingSubAcks.set(`u${packetId}`, { filters: [topicFilter], resolveAck });
        });
      },
      close: () => {
        if (settled) return;
        if (end === null) end = { by: 'client' };
        sendPacket({ type: 'disconnect', reasonCode: v5 ? 0 : null });
        writer?.end();
      },
    });
  });
}

/** The oracle-side resolution closure — the module-mirror resolver the
 *  node hosts ride (the WS executor's twin). Hosts whose scopes live
 *  elsewhere inject `options.resolution` instead. */
async function buildOracleResolution(
  request: MqttRequest,
  options: ExecuteMqttSessionOptions,
): Promise<(template: string, unresolved: Set<string>) => string> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId ?? undefined);
  const context = {
    collectionId: collectionIdForPath(request.path, scope.workspaceId),
    environmentId: options.environmentId,
  };
  return (template, unresolved) => {
    const result = resolveTemplate(
      template,
      (name) => resolver.resolve(name, context),
      (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
    );
    for (const v of result.variables) {
      if (!v.resolved) unresolved.add(v.name);
    }
    return result.result;
  };
}

/** The collection whose variables scope this request — same
 *  path-prefix membership the HTTP resolver uses. */
function collectionIdForPath(path: string, workspaceId: string | null): string | undefined {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  return collections.find((c) => path.startsWith(`${c.path}/`))?.uid;
}
