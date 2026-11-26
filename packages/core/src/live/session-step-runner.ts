/**
 * The session steps of a run (the workflow runs plan, The model): a
 * `listen` opens a session, a `send` puts a message on it, an `expect`
 * waits for one. The chain runner walks the steps and keeps the run's
 * state; this keeps the run's sessions and what it holds of them, over
 * the one session port.
 *
 *   - An `expect`'s window opens when its trigger starts: its address is
 *     resolved then, and the window is a position in the session's order.
 *     Its deadline counts from there. A call starts when its first send
 *     leaves for the wire — a wait on the host's rate limit is before it.
 *   - A match is the first message in the window that holds to the
 *     criteria; a stored message is passed over unless the step asks.
 *   - Every wait has a deadline: becoming ready, a match, a close.
 *   - A session that ended on its own is not reopened: the steps that
 *     need it fail, naming the end.
 */

import type {
  ChainWorkflow,
  Criterion,
  ExpectWorkflowStep,
  KnownWorkflowStep,
  ListenWorkflowStep,
  SendWorkflowStep,
  SessionWorkflowStep,
} from '../types/live';
import type { ChainExecutionContext } from './chain-runner';
import { judgeCriteria, resolveCriteria } from './criteria';
import { applyExtractor } from './extractor';
import type { SessionClose, StepFailurePhase, StepProduct, StepSettlement, WindowEntry } from './run-events';
import {
  type RunSession,
  type SessionHost,
  type SessionMessage,
  type SessionOpenResult,
  subjectOfMessage,
} from './session-port';
import {
  createRunWindowBudget,
  createSessionHold,
  RUN_WINDOW_MAX_BYTES,
  RUN_WINDOW_MAX_MESSAGES,
  type SessionHold,
} from './session-window';
import { isExpectStep } from './step-actions';

/** How long a session's clean close may take when its run ends. */
export const SESSION_CLOSE_DEADLINE_MS = 5_000;

export type SessionStepOutcome =
  | { ok: true; captures: Map<string, string>; settlement: StepSettlement; product?: StepProduct }
  | {
      ok: false;
      phase: StepFailurePhase;
      reason: string;
      extractorFailure?: { captureName: string; kind: string; message: string };
      product?: StepProduct;
    };

export interface SessionStepRunner {
  /** Open the window of every `expect` this step triggers — asked as the step starts. */
  armTriggeredBy(step: KnownWorkflowStep): Promise<void>;
  /**
   * A call's first send left for the wire: each window it opened opens
   * here instead, so a wait on the host's rate limit is neither in the
   * window nor counted against its deadline.
   */
  triggerLeft(step: KnownWorkflowStep): void;
  run(step: SessionWorkflowStep): Promise<SessionStepOutcome>;
  /** End every open session, last opened first, each under the close deadline. */
  close(): Promise<SessionClose[]>;
}

interface OpenSession {
  session: RunSession;
  readyAt: number;
}

interface ArmedWindow {
  startedAt: number;
  address: string | null;
}

export function createSessionStepRunner(deps: {
  workflow: ChainWorkflow;
  sessions: SessionHost | undefined;
  /** The run's one capture map, handed to each session by reference. */
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>;
  context: ChainExecutionContext;
  resolveText: (template: string) => Promise<string>;
  now: () => number;
  timer: (ms: number, signal: AbortSignal) => Promise<void>;
}): SessionStepRunner {
  const { workflow, sessions, stepCaptures, context, resolveText, now, timer } = deps;
  const expects = workflow.steps.filter(isExpectStep);
  const budget = createRunWindowBudget();
  const holds = new Map<string, SessionHold>();
  const open = new Map<string, OpenSession>();
  const armed = new Map<string, ArmedWindow>();
  const unarmed = new Map<string, string>();

  const holdOf = (listenId: string): SessionHold => {
    const existing = holds.get(listenId);
    if (existing !== undefined) return existing;
    const created = createSessionHold(budget);
    holds.set(listenId, created);
    return created;
  };

  /** Settles `true` when `work` does, `false` when `ms` pass first. */
  const within = async <T>(ms: number, work: Promise<T>): Promise<{ inTime: true; value: T } | { inTime: false }> => {
    const waiting = new AbortController();
    const raced = await Promise.race([
      work.then((value) => ({ inTime: true as const, value })),
      timer(ms, waiting.signal).then(() => ({ inTime: false as const })),
    ]);
    waiting.abort();
    return raced;
  };

  const listen = async (step: ListenWorkflowStep): Promise<SessionStepOutcome> => {
    if (sessions === undefined) return { ok: false, phase: 'listen', reason: 'This host opens no session.' };
    const startedAt = now();
    const hold = holdOf(step.id);
    const deadline = new AbortController();
    const opening: Promise<SessionOpenResult> = sessions
      .open(step, {
        stepCaptures,
        context,
        signal: deadline.signal,
        onMessage: (message) => hold.offer(message),
        onEnded: (reason) => hold.end(reason),
      })
      .catch((error: unknown) => ({ ok: false, reason: messageOf(error) }));
    const opened = await within(step.timeoutMs, opening);
    if (!opened.inTime) {
      deadline.abort();
      // A session that becomes ready after its deadline is nobody's: end it.
      void opening.then((late) => (late.ok ? late.session.end() : undefined)).catch(() => undefined);
      return { ok: false, phase: 'listen', reason: `Not ready within ${formatWait(step.timeoutMs)}.` };
    }
    if (!opened.value.ok) return { ok: false, phase: 'listen', reason: opened.value.reason };
    const { session } = opened.value;
    hold.setMatcher((address, message) => session.matchesAddress(address, message));
    const readyAt = now();
    open.set(step.id, { session, readyAt });
    return {
      ok: true,
      captures: new Map(),
      settlement: { state: 'ready', readyMs: readyAt - startedAt, captureNames: [] },
    };
  };

  /** The open session a step acts on, or why there is none. */
  const sessionOf = (listenId: string): { session: RunSession; hold: SessionHold } | { reason: string } => {
    const entry = open.get(listenId);
    if (entry === undefined) return { reason: `Step "${listenId}" opened no session.` };
    const hold = holdOf(listenId);
    if (hold.ended !== null) return { reason: `The session of "${listenId}" had ended: ${hold.ended}` };
    return { session: entry.session, hold };
  };

  const send = async (step: SendWorkflowStep): Promise<SessionStepOutcome> => {
    const target = sessionOf(step.on);
    if ('reason' in target) return { ok: false, phase: 'send', reason: target.reason };
    let message: SessionMessage | null = null;
    let reply: SessionMessage | undefined;
    let ackMs: number | undefined;
    try {
      if (step.messageUid !== undefined) {
        const sent = await target.session.send(step);
        if (!sent.ok) return { ok: false, phase: 'send', reason: sent.reason };
        ({ message, reply, ackMs } = sent);
      }
      if (step.endInput === true) await target.session.endInput();
    } catch (error) {
      return { ok: false, phase: 'send', reason: messageOf(error) };
    }
    const product: StepProduct = { kind: 'message', message, ...(reply !== undefined ? { reply } : {}) };
    const captured = capture(step, reply ?? message);
    if (!captured.ok) return { ...captured, product };
    return {
      ok: true,
      captures: captured.captures,
      settlement: {
        state: 'sent',
        ...(ackMs !== undefined ? { ackMs } : {}),
        captureNames: step.captures.map((each) => each.name),
      },
      product,
    };
  };

  const expect = async (step: ExpectWorkflowStep): Promise<SessionStepOutcome> => {
    const fail = (reason: string, window?: WindowEntry[]): SessionStepOutcome => ({
      ok: false,
      phase: 'expect',
      reason,
      ...(window !== undefined ? { product: { kind: 'message', message: null, window } } : {}),
    });
    const window = armed.get(step.id);
    if (window === undefined) return fail(unarmed.get(step.id) ?? `Its trigger "${step.after}" did not start.`);
    const hold = holdOf(step.on);
    let criteria: Criterion[];
    try {
      criteria = await resolveCriteria(step.match, resolveText);
    } catch (error) {
      return fail(messageOf(error));
    }

    const where = window.address === null ? '' : ` on ${window.address}`;
    const deadlineAt = window.startedAt + step.timeoutMs;
    const seen: WindowEntry[] = [];
    let cursor = 0;
    for (;;) {
      const read = hold.read(step.id, cursor);
      cursor = read.cursor;
      for (const message of read.messages) {
        if (message.stored && step.includeStored !== true) {
          seen.push({ message, outcome: 'stored' });
          continue;
        }
        if (!judgeCriteria(criteria, subjectOfMessage(message)).ok) {
          seen.push({ message, outcome: 'not-matched' });
          continue;
        }
        seen.push({ message, outcome: 'matched' });
        const product: StepProduct = { kind: 'message', message, window: seen };
        const captured = capture(step, message);
        if (!captured.ok) return { ...captured, product };
        return {
          ok: true,
          captures: captured.captures,
          settlement: {
            state: 'matched',
            afterMs: message.at - window.startedAt,
            captureNames: step.captures.map((each) => each.name),
          },
          product,
        };
      }
      if (hold.filled !== null) {
        const limit =
          hold.filled === 'messages'
            ? `${RUN_WINDOW_MAX_MESSAGES.toLocaleString('en-US')} messages`
            : `${RUN_WINDOW_MAX_BYTES / (1024 * 1024)} MB of messages`;
        return fail(`The run held ${limit} before a match${where}.`, seen);
      }
      if (hold.ended !== null) return fail(`The session of "${step.on}" ended before a match: ${hold.ended}`, seen);
      const remaining = deadlineAt - now();
      if (remaining <= 0) {
        const missed = seen.filter((entry) => entry.outcome === 'not-matched').length;
        const arrived = missed === 0 ? '' : `; ${missed} arrived and did not match`;
        return fail(
          `No message${where} matched within ${formatWait(step.timeoutMs)} of "${step.after}" starting${arrived}.`,
          seen,
        );
      }
      await within(remaining, hold.changed());
    }
  };

  return {
    async armTriggeredBy(trigger) {
      for (const step of expects) {
        if (step.after !== trigger.id) continue;
        const listening = open.get(step.on);
        // A window on a session that is neither open nor about to be has nothing to hold.
        if (listening === undefined && step.on !== trigger.id) continue;
        let address: string | null = null;
        try {
          if (step.address !== undefined) address = await resolveText(step.address);
        } catch (error) {
          unarmed.set(step.id, messageOf(error));
          continue;
        }
        holdOf(step.on).arm(step.id, { from: listening === undefined ? 0 : listening.session.position(), address });
        armed.set(step.id, { startedAt: now(), address });
      }
    },
    triggerLeft(trigger) {
      for (const step of expects) {
        if (step.after !== trigger.id) continue;
        const window = armed.get(step.id);
        const listening = open.get(step.on);
        if (window === undefined || listening === undefined) continue;
        holdOf(step.on).arm(step.id, { from: listening.session.position(), address: window.address });
        armed.set(step.id, { startedAt: now(), address: window.address });
      }
    },
    run(step) {
      switch (step.action) {
        case 'listen':
          return listen(step);
        case 'send':
          return send(step);
        case 'expect':
          return expect(step);
      }
    },
    async close() {
      const closes: SessionClose[] = [];
      for (const [stepId, { session, readyAt }] of [...open].reverse()) {
        const ending = session.end().catch((error: unknown) => ({ warning: messageOf(error) }));
        const ended = await within(SESSION_CLOSE_DEADLINE_MS, ending);
        const warning = ended.inTime
          ? ended.value.warning
          : `Not closed within ${formatWait(SESSION_CLOSE_DEADLINE_MS)}.`;
        closes.push({ stepId, openForMs: now() - readyAt, ...(warning !== undefined ? { warning } : {}) });
      }
      open.clear();
      return closes;
    },
  };
}

/** Read a step's captures off a message as they are read off a response. */
function capture(
  step: SendWorkflowStep | ExpectWorkflowStep,
  message: SessionMessage | null,
):
  | { ok: true; captures: Map<string, string> }
  | {
      ok: false;
      phase: 'extract';
      reason: string;
      extractorFailure: { captureName: string; kind: string; message: string };
    } {
  const captures = new Map<string, string>();
  const subject = message === null ? { headers: [], body: '' } : subjectOfMessage(message);
  for (const each of step.captures) {
    const result = applyExtractor(each.extractor, subject);
    if (!result.ok) {
      return {
        ok: false,
        phase: 'extract',
        reason: `Capture "${each.name}" (${each.extractor.kind}): ${result.message}`,
        extractorFailure: { captureName: each.name, kind: result.kind, message: result.message },
      };
    }
    captures.set(each.name, result.value);
  }
  return { ok: true, captures };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A wait in the unit a person set it in: `500 ms`, `10 s`. */
export function formatWait(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${ms / 1000} s`;
}
