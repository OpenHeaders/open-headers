/**
 * MQTT script plane — the four hooks a live session runs through the
 * host's script capability, mounted by the executor beside its
 * protocol driver (the WebSocket plane's twin on the CONNECT / PUBLISH
 * plane): Before connect at EVERY dial (the first and each
 * auto-reconnect attempt — lenient: a failed level applies nothing and
 * the CONNECT composes on what the other levels left), Before publish
 * per RIDER publish (a level may rewrite the topic / payload / flags /
 * properties or drop it — the drop ends the publish and the rider
 * answers with the dropping level's name; the driver's own protocol
 * frames — acks, PINGREQ, SUBSCRIBE, a QoS retransmission — never
 * pass here), On message per captured INBOUND PUBLISH (after the
 * capture, which never waits; the hook observes, replies through
 * `oh.publish`, asserts), After close once at settle for a session
 * that opened.
 *
 * The serial queue, the mark cap, the fold → mark projection and the
 * per-event tally are the session plane core's
 * (`request-exec/session-script-plane.ts` — the one law the WebSocket
 * plane rides too); this module owns the MQTT seams and how a
 * mutating level's diff lands on the next level's input.
 */

import type {
  MqttCloseSnapshot,
  MqttConnectSnapshot,
  MqttInboundMessageSnapshot,
  MqttOutboundMessageSnapshot,
  MqttScriptKind,
} from '@openheaders/core/scripts';
import type {
  ExecutedMqttScriptMark,
  ExecutedMqttScripts,
  ExecutedScriptFold,
  ScriptEventSummary,
} from '@openheaders/core/types';
import {
  createSessionScriptPlaneCore,
  type SessionScriptChains,
  type SessionScriptPlaneDeps,
} from '../request-exec/session-script-plane';

/** The composed chain per hook — an empty chain means the hook never runs. */
export type MqttScriptChains = SessionScriptChains<MqttScriptKind>;

export interface MqttScriptPlaneDeps extends Omit<SessionScriptPlaneDeps<MqttScriptKind>, 'recordMark'> {
  /** Record one mark on the event log at its current position — the
   *  executor records and emits it like any other session fact. */
  recordMark(mark: ExecutedMqttScriptMark): void;
}

/** Before publish's answer: the message as the chain left it, or the drop. */
export type MqttBeforePublishOutcome =
  | { kind: 'publish'; message: MqttOutboundMessageSnapshot }
  | { kind: 'dropped'; by: string };

export interface MqttScriptPlane {
  /** Run the Before connect chain for one dial; the CONNECT composes
   *  on what it returns (the input verbatim when no level mutated). */
  beforeConnect(connect: MqttConnectSnapshot): Promise<MqttConnectSnapshot>;
  /** Run the Before publish chain for one rider publish. */
  beforePublish(message: MqttOutboundMessageSnapshot): Promise<MqttBeforePublishOutcome>;
  /** Queue the On message chain for one captured inbound PUBLISH —
   *  returns at once; the capture never waits. */
  onMessage(message: MqttInboundMessageSnapshot): void;
  /** Run the After close chain once — resolves after every queued
   *  hook (an On message still running) and the close hook settled. */
  afterClose(close: MqttCloseSnapshot): Promise<void>;
  /** The snapshot record; `undefined` when no hook ran. */
  summary(): ExecutedMqttScripts | undefined;
  /** Release the session's runtime context — after {@link afterClose}. */
  end(): void;
}

export function createMqttScriptPlane(deps: MqttScriptPlaneDeps): MqttScriptPlane {
  const core = createSessionScriptPlaneCore<MqttScriptKind>(deps);

  let beforeConnect: (ExecutedScriptFold & { dials: number }) | undefined;
  let afterClose: ExecutedScriptFold | undefined;
  let beforePublish: (ScriptEventSummary & { dropped: number }) | undefined;
  let onMessage: ScriptEventSummary | undefined;

  return {
    beforeConnect(connect) {
      if (!core.has('mqtt-before-connect')) return Promise.resolve(connect);
      return core.enqueue(async () => {
        let current = connect;
        const fold = await core.run(
          'mqtt-before-connect',
          () => ({ kind: 'mqtt-before-connect', connect: current }),
          (result) => {
            const m = result.sessionMutation;
            if (m === undefined || m.kind !== 'mqtt-connect') return undefined;
            current = {
              ...current,
              clientId: m.clientId ?? current.clientId,
              username: m.username ?? current.username,
              password: m.password ?? current.password,
              // `null` drops the will — an explicit key, not an absence.
              will: m.will !== undefined ? m.will : current.will,
              subscriptions: m.subscriptions ?? current.subscriptions,
              userProperties: m.userProperties ?? current.userProperties,
            };
            return undefined;
          },
        );
        if (fold !== null) {
          core.record('mqtt-before-connect', fold, { attempt: connect.attempt });
          beforeConnect = { ...core.foldOf(fold), dials: (beforeConnect?.dials ?? 0) + 1 };
        }
        return current;
      });
    },

    beforePublish(message) {
      if (!core.has('mqtt-before-publish')) return Promise.resolve({ kind: 'publish', message });
      return core.enqueue(async () => {
        let current = message;
        let droppedBy: string | null = null;
        const fold = await core.run(
          'mqtt-before-publish',
          () => ({ kind: 'mqtt-before-publish', message: current }),
          (result, script) => {
            const m = result.sessionMutation;
            if (m === undefined || m.kind !== 'mqtt-publish') return undefined;
            if (m.drop) {
              droppedBy = script.label;
              return 'stop';
            }
            current = {
              ...current,
              ...(m.topic !== undefined ? { topic: m.topic } : {}),
              ...(m.payload !== undefined ? { payload: m.payload } : {}),
              ...(m.format !== undefined ? { format: m.format } : {}),
              ...(m.qos !== undefined ? { qos: m.qos } : {}),
              ...(m.retain !== undefined ? { retain: m.retain } : {}),
              ...(m.properties !== undefined ? { properties: m.properties } : {}),
            };
            return undefined;
          },
        );
        if (fold !== null) {
          core.record('mqtt-before-publish', fold, droppedBy !== null ? { droppedBy } : {});
          const next = core.tally(beforePublish, fold);
          beforePublish = { ...next, dropped: (beforePublish?.dropped ?? 0) + (droppedBy !== null ? 1 : 0) };
        }
        return droppedBy !== null ? { kind: 'dropped', by: droppedBy } : { kind: 'publish', message: current };
      });
    },

    onMessage(message) {
      if (!core.has('mqtt-on-message')) return;
      void core.enqueue(async () => {
        const fold = await core.run('mqtt-on-message', () => ({ kind: 'mqtt-on-message', message }));
        if (fold !== null) {
          core.record('mqtt-on-message', fold);
          onMessage = core.tally(onMessage, fold);
        }
      });
    },

    afterClose(close) {
      // Even a session with no After close script waits for its queued
      // hooks — an On message still running must land its mark before
      // the record settles.
      return core.enqueue(async () => {
        if (!core.has('mqtt-after-close')) return;
        const fold = await core.run('mqtt-after-close', () => ({ kind: 'mqtt-after-close', close }));
        if (fold !== null) {
          core.record('mqtt-after-close', fold);
          afterClose = core.foldOf(fold);
        }
      });
    },

    summary() {
      if (!core.ran()) return undefined;
      return {
        mode: core.mode,
        ...(beforeConnect !== undefined ? { beforeConnect } : {}),
        ...(beforePublish !== undefined ? { beforePublish } : {}),
        ...(onMessage !== undefined ? { onMessage } : {}),
        ...(afterClose !== undefined ? { afterClose } : {}),
        ...(core.marksCapped() ? { marksCapped: true as const } : {}),
      };
    },

    end: () => core.end(),
  };
}
