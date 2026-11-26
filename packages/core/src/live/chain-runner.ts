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

import { DEFAULT_RETRY_DELAY_MS, MAX_POLL_TOTAL_MS } from '../schemas/live';
import type { ExecutedRequestSnapshot } from '../types';
import type {
  CallWorkflowStep,
  ChainWorkflow,
  Criterion,
  KnownWorkflowStep,
  LiveWorkflow,
  StepRetryPolicy,
  WorkflowStep,
} from '../types/live';
import { type CriteriaVerdict, judgeCriteria, resolveCriteria } from './criteria';
import { applyExtractor, type StepResponse } from './extractor';
import { evaluateGate, matchStatus } from './gate-evaluator';
import { comparePriority, priorityValue } from './priority-evaluator';
import type { AttemptRetryCause, SessionClose, StepFailurePhase, StepProduct, WorkflowRunEvent } from './run-events';
import { stepsThisRunCannotRun } from './run-requirements';
import type { SessionHost } from './session-port';
import { createSessionStepRunner, type SessionStepRunner } from './session-step-runner';
import { isCallStep, isKnownStep } from './step-actions';
import { UNKNOWN_STEP_PHASE } from './unknown-step';

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
   * Thrown errors bubble as a step failure with the error's message. An
   * adapter that holds the executor's record of the failed exchange
   * throws a {@link StepExecutionError} carrying it.
   *
   * An adapter behind a rate limit tells the run through `send` when the
   * call waits and when it leaves; one that tells nothing is read as
   * leaving when the step starts.
   */
  executeStep(
    step: CallWorkflowStep,
    stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
    context: ChainExecutionContext,
    send?: StepSend,
  ): Promise<StepResponse>;
}

/** One send of a call, between the run and the host's rate limit. */
export interface StepSend {
  /** A poll sends the call again, paced by its own wait: the limit does not count this start. */
  resend: boolean;
  /** The call waits on the rate limit. */
  onHeld(): void;
  /** The call leaves for the wire. */
  onLeave(): void;
}

/**
 * A step failure that keeps the executor's record of the exchange — the
 * response that did arrive, a failed assertion's rows, the script
 * console — for whoever opens the step. The run reads its message as it
 * reads any thrown error's.
 */
export class StepExecutionError extends Error {
  readonly snapshot: ExecutedRequestSnapshot;
  constructor(message: string, snapshot: ExecutedRequestSnapshot) {
    super(message);
    this.name = 'StepExecutionError';
    this.snapshot = snapshot;
  }
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
  /**
   * Which phase broke — helpful for the observability log's `errorClass`.
   * `unsupported`: the run was refused before its first step, for a step
   * this host cannot run.
   */
  failedPhase: StepFailurePhase | typeof UNKNOWN_STEP_PHASE;
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
 * explicit root; populated = explicit DAG edges. A step of an action
 * the model does not know is read as the implicit case — its own keys
 * are not ours to read.
 */
export function effectiveDependsOn(step: WorkflowStep, declaredIndex: number, workflow: LiveWorkflow): string[] {
  if (isKnownStep(step) && step.dependsOn !== undefined) return step.dependsOn;
  // Implicit: depend on the previous step in declared order.
  if (declaredIndex === 0) return [];
  return [workflow.steps[declaredIndex - 1].id];
}

// ── runChain ──────────────────────────────────────────────────────

/**
 * Resolve a template that sits outside a request — an `expect`'s
 * address, a criterion's value — with the run's captures in reach.
 */
export type TemplateResolver = (
  template: string,
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
  context: ChainExecutionContext,
) => Promise<string>;

export interface RunChainArgs {
  workflow: ChainWorkflow;
  adapter: FetchAdapter;
  context: ChainExecutionContext;
  /** Injectable clock — defaults to `Date.now`. Tests override. */
  now?: () => number;
  /** Injectable retry-delay wait — defaults to `setTimeout`. Tests override. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Step events, fired synchronously as the run goes (the workflow runs
   * plan, The Run view). Additive: the outcome is the same with or
   * without a listener, and the clock is read for an event only when
   * there is one.
   */
  onEvent?: (event: WorkflowRunEvent) => void;
  /** Opens a `listen` step's session. Absent on a host that opens none. */
  sessions?: SessionHost;
  /** Absent on a host that resolves no template outside a request. */
  resolveTemplate?: TemplateResolver;
  /**
   * Injectable deadline — settles after `ms`, and is dropped when
   * `signal` aborts first. Defaults to `setTimeout`. Tests override.
   */
  timer?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/**
 * Run a workflow's steps. A run that opened a session ends it on every
 * path, a throw out of the walk included.
 */
export async function runChain(args: RunChainArgs): Promise<ChainRunOutcome> {
  const { workflow, context, resolveTemplate, now = () => Date.now(), timer = deadlineTimer } = args;
  const stepCaptures = new Map<string, Map<string, string>>();
  const resolveText = async (template: string): Promise<string> =>
    resolveTemplate === undefined || !template.includes('{{')
      ? template
      : resolveTemplate(template, stepCaptures, context);
  const sessionSteps = createSessionStepRunner({
    workflow,
    sessions: args.sessions,
    stepCaptures,
    context,
    resolveText,
    now,
    timer,
  });
  try {
    return await walkChain({ ...args, now }, stepCaptures, resolveText, sessionSteps);
  } finally {
    await sessionSteps.close();
  }
}

function deadlineTimer(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const handle = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => clearTimeout(handle), { once: true });
  });
}

async function walkChain(
  args: RunChainArgs & { now: () => number },
  stepCaptures: Map<string, Map<string, string>>,
  resolveText: (template: string) => Promise<string>,
  sessionSteps: SessionStepRunner,
): Promise<ChainRunOutcome> {
  const {
    workflow,
    adapter,
    context,
    now,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    onEvent,
  } = args;

  const stepResponseBytes = new Map<string, number>();
  const stepStatuses = new Map<string, number>();
  const stepAttempts = new Map<string, number>();
  const state = new Map<string, StepState>();
  const skippedStepIds: string[] = [];

  const beganAt = onEvent ? now() : 0;
  onEvent?.({ type: 'begin', at: beganAt, steps: workflow.steps.map(({ id, uid }) => ({ id, uid })) });

  const refusals = stepsThisRunCannotRun(workflow, {
    opensSessions: args.sessions !== undefined,
    resolvesTemplates: args.resolveTemplate !== undefined,
  });
  if (refusals.length > 0) {
    if (onEvent) {
      for (const step of workflow.steps) {
        const refusal = refusals.find((each) => each.stepId === step.id);
        onEvent({
          type: 'step-settle',
          at: beganAt,
          stepId: step.id,
          settlement: refusal === undefined ? { state: 'not-run' } : { state: 'cannot-run', reason: refusal.reason },
        });
      }
      onEvent({ type: 'end', at: beganAt, ok: false, durationMs: 0 });
    }
    return {
      ok: false,
      failedStepId: refusals[0].stepId,
      failedPhase: UNKNOWN_STEP_PHASE,
      failedReason: refusals[0].reason,
      partialStepCaptures: stepCaptures,
      partialStepResponseBytes: stepResponseBytes,
      partialStepStatuses: stepStatuses,
      skippedStepIds,
    };
  }

  /** Close the run's events: every step still pending never ran. */
  const endEvents = (ok: boolean, sessions: SessionClose[]): void => {
    if (!onEvent) return;
    for (const pending of workflow.steps) {
      if (state.get(pending.id) !== 'pending') continue;
      onEvent({ type: 'step-settle', at: now(), stepId: pending.id, settlement: { state: 'not-run' } });
    }
    const at = now();
    onEvent({ type: 'end', at, ok, durationMs: at - beganAt, ...(sessions.length > 0 ? { sessions } : {}) });
  };

  /** End the run: its sessions first, last opened first, then its events. */
  const finish = async (ok: boolean): Promise<void> => {
    endEvents(ok, await sessionSteps.close());
  };

  const failure = (
    stepId: string,
    failedPhase: ChainRunFailure['failedPhase'],
    failedReason: string,
  ): ChainRunFailure => ({
    ok: false,
    failedStepId: stepId,
    failedPhase,
    failedReason,
    partialStepCaptures: stepCaptures,
    partialStepResponseBytes: stepResponseBytes,
    partialStepStatuses: stepStatuses,
    skippedStepIds,
  });

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
    const ready: KnownWorkflowStep[] = [];
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
      const failedReason = `Orphaned pending steps with unresolvable dependsOn: ${stranded.join(', ')}. Likely a cycle or unknown stepId.`;
      const [first] = stranded;
      if (first !== undefined) {
        state.set(first, 'failed');
        onEvent?.({
          type: 'step-settle',
          at: now(),
          stepId: first,
          settlement: { state: 'failed', phase: 'graph', reason: failedReason, attempts: 0, maxAttempts: 0 },
        });
      }
      await finish(false);
      return failure(first ?? '', 'graph', failedReason);
    }

    // Evaluate gates; split ready into skipped + eligible.
    const eligible: KnownWorkflowStep[] = [];
    for (const step of ready) {
      const gate = step.runIf;
      const passes = gate === undefined || evaluateGate(gate, stepCaptures, stepStatuses);
      if (!passes) {
        state.set(step.id, 'skipped');
        skippedStepIds.push(step.id);
        onEvent?.({ type: 'step-settle', at: now(), stepId: step.id, settlement: { state: 'skipped' } });
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

    // Execute the first eligible step. Its start opens the window of
    // every `expect` it triggers.
    const step = sortKeys[0].step;
    const stepId = step.id;
    await sessionSteps.armTriggeredBy(step);

    if (!isCallStep(step)) {
      if (onEvent) {
        const awaiting = sessionSteps.awaiting(step);
        onEvent({
          type: 'step-start',
          at: now(),
          stepId,
          maxAttempts: 1,
          ...(awaiting !== undefined ? { awaiting } : {}),
        });
      }
      const outcome = await sessionSteps.run(step);
      if (!outcome.ok) {
        state.set(stepId, 'failed');
        onEvent?.({
          type: 'step-settle',
          at: now(),
          stepId,
          settlement: { state: 'failed', phase: outcome.phase, reason: outcome.reason, attempts: 1, maxAttempts: 1 },
          ...(outcome.product !== undefined ? { product: outcome.product } : {}),
        });
        await finish(false);
        return {
          ...failure(stepId, outcome.phase, outcome.reason),
          attemptsMade: 1,
          ...(outcome.extractorFailure !== undefined ? { extractorFailure: outcome.extractorFailure } : {}),
        };
      }
      stepCaptures.set(stepId, outcome.captures);
      stepAttempts.set(stepId, 1);
      state.set(stepId, 'complete');
      onEvent?.({
        type: 'step-settle',
        at: now(),
        stepId,
        settlement: outcome.settlement,
        ...(outcome.product !== undefined ? { product: outcome.product } : {}),
      });
      continue;
    }

    // A call — retried per its policy, and under a poll sent again until
    // its success criteria hold. A poll counts its own sends; the retries
    // inside one are not attempts of the step.
    const poll = step.poll;
    const maxAttempts = poll?.maxAttempts ?? step.retry?.maxAttempts ?? 1;
    onEvent?.({ type: 'step-start', at: now(), stepId, maxAttempts });
    let criteria: Criterion[];
    try {
      criteria = await resolveCriteria(step.successCriteria ?? [], resolveText);
    } catch (err) {
      const failedReason = err instanceof Error ? err.message : String(err);
      state.set(stepId, 'failed');
      onEvent?.({
        type: 'step-settle',
        at: now(),
        stepId,
        settlement: { state: 'failed', phase: 'criteria', reason: failedReason, attempts: 0, maxAttempts },
      });
      await finish(false);
      return failure(stepId, 'criteria', failedReason);
    }
    const pollStartedAt = poll === undefined ? 0 : now();
    let sends = 0;
    let left = false;
    let held = false;
    const onHeld = (): void => {
      held = true;
      onEvent?.({ type: 'step-hold', at: now(), stepId, held: true });
    };
    const onLeave = (): void => {
      // The window of an `expect` this call triggers opens at its first send.
      if (!left) sessionSteps.triggerLeft(step);
      left = true;
      if (held) onEvent?.({ type: 'step-hold', at: now(), stepId, held: false });
      held = false;
    };
    let attempt: StepAttemptOutcome;
    let verdict: CriteriaVerdict = { ok: true };
    for (;;) {
      sends += 1;
      attempt = await executeStepWithRetry(
        step,
        adapter,
        stepCaptures,
        context,
        { resend: sends > 1, onHeld, onLeave },
        sleep,
        onEvent && poll === undefined
          ? (ended, cause, retryInMs) =>
              onEvent({ type: 'attempt-end', at: now(), stepId, attempt: ended, maxAttempts, cause, retryInMs })
          : undefined,
      );
      if (!attempt.ok) break;
      verdict = judgeCriteria(criteria, attempt.response);
      if (verdict.ok || poll === undefined || sends >= poll.maxAttempts) break;
      if (now() - pollStartedAt + poll.delayMs > MAX_POLL_TOTAL_MS) break;
      onEvent?.({
        type: 'attempt-end',
        at: now(),
        stepId,
        attempt: sends,
        maxAttempts,
        cause: { kind: 'criteria', message: verdict.reason },
        retryInMs: poll.delayMs,
      });
      await sleep(poll.delayMs);
    }
    const attempts = poll === undefined ? attempt.attempts : sends;
    if (!attempt.ok) {
      state.set(step.id, 'failed');
      const failed = attempt.snapshot;
      onEvent?.({
        type: 'step-settle',
        at: now(),
        stepId,
        settlement: {
          state: 'failed',
          phase: 'fetch',
          reason: attempt.reason,
          attempts,
          maxAttempts,
          ...(failed !== undefined && failed.status > 0
            ? { status: failed.status, durationMs: failed.durationMs }
            : {}),
        },
        ...productOf(failed),
      });
      await finish(false);
      return { ...failure(step.id, 'fetch', attempt.reason), attemptsMade: attempts };
    }
    const response = attempt.response;
    if (!verdict.ok) {
      state.set(step.id, 'failed');
      const failedReason = poll === undefined ? verdict.reason : `${verdict.reason} (after ${sends} attempts)`;
      onEvent?.({
        type: 'step-settle',
        at: now(),
        stepId,
        settlement: {
          state: 'failed',
          phase: 'criteria',
          reason: failedReason,
          attempts,
          maxAttempts,
          status: response.status,
          ...durationOf(response.snapshot),
        },
        ...productOf(response.snapshot),
      });
      await finish(false);
      return { ...failure(step.id, 'criteria', failedReason), attemptsMade: attempts };
    }
    stepAttempts.set(step.id, attempts);

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
        const failedReason = `Capture "${capture.name}" (${capture.extractor.kind}): ${result.message}`;
        onEvent?.({
          type: 'step-settle',
          at: now(),
          stepId,
          settlement: {
            state: 'failed',
            phase: 'extract',
            reason: failedReason,
            attempts,
            maxAttempts,
            status: response.status,
            ...durationOf(response.snapshot),
          },
          ...productOf(response.snapshot),
        });
        await finish(false);
        return {
          ...failure(step.id, 'extract', failedReason),
          extractorFailure: { captureName: capture.name, kind: result.kind, message: result.message },
        };
      }
      captures.set(capture.name, result.value);
    }
    stepCaptures.set(step.id, captures);
    state.set(step.id, 'complete');
    onEvent?.({
      type: 'step-settle',
      at: now(),
      stepId,
      settlement: {
        state: 'passed',
        status: response.status,
        ...durationOf(response.snapshot),
        responseBytes: stepResponseBytes.get(step.id) ?? 0,
        attempts,
        maxAttempts,
        captureNames: step.captures.map((capture) => capture.name),
      },
      ...productOf(response.snapshot),
    });
  }

  await finish(true);
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
  | { ok: false; reason: string; attempts: number; snapshot?: ExecutedRequestSnapshot };

function productOf(snapshot: ExecutedRequestSnapshot | undefined): { product?: StepProduct } {
  return snapshot === undefined ? {} : { product: { kind: 'response', snapshot } };
}

function durationOf(snapshot: ExecutedRequestSnapshot | undefined): { durationMs?: number } {
  return snapshot === undefined ? {} : { durationMs: snapshot.durationMs };
}

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
  step: CallWorkflowStep,
  adapter: FetchAdapter,
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
  context: ChainExecutionContext,
  send: StepSend,
  sleep: (ms: number) => Promise<void>,
  onRetry: ((attempt: number, cause: AttemptRetryCause, retryInMs: number) => void) | undefined,
): Promise<StepAttemptOutcome> {
  const policy = step.retry;
  const maxAttempts = policy?.maxAttempts ?? 1;
  let lastError = '';
  let lastSnapshot: ExecutedRequestSnapshot | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1 && policy) {
      const delay = retryDelayMs(policy, attempt);
      if (delay > 0) await sleep(delay);
    }
    let response: StepResponse;
    try {
      // A retry is a start like any other: only a poll's own re-send goes uncounted.
      response = await adapter.executeStep(step, stepCaptures, context, {
        ...send,
        resend: send.resend && attempt === 1,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastSnapshot = err instanceof StepExecutionError ? err.snapshot : undefined;
      if (policy && attempt < maxAttempts) {
        onRetry?.(attempt, { kind: 'error', message: lastError }, retryDelayMs(policy, attempt + 1));
      }
      continue;
    }
    if (policy?.retryOn && attempt < maxAttempts && matchStatus(response.status, policy.retryOn)) {
      onRetry?.(attempt, { kind: 'status', status: response.status }, retryDelayMs(policy, attempt + 1));
      continue;
    }
    return { ok: true, response, attempts: attempt };
  }
  return {
    ok: false,
    reason: maxAttempts > 1 ? `${lastError} (after ${maxAttempts} attempts)` : lastError,
    attempts: maxAttempts,
    ...(lastSnapshot !== undefined ? { snapshot: lastSnapshot } : {}),
  };
}
