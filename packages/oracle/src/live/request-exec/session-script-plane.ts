/**
 * Session script plane core — the half every session family's script
 * plane shares, so the WebSocket plane and the MQTT plane are two
 * siblings over ONE law: the hooks of one session run SERIALLY through
 * a per-session queue (a reply sent from an On message hook never
 * races the next event's hook), each hook call runs the composed chain
 * through the host's script capability (`script-chain.ts` — outer →
 * inner, no override, lenient), every event that ran a hook records a
 * `script` mark on the session timeline up to {@link
 * MAX_SESSION_SCRIPT_MARKS} — past the cap the marks STOP (never roll,
 * so the timeline's positional joins hold) while the tallies keep
 * counting — and the fold projects into the snapshot record's shapes
 * (the once-per-session hooks keep a fold, the per-event hooks a
 * tally).
 *
 * What stays with the family: which hook runs at which seam, the
 * hook's input shape, and how a mutating level's diff applies onto the
 * next level's input.
 */

import type {
  ScriptExecutionMode,
  ScriptExecutionResult,
  SessionHookInput,
  SessionScriptKind,
} from '@openheaders/core/scripts';
import type {
  ExecutedScriptFold,
  ExecutedSessionScriptMark,
  ScriptEventLevelSummary,
  ScriptEventSummary,
} from '@openheaders/core/types';
import { type ChainFold, type ChainScript, runScriptChain } from './script-chain';
import type { SessionScriptHost } from './script-hooks';

/** Per-event marks stop past this many — the tallies keep counting. */
export const MAX_SESSION_SCRIPT_MARKS = 1000;

/** The composed chain per hook — an empty chain means the hook never runs. */
export type SessionScriptChains<K extends SessionScriptKind> = Readonly<Record<K, readonly ChainScript[]>>;

/** True when any hook carries a script — an executor mounts its plane only then. */
export function hasSessionScriptChains<K extends SessionScriptKind>(chains: SessionScriptChains<K>): boolean {
  return Object.values<readonly ChainScript[]>(chains).some((chain) => chain.length > 0);
}

/** A family's timeline mark — the shared detail under the family's hook kind. */
export type SessionScriptMarkOf<K extends SessionScriptKind> = ExecutedSessionScriptMark & { kind: 'script'; hook: K };

export interface SessionScriptPlaneDeps<K extends SessionScriptKind> {
  /** The session's send id — the runtime-side context key. */
  sessionId: string;
  host: SessionScriptHost;
  chains: SessionScriptChains<K>;
  /** Record one mark on the timeline at the capture's current index —
   *  the executor stamps its position and emits it live. */
  recordMark(mark: SessionScriptMarkOf<K>): void;
}

/** A level SUCCEEDED — the family lands what it produced before the
 *  next level runs, and may end the chain (`'stop'` — a drop). */
export type SessionLevelHandler = (result: ScriptExecutionResult, script: ChainScript) => void | 'stop';

export interface SessionScriptPlaneCore<K extends SessionScriptKind> {
  /** The trust posture the hooks run under — the record's `mode`. */
  readonly mode: ScriptExecutionMode;
  /** True when the hook's chain carries at least one level. */
  has(kind: K): boolean;
  /** Queue one task behind the session's earlier hooks — never interleaved. */
  enqueue<T>(task: () => Promise<T>): Promise<T>;
  /** Run one hook's chain (lenient) through the host — `null` for an
   *  empty chain: nothing ran, nothing to record. `hook` is read per
   *  LEVEL, so a mutating hook hands a thunk over its running input and
   *  each level sees what the previous one left. */
  run(kind: K, hook: () => SessionHookInput, onLevel?: SessionLevelHandler): Promise<ChainFold | null>;
  /** Record one hook run as a timeline mark — a no-op past the cap. */
  record(hook: K, fold: ChainFold, extra?: Pick<ExecutedSessionScriptMark, 'attempt' | 'droppedBy'>): void;
  /** A once-per-session hook's record. */
  foldOf(fold: ChainFold): ExecutedScriptFold;
  /** Fold one run into a per-event tally — per level and overall. */
  tally(summary: ScriptEventSummary | undefined, fold: ChainFold): ScriptEventSummary;
  /** True once any hook ran — the record exists. */
  ran(): boolean;
  /** True once the marks stopped at the cap. */
  marksCapped(): boolean;
  /** Release the session's runtime context — after the last hook. */
  end(): void;
}

export function createSessionScriptPlaneCore<K extends SessionScriptKind>(
  deps: SessionScriptPlaneDeps<K>,
): SessionScriptPlaneCore<K> {
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

  // ── The marks ──
  let marks = 0;
  let marksCapped = false;
  let ran = false;

  return {
    mode: host.mode,
    has: (kind) => chains[kind].length > 0,
    enqueue,
    run(kind, hook, onLevel) {
      return runScriptChain(
        chains[kind],
        (script) => host.run({ kind, source: script.source, sessionId, hook: hook() }),
        {
          strict: false,
          ...(onLevel !== undefined ? { onLevelSucceeded: onLevel } : {}),
        },
      );
    },
    record(hook, fold, extra = {}) {
      ran = true;
      if (marks >= MAX_SESSION_SCRIPT_MARKS) {
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
    },
    foldOf: (fold) => ({
      succeeded: fold.succeeded,
      ...(fold.error !== undefined ? { error: fold.error } : {}),
      consoleLog: fold.consoleLog,
      assertions: fold.assertions,
      durationMs: fold.durationMs,
      chain: fold.chain,
    }),
    tally(summary, fold) {
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
    },
    ran: () => ran,
    marksCapped: () => marksCapped,
    end() {
      host.endSession(sessionId);
    },
  };
}
