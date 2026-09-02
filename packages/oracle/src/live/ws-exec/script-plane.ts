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
 * One chain per hook composes the ancestor levels' slots onto the
 * request's own (`script-chain.ts` — outer → inner, no override) and
 * runs through the shared fold; the hooks of one session run SERIALLY
 * through a per-session queue, so a reply sent from an On message hook
 * never races the next frame's hook. Each hook call is one sandbox
 * invocation per level on the session's runtime context (`oh.session`
 * shared across every call, the sources compiled once).
 *
 * Attribution: every event that ran a hook records a `script` mark on
 * the session timeline (the hook, the levels with their verdicts, the
 * error, the console, the assertions) up to {@link MAX_WS_SCRIPT_MARKS}
 * — past the cap the marks stop and the snapshot's tallies keep
 * counting, so a chatty session's record stays bounded and its message
 * positions stable. The snapshot's `scripts` record keeps the fold of
 * the once-per-session hooks (Before connect: the LAST dial's, with the
 * dials counted; After close) and a tally for the per-event ones.
 */

import type {
  ScriptExecutionResult,
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
  ScriptEventLevelSummary,
  ScriptEventSummary,
} from '@openheaders/core/types';
import { type ChainFold, type ChainScript, runScriptChain } from '../request-exec/script-chain';
import { replaceUrlParams, type SessionScriptHost } from '../request-exec/script-hooks';

/** Per-event marks stop past this many — the tallies keep counting. */
export const MAX_WS_SCRIPT_MARKS = 1000;

/** The composed chain per hook — an empty chain means the hook never runs. */
export type WsScriptChains = Readonly<Record<WsScriptKind, readonly ChainScript[]>>;

/** True when any hook carries a script — the executor mounts the plane only then. */
export function hasWsScriptChains(chains: WsScriptChains): boolean {
  return Object.values(chains).some((chain) => chain.length > 0);
}

export interface WsScriptPlaneDeps {
  /** The session's send id — the runtime-side context key. */
  sessionId: string;
  host: SessionScriptHost;
  chains: WsScriptChains;
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
  const { sessionId, host, chains } = deps;

  // ── The per-session queue — hooks never interleave ──
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  // ── The record ──
  let marks = 0;
  let marksCapped = false;
  let ran = false;
  let beforeConnect: (ExecutedScriptFold & { dials: number }) | undefined;
  let afterClose: ExecutedScriptFold | undefined;
  let beforeSend: (ScriptEventSummary & { dropped: number }) | undefined;
  let onMessage: ScriptEventSummary | undefined;

  const record = (
    hook: WsScriptKind,
    fold: ChainFold,
    extra: Pick<ExecutedWsScriptMark, 'attempt' | 'droppedBy'> = {},
  ): void => {
    ran = true;
    if (marks >= MAX_WS_SCRIPT_MARKS) {
      marksCapped = true;
      return;
    }
    marks += 1;
    deps.recordMark({
      kind: 'script',
      hook,
      succeeded: fold.succeeded,
      durationMs: fold.durationMs,
      chain: fold.chain,
      ...(fold.error !== undefined ? { error: fold.error } : {}),
      ...(fold.consoleLog.length > 0 ? { consoleLog: fold.consoleLog } : {}),
      ...(fold.assertions.length > 0 ? { assertions: fold.assertions } : {}),
      ...extra,
    });
  };

  const foldOf = (fold: ChainFold): ExecutedScriptFold => ({
    succeeded: fold.succeeded,
    ...(fold.error !== undefined ? { error: fold.error } : {}),
    consoleLog: fold.consoleLog,
    assertions: fold.assertions,
    durationMs: fold.durationMs,
    chain: fold.chain,
  });

  /** Fold one run into a per-event tally — per level and overall. */
  const tally = (summary: ScriptEventSummary | undefined, fold: ChainFold): ScriptEventSummary => {
    const next: ScriptEventSummary = summary ?? { runs: 0, failed: 0, durationMs: 0, levels: [] };
    next.runs += 1;
    next.durationMs += fold.durationMs;
    if (!fold.succeeded) {
      next.failed += 1;
      if (fold.error !== undefined) next.lastError = fold.error;
    }
    for (const step of fold.chain) {
      let level: ScriptEventLevelSummary | undefined = next.levels.find((l) => l.uid === step.uid);
      if (level === undefined) {
        level = { level: step.level, uid: step.uid, name: step.name, runs: 0, failed: 0, durationMs: 0 };
        next.levels.push(level);
      }
      level.runs += 1;
      level.durationMs += step.durationMs;
      if (!step.succeeded) level.failed += 1;
    }
    return next;
  };

  const runHook = (
    kind: WsScriptKind,
    execute: (script: ChainScript) => Promise<ScriptExecutionResult>,
    onLevel?: (result: ScriptExecutionResult, script: ChainScript) => void | 'stop',
  ) =>
    runScriptChain(chains[kind], execute, {
      strict: false,
      ...(onLevel !== undefined ? { onLevelSucceeded: onLevel } : {}),
    });

  return {
    beforeConnect(connect) {
      if (chains['ws-before-connect'].length === 0) return Promise.resolve(connect);
      return enqueue(async () => {
        let current = connect;
        const fold = await runHook(
          'ws-before-connect',
          (script) =>
            host.run({
              kind: 'ws-before-connect',
              source: script.source,
              sessionId,
              hook: { kind: 'ws-before-connect', connect: current },
            }),
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
          record('ws-before-connect', fold, { attempt: connect.attempt });
          beforeConnect = { ...foldOf(fold), dials: (beforeConnect?.dials ?? 0) + 1 };
        }
        return current;
      });
    },

    beforeSend(message) {
      if (chains['ws-before-send'].length === 0) return Promise.resolve({ kind: 'send', message });
      return enqueue(async () => {
        let current = message;
        let droppedBy: string | null = null;
        const fold = await runHook(
          'ws-before-send',
          (script) =>
            host.run({
              kind: 'ws-before-send',
              source: script.source,
              sessionId,
              hook: { kind: 'ws-before-send', message: current },
            }),
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
          record('ws-before-send', fold, droppedBy !== null ? { droppedBy } : {});
          const next = tally(beforeSend, fold);
          beforeSend = { ...next, dropped: (beforeSend?.dropped ?? 0) + (droppedBy !== null ? 1 : 0) };
        }
        return droppedBy !== null ? { kind: 'dropped', by: droppedBy } : { kind: 'send', message: current };
      });
    },

    onMessage(message) {
      if (chains['ws-on-message'].length === 0) return;
      void enqueue(async () => {
        const fold = await runHook('ws-on-message', (script) =>
          host.run({
            kind: 'ws-on-message',
            source: script.source,
            sessionId,
            hook: { kind: 'ws-on-message', message },
          }),
        );
        if (fold !== null) {
          record('ws-on-message', fold);
          onMessage = tally(onMessage, fold);
        }
      });
    },

    afterClose(close) {
      // Even a session with no After close script waits for its queued
      // hooks — an On message still running must land its mark before
      // the record settles.
      return enqueue(async () => {
        if (chains['ws-after-close'].length === 0) return;
        const fold = await runHook('ws-after-close', (script) =>
          host.run({
            kind: 'ws-after-close',
            source: script.source,
            sessionId,
            hook: { kind: 'ws-after-close', close },
          }),
        );
        if (fold !== null) {
          record('ws-after-close', fold);
          afterClose = foldOf(fold);
        }
      });
    },

    summary() {
      if (!ran) return undefined;
      return {
        mode: host.mode,
        ...(beforeConnect !== undefined ? { beforeConnect } : {}),
        ...(beforeSend !== undefined ? { beforeSend } : {}),
        ...(onMessage !== undefined ? { onMessage } : {}),
        ...(afterClose !== undefined ? { afterClose } : {}),
        ...(marksCapped ? { marksCapped: true as const } : {}),
      };
    },

    end() {
      host.endSession(sessionId);
    },
  };
}
