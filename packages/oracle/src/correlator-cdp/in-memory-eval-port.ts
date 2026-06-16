/**
 * In-memory double for {@link CdpEvalPort} — the host-neutral test stand-in,
 * sibling to the control-port doubles in `./in-memory-control-port`. It
 * records each isolated-world call and answers from a scripted FIFO queue, so
 * interceptor/reaction tests can drive the dynamic-body eval without a
 * `chrome.debugger` transport.
 */

import type { CdpSessionTarget } from './control-port';
import type { CdpEvalArg, CdpEvalOutcome, CdpEvalPort } from './eval-port';

/** One recorded isolated-world eval call. */
export interface RecordedEvalCall {
  readonly target: CdpSessionTarget;
  readonly frameId: string;
  readonly functionDeclaration: string;
  readonly arg: CdpEvalArg;
}

export interface InMemoryEvalPort extends CdpEvalPort {
  /** Every call in order. */
  readonly calls: readonly RecordedEvalCall[];
  /** Queue the outcome the next call resolves to (FIFO). */
  enqueue(outcome: CdpEvalOutcome): void;
}

/**
 * Create an in-memory {@link CdpEvalPort}. Each call dequeues the next
 * scripted outcome; with the queue empty it resolves to a clean `{ok:false}`,
 * modelling an unreachable world rather than hanging the request.
 */
export function createInMemoryEvalPort(): InMemoryEvalPort {
  const calls: RecordedEvalCall[] = [];
  const outcomes: CdpEvalOutcome[] = [];
  return {
    available: true,
    calls,
    enqueue(outcome: CdpEvalOutcome): void {
      outcomes.push(outcome);
    },
    async callInIsolatedWorld(
      target: CdpSessionTarget,
      frameId: string,
      functionDeclaration: string,
      arg: CdpEvalArg,
    ): Promise<CdpEvalOutcome> {
      calls.push({ target, frameId, functionDeclaration, arg });
      return outcomes.shift() ?? { ok: false, error: 'no scripted outcome' };
    },
  };
}
