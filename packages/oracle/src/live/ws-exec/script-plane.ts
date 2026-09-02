/**
 * WebSocket script plane — the four hooks a live session runs through
 * the host's script capability, mounted by the executor beside its
 * transport seam: Before connect at EVERY dial (the first and each
 * auto-reconnect attempt — lenient: a failed level applies nothing and
 * the dial proceeds on what the other levels left), Before send per
 * RIDER send (a level may rewrite the message or drop it — the drop
 * ends the send and the rider answers with the dropping level's name;
 * heartbeat and protocol frames never pass here), On message per
 * captured INBOUND frame (after the capture, which never waits; the
 * hook observes, replies through `oh.send`, asserts), After close once
 * at settle for a session that opened.
 *
 * The serial queue, the mark cap, the fold → mark projection and the
 * per-event tally are the session plane core's
 * (`request-exec/session-script-plane.ts` — the one law the MQTT plane
 * rides too); this module owns the WebSocket seams and how a
 * mutating level's diff lands on the next level's input.
 */

import type {
  WsCloseSnapshot,
  WsConnectSnapshot,
  WsInboundMessageSnapshot,
  WsOutboundMessageSnapshot,
  WsScriptKind,
} from '@openheaders/core/scripts';
import type {
  ExecutedScriptFold,
  ExecutedWsScriptMark,
  ExecutedWsScripts,
  ScriptEventSummary,
} from '@openheaders/core/types';
import { replaceUrlParams } from '../request-exec/script-hooks';
import {
  createSessionScriptPlaneCore,
  type SessionScriptChains,
  type SessionScriptPlaneDeps,
} from '../request-exec/session-script-plane';

/** The composed chain per hook — an empty chain means the hook never runs. */
export type WsScriptChains = SessionScriptChains<WsScriptKind>;

export interface WsScriptPlaneDeps extends Omit<SessionScriptPlaneDeps<WsScriptKind>, 'recordMark'> {
  /** Record one mark on the timeline at the capture's current index —
   *  the executor stamps `atIndex` and emits it live. */
  recordMark(mark: ExecutedWsScriptMark): void;
}

/** Before send's answer: the message as the chain left it, or the drop. */
export type WsBeforeSendOutcome =
  | { kind: 'send'; message: WsOutboundMessageSnapshot }
  | { kind: 'dropped'; by: string };

export interface WsScriptPlane {
  /** Run the Before connect chain for one dial; the dial proceeds on
   *  what it returns (the input verbatim when no level mutated). */
  beforeConnect(connect: WsConnectSnapshot): Promise<WsConnectSnapshot>;
  /** Run the Before send chain for one rider send. */
  beforeSend(message: WsOutboundMessageSnapshot): Promise<WsBeforeSendOutcome>;
  /** Queue the On message chain for one captured inbound frame —
   *  returns at once; the capture never waits. */
  onMessage(message: WsInboundMessageSnapshot): void;
  /** Run the After close chain once — resolves after every queued
   *  hook (an On message still running) and the close hook settled. */
  afterClose(close: WsCloseSnapshot): Promise<void>;
  /** The snapshot record; `undefined` when no hook ran. */
  summary(): ExecutedWsScripts | undefined;
  /** Release the session's runtime context — after {@link afterClose}. */
  end(): void;
}

export function createWsScriptPlane(deps: WsScriptPlaneDeps): WsScriptPlane {
  const core = createSessionScriptPlaneCore<WsScriptKind>(deps);

  let beforeConnect: (ExecutedScriptFold & { dials: number }) | undefined;
  let afterClose: ExecutedScriptFold | undefined;
  let beforeSend: (ScriptEventSummary & { dropped: number }) | undefined;
  let onMessage: ScriptEventSummary | undefined;

  return {
    beforeConnect(connect) {
      if (!core.has('ws-before-connect')) return Promise.resolve(connect);
      return core.enqueue(async () => {
        let current = connect;
        const fold = await core.run(
          'ws-before-connect',
          () => ({ kind: 'ws-before-connect', connect: current }),
          (result) => {
            const m = result.sessionMutation;
            if (m === undefined || m.kind !== 'ws-connect') return undefined;
            // The HTTP mutation's application order: the URL first, then
            // a params list rewrites its query wholesale.
            let url = m.url ?? current.url;
            const params = m.params ?? current.params;
            if (m.params !== undefined) url = replaceUrlParams(url, m.params);
            current = {
              ...current,
              url,
              params,
              headers: m.headers ?? current.headers,
              subprotocols: m.subprotocols ?? current.subprotocols,
            };
            return undefined;
          },
        );
        if (fold !== null) {
          core.record('ws-before-connect', fold, { attempt: connect.attempt });
          beforeConnect = { ...core.foldOf(fold), dials: (beforeConnect?.dials ?? 0) + 1 };
        }
        return current;
      });
    },

    beforeSend(message) {
      if (!core.has('ws-before-send')) return Promise.resolve({ kind: 'send', message });
      return core.enqueue(async () => {
        let current = message;
        let droppedBy: string | null = null;
        const fold = await core.run(
          'ws-before-send',
          () => ({ kind: 'ws-before-send', message: current }),
          (result, script) => {
            const m = result.sessionMutation;
            if (m === undefined || m.kind !== 'ws-send') return undefined;
            if (m.drop) {
              droppedBy = script.label;
              return 'stop';
            }
            current = {
              ...current,
              ...(m.text !== undefined ? { text: m.text } : {}),
              ...(m.eventName !== undefined ? { eventName: m.eventName } : {}),
            };
            return undefined;
          },
        );
        if (fold !== null) {
          core.record('ws-before-send', fold, droppedBy !== null ? { droppedBy } : {});
          const next = core.tally(beforeSend, fold);
          beforeSend = { ...next, dropped: (beforeSend?.dropped ?? 0) + (droppedBy !== null ? 1 : 0) };
        }
        return droppedBy !== null ? { kind: 'dropped', by: droppedBy } : { kind: 'send', message: current };
      });
    },

    onMessage(message) {
      if (!core.has('ws-on-message')) return;
      void core.enqueue(async () => {
        const fold = await core.run('ws-on-message', () => ({ kind: 'ws-on-message', message }));
        if (fold !== null) {
          core.record('ws-on-message', fold);
          onMessage = core.tally(onMessage, fold);
        }
      });
    },

    afterClose(close) {
      // Even a session with no After close script waits for its queued
      // hooks — an On message still running must land its mark before
      // the record settles.
      return core.enqueue(async () => {
        if (!core.has('ws-after-close')) return;
        const fold = await core.run('ws-after-close', () => ({ kind: 'ws-after-close', close }));
        if (fold !== null) {
          core.record('ws-after-close', fold);
          afterClose = core.foldOf(fold);
        }
      });
    },

    summary() {
      if (!core.ran()) return undefined;
      return {
        mode: core.mode,
        ...(beforeConnect !== undefined ? { beforeConnect } : {}),
        ...(beforeSend !== undefined ? { beforeSend } : {}),
        ...(onMessage !== undefined ? { onMessage } : {}),
        ...(afterClose !== undefined ? { afterClose } : {}),
        ...(core.marksCapped() ? { marksCapped: true as const } : {}),
      };
    },

    end: () => core.end(),
  };
}
