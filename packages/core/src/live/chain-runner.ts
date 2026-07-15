/**
 * Pure chain execution engine for Live Workflows.
 *
 * Phase I — DAG walker. The workflow's steps form a directed graph via
 * optional `dependsOn` edges. On each loop pass the runner:
 *
 *   1. Collects the ready set (steps whose `dependsOn` ancestors are
 *      all `complete` OR `skipped`).
 *   2. Evaluates each ready step's optional `runIf` gate against the
 *      in-memory capture + status maps. Failing gates mark the step
 *      `skipped` (no cache write) and loop.
 *   3. Sorts the eligible set (gate passed) by `priorityFrom` value,
 *      breaking ties with declared-list position.
 *   4. Executes the first eligible step via the `FetchAdapter` (under
 *      its optional per-step retry policy), extracts its captures,
 *      records status + byte count, loops.
 *
 * Atomic refresh discipline (locked decision #14 + Phase I locked
 * decision #3): any step's fetch or extraction failure aborts the
 * whole run — zero captures written. A *skipped* step is NOT a
 * partial write; it's an explicit non-update. Skipped steps are
 * reported via `skippedStepIds` so the adapter's cache-write path
 * can leave those entries untouched while committing the successful
 * ones atomically.
 *
 * Backwards compatibility with Phase A–H linear workflows:
 *   - A step with `dependsOn` undefined implicitly depends on the
 *     PREVIOUS step in declared order (the first step is still a
 *     root). Existing fixtures round-trip + execute identically.
 *   - A step with `dependsOn: []` (explicit empty array) is a root
 *     step — used when power users want multiple independent roots.
 *   - Sequential execution: one step runs at a time even when the
 *     ready-set has multiple eligible members. Parallel execution is
 *     a future feature; the workflow-level `parallelExecution` flag
 *     is validated as "coming soon" today.
 *
 * The runner is platform-agnostic — it takes a `FetchAdapter` that
 * the host (extension SW, tests with a mock) provides. The adapter is
 * the ONLY place that knows about:
 *   - the actual request executor (variable resolution, auth, etc.)
 *   - DNR bypass header stamping
 *   - cookie-jar continuity between steps
 *
 * The core runner only orchestrates: build context → ask adapter to
 * fetch → apply extractors → advance.
 */

import { DEFAULT_RETRY_DELAY_MS } from '../schemas/live';
import type { LiveWorkflow, StepRetryPolicy, WorkflowStep } from '../types/live';
import { applyExtractor, type StepResponse } from './extractor';
import { evaluateGate, matchStatus } from './gate-evaluator';
import { comparePriority, priorityValue } from './priority-evaluator';

// ── Fetch adapter contract ────────────────────────────────────────

export interface ChainExecutionContext {
  workflowUid: string;
  workspaceId: string;
  environmentId: string | null;
}

export interface FetchAdapter {
  /**
   * Execute one step's request with the running chain's captures
   * installed as the `{{step.<id>.<name>}}` resolution context.
   *
   * The adapter MUST:
   *   - install the step-capture context on the variable resolver so
   *     this step's templates see captures from prior steps.
   *   - tag the outgoing request with the DNR-bypass header so rules
   *     referencing this workflow's LVs don't match their own source.
   *   - clear the step-capture context before returning (chain
   *     completion is not this adapter's concern, but step boundaries
   *     are).
   *
   * Thrown errors bubble as a step failure with the error's message.
   */
  executeStep(
    step: WorkflowStep,
    stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
    context: ChainExecutionContext,
  ): Promise<StepResponse>;
}

// ── Outcome shape ─────────────────────────────────────────────────

export interface ChainRunSuccess {
  ok: true;
  /** `stepId → captureName → extractedValue` across all COMPLETED steps. */
  stepCaptures: Map<string, Map<string, string>>;
  /** Per-step response body byte count for completed steps (observability). */
  stepResponseBytes: Map<string, number>;
  /** Per-step HTTP status for completed steps (observability + gate re-check if needed). */
  stepStatuses: Map<string, number>;
  /**
   * Phase I — stepIds of gate-skipped steps. Not in `stepCaptures`
   * (skipped = no write). Adapters leave skipped-step cache entries
   * untouched so prior-run values remain resolvable.
   */
  skippedStepIds: string[];
  /**
   * Attempts each completed step took (1 = first try succeeded).
   * Observability — lets the log show "recovered on attempt 2 of 3".
   */
  stepAttempts: Map<string, number>;
  /** Wall-clock ms when the chain finished resolving the last step. */
  completedAt: number;
}

export interface ChainRunFailure {
  ok: false;
  /** `stepId` where execution halted. */
  failedStepId: string;
  /** Which phase broke — helpful for the observability log's `errorClass`. */
  failedPhase: 'fetch' | 'extract' | 'graph';
  /** Human-readable failure message. */
  failedReason: string;
  /** Attempts the failing step made (present on `fetch` failures when a
   *  retry policy was exhausted; 1 without a policy). */
  attemptsMade?: number;
  /** Extractor failure detail when `failedPhase === 'extract'`. */
  extractorFailure?: {
    captureName: string;
    kind: string;
    message: string;
  };
  /**
   * Captures from previous steps that succeeded up to (but excluding)
   * the failure. Not written to cache — atomic refresh means we
   * preserve the last-good cache. Exposed here so the observability
   * log can carry "we got past step A + B, died on C" context.
   */
  partialStepCaptures: Map<string, Map<string, string>>;
  partialStepResponseBytes: Map<string, number>;
  partialStepStatuses: Map<string, number>;
  /** Phase I — steps skipped before the failure. Observability only. */
  skippedStepIds: string[];
}

export type ChainRunOutcome = ChainRunSuccess | ChainRunFailure;

// ── Internal state ────────────────────────────────────────────────

type StepState = 'pending' | 'complete' | 'skipped' | 'failed';

/**
 * Resolve a step's effective `dependsOn` list. Absent = implicit
 * prior-step dep (backwards compat with linear chains); empty array =
 * explicit root; populated = explicit DAG edges.
 */
export function effectiveDependsOn(step: WorkflowStep, declaredIndex: number, workflow: LiveWorkflow): string[] {
  if (step.dependsOn !== undefined) return step.dependsOn;
  // Implicit: depend on the previous step in declared order.
  if (declaredIndex === 0) return [];
  return [workflow.steps[declaredIndex - 1].id];
}

// ── runChain ──────────────────────────────────────────────────────

export async function runChain(args: {
  workflow: LiveWorkflow;
  adapter: FetchAdapter;
  context: ChainExecutionContext;
  /** Injectable clock — defaults to `Date.now`. Tests override. */
  now?: () => number;
  /** Injectable retry-delay wait — defaults to `setTimeout`. Tests override. */
  sleep?: (ms: number) => Promise<void>;
}): Promise<ChainRunOutcome> {
  const {
    workflow,
    adapter,
    context,
    now = () => Date.now(),
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = args;

  const stepCaptures = new Map<string, Map<string, string>>();
  const stepResponseBytes = new Map<string, number>();
  const stepStatuses = new Map<string, number>();
  const stepAttempts = new Map<string, number>();
  const state = new Map<string, StepState>();
  const skippedStepIds: string[] = [];

  // Index steps by id for O(1) lookup; cache declared position for
  // priority-tiebreak + effectiveDependsOn computation.
  const declaredIndex = new Map<string, number>();
  workflow.steps.forEach((step, i) => {
    declaredIndex.set(step.id, i);
    state.set(step.id, 'pending');
  });

  // Pre-compute effective deps per step so the main loop is tight.
  const deps = new Map<string, string[]>();
  workflow.steps.forEach((step, i) => {
    deps.set(step.id, effectiveDependsOn(step, i, workflow));
  });

  // Main loop. Terminates when every step has a terminal state.
  while (Array.from(state.values()).some((s) => s === 'pending')) {
    // Ready set = pending steps whose deps are all {complete, skipped}.
    // Failed deps would have aborted the run already, so we only check
    // for terminal-non-failed states here.
    const ready: WorkflowStep[] = [];
    for (const step of workflow.steps) {
      if (state.get(step.id) !== 'pending') continue;
      const stepDeps = deps.get(step.id) ?? [];
      const allResolved = stepDeps.every((dep) => {
        const s = state.get(dep);
        return s === 'complete' || s === 'skipped';
      });
      if (allResolved) ready.push(step);
    }

    if (ready.length === 0) {
      // Defensive — save-time cycle + unknown-dep validation should
      // have caught this. If we land here at runtime, it means the
      // graph has an unresolvable dep (cycle or reference to a
      // non-existent step). Fail fast with a structured error.
      const stranded = workflow.steps.filter((s) => state.get(s.id) === 'pending').map((s) => s.id);
      return {
        ok: false,
        failedStepId: stranded[0] ?? '',
        failedPhase: 'graph',
        failedReason: `Orphaned pending steps with unresolvable dependsOn: ${stranded.join(', ')}. Likely a cycle or unknown stepId.`,
        partialStepCaptures: stepCaptures,
        partialStepResponseBytes: stepResponseBytes,
        partialStepStatuses: stepStatuses,
        skippedStepIds,
      };
    }

    // Evaluate gates; split ready into skipped + eligible.
    const eligible: WorkflowStep[] = [];
    for (const step of ready) {
      const gate = step.runIf;
      const passes = gate === undefined || evaluateGate(gate, stepCaptures, stepStatuses);
      if (!passes) {
        state.set(step.id, 'skipped');
        skippedStepIds.push(step.id);
        continue;
      }
      eligible.push(step);
    }

    if (eligible.length === 0) {
      // All newly-ready steps got skipped. Loop — newly-skipped steps
      // may have unblocked others (their descendants with runIf that
      // guard against the skipped ancestor's absence can now evaluate).
      continue;
    }

    // Sort eligible by priority value (ascending) + declared index.
    const sortKeys = eligible.map((step) => ({
      step,
      value: priorityValue(step, stepCaptures),
      declaredIndex: declaredIndex.get(step.id) ?? 0,
    }));
    sortKeys.sort(comparePriority);

    // Execute the first eligible step — retrying per its policy.
    const step = sortKeys[0].step;
    const attempt = await executeStepWithRetry(step, adapter, stepCaptures, context, sleep);
    if (!attempt.ok) {
      state.set(step.id, 'failed');
      return {
        ok: false,
        failedStepId: step.id,
        failedPhase: 'fetch',
        failedReason: attempt.reason,
        attemptsMade: attempt.attempts,
        partialStepCaptures: stepCaptures,
        partialStepResponseBytes: stepResponseBytes,
        partialStepStatuses: stepStatuses,
        skippedStepIds,
      };
    }
    const response = attempt.response;
    stepAttempts.set(step.id, attempt.attempts);

    // Record byte count — the adapter's wire-exact `bodyBytes` when it
    // knows it (a base64 body re-measured through TextEncoder would
    // inflate ~4/3). Fallback stays platform-agnostic (TextEncoder is
    // on every supported runtime), approximate for multi-byte UTF-8,
    // which matches the extension's `MAX_BODY_BYTES` semantics.
    stepResponseBytes.set(step.id, response.bodyBytes ?? new TextEncoder().encode(response.body).byteLength);
    stepStatuses.set(step.id, response.status);

    // Apply this step's captures in declaration order. Any failure
    // halts the chain with atomic-refresh semantics — the cache is
    // never partially updated.
    const captures = new Map<string, string>();
    for (const capture of step.captures) {
      const result = applyExtractor(capture.extractor, response);
      if (!result.ok) {
        state.set(step.id, 'failed');
        return {
          ok: false,
          failedStepId: step.id,
          failedPhase: 'extract',
          failedReason: `Capture "${capture.name}" (${capture.extractor.kind}): ${result.message}`,
          extractorFailure: { captureName: capture.name, kind: result.kind, message: result.message },
          partialStepCaptures: stepCaptures,
          partialStepResponseBytes: stepResponseBytes,
          partialStepStatuses: stepStatuses,
          skippedStepIds,
        };
      }
      captures.set(capture.name, result.value);
    }
    stepCaptures.set(step.id, captures);
    state.set(step.id, 'complete');
  }

  return {
    ok: true,
    stepCaptures,
    stepResponseBytes,
    stepStatuses,
    skippedStepIds,
    stepAttempts,
    completedAt: now(),
  };
}

// ── Retry policy ──────────────────────────────────────────────────

type StepAttemptOutcome =
  | { ok: true; response: StepResponse; attempts: number }
  | { ok: false; reason: string; attempts: number };

/**
 * Delay before the given attempt (2-based — no delay precedes the first
 * try). `'exponential'` doubles the base per elapsed attempt:
 * base, 2×base, 4×base, … `'fixed'` (the default) repeats the base.
 *
 * Exported so the editor can preview the schedule a policy produces.
 */
export function retryDelayMs(policy: StepRetryPolicy, attempt: number): number {
  const base = policy.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  if (policy.backoff !== 'exponential') return base;
  return base * 2 ** (attempt - 2);
}

/**
 * Run one step's fetch under its retry policy. Fetch-phase throws are
 * always retried while attempts remain; a response whose status matches
 * `retryOn` is retried too — EXCEPT on the final attempt, where the
 * response is accepted as-is so status gates and extractors still see
 * the 4xx/5xx (a status match is "worth another try", not an error).
 * Extract failures never reach here — they abort in the caller.
 */
async function executeStepWithRetry(
  step: WorkflowStep,
  adapter: FetchAdapter,
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
  context: ChainExecutionContext,
  sleep: (ms: number) => Promise<void>,
): Promise<StepAttemptOutcome> {
  const policy = step.retry;
  const maxAttempts = policy?.maxAttempts ?? 1;
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1 && policy) {
      const delay = retryDelayMs(policy, attempt);
      if (delay > 0) await sleep(delay);
    }
    let response: StepResponse;
    try {
      response = await adapter.executeStep(step, stepCaptures, context);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
    if (policy?.retryOn && attempt < maxAttempts && matchStatus(response.status, policy.retryOn)) continue;
    return { ok: true, response, attempts: attempt };
  }
  return {
    ok: false,
    reason: maxAttempts > 1 ? `${lastError} (after ${maxAttempts} attempts)` : lastError,
    attempts: maxAttempts,
  };
}
