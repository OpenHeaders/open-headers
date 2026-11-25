/**
 * The session port (the workflow runs plan, The model — "One port for
 * all of them"): everything the runner asks of a session a `listen` step
 * opened, the same for every kind. A kind is an adapter over its
 * executor behind this port; the runner never asks which protocol a
 * session speaks.
 *
 * The port reads at the executor's capture point — every inbound
 * message, in order, as it is recorded — never the pooled display feed.
 */

import type { ListenWorkflowStep, SendWorkflowStep } from '../types/live';
import type { ChainExecutionContext } from './chain-runner';
import type { ExtractorSubject, StepResponseHeader } from './extractor';

export interface SessionMessage {
  /** Its place in the session's own message order: a whole number, never reused, rising. */
  position: number;
  /** Arrival, wall-clock ms. */
  at: number;
  /** Where it landed — a topic, an event name, an event type. `null` for a kind with one stream. */
  address: string | null;
  body: string;
  bodyEncoding?: 'base64';
  /** Its named fields, read through the `header` extractor. */
  fields: readonly StepResponseHeader[];
  /** Stored, not live: delivered from what the other side kept, not sent now. */
  stored: boolean;
}

/** A message as the extractors and the criteria read it. */
export function subjectOfMessage(message: SessionMessage): ExtractorSubject {
  return {
    headers: message.fields,
    body: message.body,
    ...(message.bodyEncoding !== undefined ? { bodyEncoding: message.bodyEncoding } : {}),
  };
}

export type SessionSendResult =
  | {
      ok: true;
      /** The message as sent — after resolution and scripts. */
      message: SessionMessage;
      /** The other side's answer to this send, where the kind has one. */
      reply?: SessionMessage;
      /** How long the other side took to acknowledge it, where the kind acknowledges. */
      ackMs?: number;
    }
  /** Refused, in words that state the condition. */
  | { ok: false; reason: string };

export interface RunSession {
  /** Where the next message will land in this session's order. */
  position(): number;
  /** Whether a message landed on an address — the runner never parses one. */
  matchesAddress(address: string, message: SessionMessage): boolean;
  send(step: SendWorkflowStep): Promise<SessionSendResult>;
  /** No more comes from this side, for a kind that has it. */
  endInput(): Promise<void>;
  /** The kind's clean close. A `warning` says what did not go cleanly. */
  end(): Promise<{ warning?: string }>;
}

export interface SessionOpening {
  /** The run's one capture map, by reference: a later send reads captures made after the open. */
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>;
  context: ChainExecutionContext;
  /** Aborted when the step's deadline passes before the session is ready. */
  signal: AbortSignal;
  /** Every inbound message, in order, from the first — before `open` answers too. */
  onMessage(message: SessionMessage): void;
  /** The session ended on its own, and why. */
  onEnded(reason: string): void;
}

export type SessionOpenResult = { ok: true; session: RunSession } | { ok: false; reason: string };

export interface SessionHost {
  /** Open a `listen` step's session. Answers when it is ready to receive, or with a refusal in words. */
  open(step: ListenWorkflowStep, opening: SessionOpening): Promise<SessionOpenResult>;
}
