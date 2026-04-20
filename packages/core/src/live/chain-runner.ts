/**
 * Pure chain execution engine for Live Workflows.
 *
 * Runs the workflow's steps in declared order, builds step-local
 * capture context between hops, applies each step's extractors, and
 * returns a single atomic outcome: either all steps succeeded and the
 * full `stepCaptures` map is ready to write to cache, or some step
 * failed and nothing is written.
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

import type { LiveWorkflow, WorkflowStep } from '../types/v5/live';
import { applyExtractor, type StepResponse } from './extractor';

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
  /** `stepId → captureName → extractedValue` across ALL steps (fresh run). */
  stepCaptures: Map<string, Map<string, string>>;
  /** Per-step response body byte count, for observability only. */
  stepResponseBytes: Map<string, number>;
  /** Wall-clock ms when the chain finished extracting the last step. */
  completedAt: number;
}

export interface ChainRunFailure {
  ok: false;
  /** `stepId` where execution halted. */
  failedStepId: string;
  /** Which phase broke — helpful for the observability log's `errorClass`. */
  failedPhase: 'fetch' | 'extract';
  /** Human-readable failure message. */
  failedReason: string;
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
}

export type ChainRunOutcome = ChainRunSuccess | ChainRunFailure;

// ── runChain ──────────────────────────────────────────────────────

export async function runChain(args: {
  workflow: LiveWorkflow;
  adapter: FetchAdapter;
  context: ChainExecutionContext;
  /** Injectable clock — defaults to `Date.now`. Tests override. */
  now?: () => number;
}): Promise<ChainRunOutcome> {
  const { workflow, adapter, context, now = () => Date.now() } = args;
  const stepCaptures = new Map<string, Map<string, string>>();
  const stepResponseBytes = new Map<string, number>();

  for (const step of workflow.steps) {
    let response: StepResponse;
    try {
      response = await adapter.executeStep(step, stepCaptures, context);
    } catch (err) {
      return {
        ok: false,
        failedStepId: step.id,
        failedPhase: 'fetch',
        failedReason: err instanceof Error ? err.message : String(err),
        partialStepCaptures: stepCaptures,
        partialStepResponseBytes: stepResponseBytes,
      };
    }

    // Record byte count — platform-agnostic (TextEncoder is on every
    // supported runtime). Approximate for multi-byte UTF-8 in the
    // body, which matches the extension's `MAX_BODY_BYTES` semantics.
    stepResponseBytes.set(step.id, new TextEncoder().encode(response.body).byteLength);

    // Apply this step's captures in declaration order. Any failure
    // halts the chain with atomic-refresh semantics — the cache is
    // never partially updated.
    const captures = new Map<string, string>();
    for (const capture of step.captures) {
      const result = applyExtractor(capture.extractor, response);
      if (!result.ok) {
        return {
          ok: false,
          failedStepId: step.id,
          failedPhase: 'extract',
          failedReason: `Capture "${capture.name}" (${capture.extractor.kind}): ${result.message}`,
          extractorFailure: { captureName: capture.name, kind: result.kind, message: result.message },
          partialStepCaptures: stepCaptures,
          partialStepResponseBytes: stepResponseBytes,
        };
      }
      captures.set(capture.name, result.value);
    }
    stepCaptures.set(step.id, captures);
  }

  return { ok: true, stepCaptures, stepResponseBytes, completedAt: now() };
}
