/**
 * Console-REPL registration seam (JS contexts Phase D).
 *
 * The evaluator is born inside `startLifecyclePipeline()` — it closes over
 * the debugger sources and the console hub. The panel prompt writes through
 * the `consoleEval` RPC, whose handler lives in the message-handler map and
 * can't reach that closure. This module bridges them, exactly like the CDP
 * tab-pin seam: the pipeline registers the executor once it exists, and the
 * handler dispatches through {@link evalConsoleExpression}.
 */

import type { ConsoleEvalExecutor } from '../correlator-host/console-eval';

let executor: ConsoleEvalExecutor | null = null;

/** Register the pipeline's evaluator. Idempotent — a re-register (SW
 *  re-init) replaces the prior one. */
export function registerConsoleEval(next: ConsoleEvalExecutor): void {
  executor = next;
}

/**
 * Evaluate a prompt expression. `false` before the pipeline registers (a
 * host without CDP never does) — the echo entries carry the outcome, so
 * the response is only a dispatch ack.
 */
export async function evalConsoleExpression(
  tabId: number,
  contextKey: string,
  expression: string,
  userGesture: boolean,
): Promise<boolean> {
  if (!executor) return false;
  await executor.evaluate(tabId, contextKey, expression, userGesture);
  return true;
}

/**
 * Eager-evaluation preview of a prompt expression — silent, side-effect-free,
 * never recorded to the stream. `null` when there is nothing to show OR no
 * evaluator is registered (a host without CDP never registers one).
 */
export async function previewConsoleExpression(
  tabId: number,
  contextKey: string,
  expression: string,
): Promise<string | null> {
  if (!executor) return null;
  return executor.evaluatePreview(tabId, contextKey, expression);
}

/** Test-only — drop the registration so tests start from a clean seam. */
export function __resetConsoleEvalForTests(): void {
  executor = null;
}
