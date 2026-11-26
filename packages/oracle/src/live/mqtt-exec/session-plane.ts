/**
 * Live plumbing for open MQTT sessions — host-neutral, the
 * `ws-exec/session-plane.ts` sibling for the MQTT executor plane: the
 * flush-batched `mqttStreamEvent` emitter behind the message timeline,
 * and the active-session registry behind the `publishMqttMessage` /
 * `setMqttSubscription` / `closeMqttSession` /
 * `reconnectMqttSessionNow` riders (the Stop hook
 * itself stays on the shared HTTP active-send registry — one abort
 * plane for every interactive send).
 *
 * Frames are display-only hints: the resolving `executeMqttRequest`
 * RPC's snapshot supersedes every frame. The batch unit is the ITEM —
 * the timeline's row: a PUBLISH message either direction, or a
 * subscription lifecycle fact (SUBACK grants / UNSUBACK) at its true
 * chronological position — flushed on the shared time window so the
 * broadcast rate stays bounded however chatty the broker is; open and
 * end frames emit immediately (they are single and load-bearing).
 */

import type {
  MqttPublishWire,
  MqttStreamEventWire,
  MqttStreamItemWire,
  MqttSubscriptionWire,
} from '@openheaders/core/bridge';
import type { MqttProperties } from '@openheaders/core/mqtt';
import type { SessionPublishMessage } from '@openheaders/core/scripts';
import type {
  ExecutedMqttEnd,
  ExecutedMqttGrant,
  ExecutedProxyRoute,
  SentAsWrittenReference,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';

/** Flush the pending item batch on this cadence — the WS emitter's
 *  window; per-item `atMs` stamps keep arrival fidelity through the
 *  batching. */
const FLUSH_INTERVAL_MS = 100;
/** Eager-flush bound — a burst larger than this flushes immediately
 *  instead of pooling a huge batch in memory. */
const FLUSH_MAX_ITEMS = 256;

// ── Session-frame emitter ───────────────────────────────────────────

export interface MqttStreamEmitter {
  /** Push the accepted CONNACK's facts as soon as they arrive — one
   *  frame. `remainingLength` is the CONNACK frame's Remaining Length
   *  as observed on the wire; `clientId` is what the CONNECT actually
   *  carried; `proxyRoute` carries the transport's route decision so
   *  the live session strip attributes honestly before the snapshot
   *  settles. */
  open(facts: {
    sessionPresent: boolean;
    reasonCode: number;
    remainingLength: number;
    clientId: string;
    proxyRoute?: ExecutedProxyRoute;
  }): void;
  /** Enqueue one timeline item; flushes by the time window. */
  item(item: MqttStreamItemWire): void;
  /** Settle the emitter (any end path): flush pending items, then
   *  emit the final `end` frame. */
  end(): void;
}

export function createMqttStreamEmitter(sendId: string, emit: (event: MqttStreamEventWire) => void): MqttStreamEmitter {
  let seq = 0;
  let settled = false;
  let pending: MqttStreamItemWire[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = (): void => {
    clearTimer();
    if (pending.length === 0) return;
    const items = pending;
    pending = [];
    emit({ sendId, seq: seq++, kind: 'items', items });
  };

  return {
    open(facts) {
      if (settled) return;
      // Open emits immediately, so the emit instant IS the observed
      // CONNACK-accepted instant — the item frames' atMs law.
      emit({
        sendId,
        seq: seq++,
        kind: 'open',
        sessionPresent: facts.sessionPresent,
        reasonCode: facts.reasonCode,
        remainingLength: facts.remainingLength,
        clientId: facts.clientId,
        ...(facts.proxyRoute !== undefined ? { proxyRoute: facts.proxyRoute } : {}),
        atMs: Date.now(),
      });
    },
    item(item) {
      if (settled) return;
      pending.push(item);
      if (pending.length >= FLUSH_MAX_ITEMS) {
        flush();
        return;
      }
      if (timer === null) timer = setTimeout(flush, FLUSH_INTERVAL_MS);
    },
    end() {
      if (settled) return;
      flush();
      settled = true;
      // End emits immediately on every settle path — its instant is
      // the observed teardown of the broker socket.
      emit({ sendId, seq: seq++, kind: 'end', atMs: Date.now() });
    },
  };
}

// ── Active-session registry (upstream riders) ───────────────────────

/** Who is publishing: the user's rider (its Before publish hook runs),
 *  or a script's `oh.publish` (already a hook's product — never
 *  re-enters). */
export type MqttPublishOrigin = 'rider' | 'script';

export interface MqttPublishResult {
  success: boolean;
  error?: string;
  /** The references the published message carried as written — the
   *  row wears the same list; absent when every reference resolved. */
  sentAsWritten?: SentAsWrittenReference[];
}

/** A PUBLISH as it went on the wire — after resolution and the Before publish hook. */
export interface MqttSentMessage {
  /** Its index in the session's event order. */
  position: number;
  atMs: number;
  topic: string;
  payload: Uint8Array;
  qos: 0 | 1 | 2;
  retain: boolean;
  properties?: MqttProperties;
}

/** A publish that waited for the broker — see `publishAcked`. */
export interface MqttAckedPublishResult extends MqttPublishResult {
  /** Present on success. */
  sent?: MqttSentMessage;
  /** How long the broker took to acknowledge it; absent at QoS 0, which nothing acknowledges. */
  ackMs?: number;
}

/** One inbound PUBLISH as the capture recorded it. */
export interface MqttObservedMessage {
  /** Its index in the session's event order — the one the On message hook is handed. */
  position: number;
  atMs: number;
  topic: string;
  payload: Uint8Array;
  qos: 0 | 1 | 2;
  retain: boolean;
  dup: boolean;
  properties?: MqttProperties;
}

/**
 * A session's facts at the capture point, as they happen — in order and
 * unpooled, where the stream emitter is a display feed. What a workflow
 * run reads its session through.
 */
export interface MqttSessionObserver {
  /**
   * Every SUBSCRIBE the session sent as it opened is answered — at the
   * CONNACK when it sent none. Once, on the first connection. `unsent`
   * names the filters whose SUBSCRIBE did not compose.
   */
  ready(facts: {
    sessionPresent: boolean;
    clientId: string;
    /** Present when the CONNECT's id was generated for it, not set on the request or by a script. */
    clientIdGenerated?: true;
    /** Present when the CONNECT asked to keep a stored session — Clean Start off. */
    keptSession?: true;
    grants: ExecutedMqttGrant[];
    unsent: Array<{ topicFilters: string[]; error: string }>;
  }): void;
  message(message: MqttObservedMessage): void;
  /** The session is over, before its After close hook runs. `error` is the transport's own word for it. */
  ended(facts: { end: ExecutedMqttEnd; stopped: boolean; error?: string }): void;
}

/** A SUBSCRIBE / UNSUBSCRIBE rider's answer — see `setSubscription`. */
export interface MqttSubscriptionResult {
  success: boolean;
  grantCode?: number;
  error?: string;
  /** The references the filter carried as written; absent when every
   *  reference resolved. */
  sentAsWritten?: SentAsWrittenReference[];
}

/** The executor's handle for one open session — what the
 *  `publishMqttMessage` / `setMqttSubscription` / `closeMqttSession`
 *  RPCs reach. */
export interface ActiveMqttSessionHandle {
  /** Resolve `{{refs}}` through the resolver built at Connect, decode
   *  the payload per its ENCODING, and publish. A malformed payload,
   *  an unresolved reference, or an invalid topic reports on the RPC
   *  alone — the session stays open. A rider publish runs the Before
   *  publish hook first (the answer waits for it; a drop answers with
   *  the dropping level's name); a script's publish never does. */
  publish(message: MqttPublishWire, origin?: MqttPublishOrigin): Promise<MqttPublishResult>;
  /**
   * A rider publish that answers at the broker's acknowledgement: at
   * QoS 0 when written, at QoS 1 on the PUBACK, at QoS 2 on the PUBCOMP.
   * A reason code that refuses fails it by name and code; so does the
   * session ending first.
   */
  publishAcked(message: MqttPublishWire): Promise<MqttAckedPublishResult>;
  /** Where the next message will land in the session's event order. */
  position(): number;
  /** SUBSCRIBE a Topics row's filter as it resolves now, or
   *  UNSUBSCRIBE the filter the row went up with (the session keeps it
   *  per row — an unsubscribe resolves nothing), resolving when the
   *  broker's ack arrives — `grantCode` is the SUBACK grant / UNSUBACK
   *  reason verbatim (absent on a 3.1.1 UNSUBACK). A session ending
   *  before the ack resolves `success: false`, never hangs. */
  setSubscription(subscription: MqttSubscriptionWire): Promise<MqttSubscriptionResult>;
  /** Start the clean close — DISCONNECT then the socket close. */
  close(): void;
  /** Dial the armed reconnect attempt now instead of after its wait.
   *  False = nothing is waiting. */
  reconnectNow(): boolean;
}

const activeSessions = new Map<string, ActiveMqttSessionHandle>();

/** Register an open session's handle under its send id. Returns the
 *  unregister disposer — the executor calls it on settle. */
export function registerActiveMqttSession(sendId: string, handle: ActiveMqttSessionHandle): () => void {
  activeSessions.set(sendId, handle);
  return () => {
    activeSessions.delete(sendId);
  };
}

/** Publish one message into an open session. `success: false` names
 *  the reason: no such session (settled, unknown id), a resolve error,
 *  a payload-decode error, an encode error, or a Before publish level
 *  that dropped the message. */
export function publishActiveMqttMessage(
  sendId: string,
  message: MqttPublishWire,
  origin: MqttPublishOrigin = 'rider',
): Promise<MqttPublishResult> {
  const handle = activeSessions.get(sendId);
  if (!handle) return Promise.resolve({ success: false, error: 'No open MQTT session with this id.' });
  return handle.publish(message, origin);
}

/** Publish one message into an open session and wait for the broker's acknowledgement. */
export function publishActiveMqttMessageAcked(
  sendId: string,
  message: MqttPublishWire,
): Promise<MqttAckedPublishResult> {
  const handle = activeSessions.get(sendId);
  if (!handle) return Promise.resolve({ success: false, error: 'No open MQTT session with this id.' });
  return handle.publishAcked(message);
}

/** Where the next message will land in an open session's event order; `null` = no such session. */
export function activeMqttSessionPosition(sendId: string): number | null {
  return activeSessions.get(sendId)?.position() ?? null;
}

/**
 * A script's `oh.publish` message as the rider carries it — the
 * `session.publish` host op's shape onto {@link MqttPublishWire}: the
 * user-property pairs gain the row identities the rider's rows have
 * (the executor resolves and filters them like any compose block).
 */
export function scriptPublishToWire(message: SessionPublishMessage): MqttPublishWire {
  const { properties, ...rest } = message;
  if (properties === undefined) return rest;
  const { userProperties, ...scalars } = properties;
  return {
    ...rest,
    properties: {
      ...scalars,
      ...(userProperties !== undefined
        ? { userProperties: userProperties.map((row) => ({ uid: generateUid(), key: row.key, value: row.value })) }
        : {}),
    },
  };
}

/** Toggle one live subscription on an open session. */
export async function setActiveMqttSubscription(
  sendId: string,
  subscription: MqttSubscriptionWire,
): Promise<{ success: boolean; grantCode?: number; error?: string }> {
  const handle = activeSessions.get(sendId);
  if (!handle) return { success: false, error: 'No open MQTT session with this id.' };
  return handle.setSubscription(subscription);
}

/** Cut a session's auto-reconnect wait short. False = no such
 *  session, or nothing is waiting. */
export function reconnectActiveMqttSessionNow(sendId: string): boolean {
  const handle = activeSessions.get(sendId);
  if (!handle) return false;
  return handle.reconnectNow();
}

/** Start an open session's clean close. False = no such session. */
export function closeActiveMqttSession(sendId: string): boolean {
  const handle = activeSessions.get(sendId);
  if (!handle) return false;
  handle.close();
  return true;
}
