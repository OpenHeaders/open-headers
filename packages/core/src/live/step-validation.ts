/**
 * Pure validators for a Live Workflow's structural invariants.
 *
 * Covers two distinct checks the editor + save path must run:
 *
 *   1. {@link validateWorkflowShape} — local invariants that don't
 *      touch any other entity. Unique step ids, unique capture names
 *      within a step, valid `expires-in` / `expires-at` references
 *      into the workflow's own steps, Phase I `dependsOn` / `runIf` /
 *      `priorityFrom` references resolve within the workflow + obey
 *      graph reachability, `parallelExecution` not set to the
 *      unimplemented v1 value. Runs before `v.parse` passes (the
 *      schema enforces identifier shapes; this enforces the
 *      relational invariants a discriminated union can't).
 *
 *   2. {@link validateStepReferences} — cross-request invariants.
 *      A step's request templates can only reference `{{step.X.Y}}`
 *      where `X` is a TRANSITIVE DEPENDSON ANCESTOR of the
 *      referencing step AND `Y` is a capture declared on that step.
 *      Runs at save time against the current request registry.
 *      (Phase I changed "earlier in declared list" to "reachable via
 *      dependsOn graph"; backwards compatible because a step with
 *      no explicit dependsOn implicitly depends on the previous
 *      declared step — so linear chains still work.)
 *
 * Both return `StructuralError[]` — empty means valid. Never throw.
 */

import type { LiveWorkflow, WorkflowStep } from '../types/live';
import type { RequestIncompleteReason } from '../utils/request-validation';
import { effectiveDependsOn } from './chain-runner';
import { scanTemplateReferences } from './template-scan';

// ── Error shape ────────────────────────────────────────────────────

export type StructuralIssue =
  | 'duplicate-step-id'
  | 'duplicate-capture-name'
  | 'refresh-unknown-step'
  | 'refresh-unknown-capture'
  | 'step-forward-reference'
  | 'step-unknown-step-id'
  | 'step-unknown-capture'
  | 'step-request-missing'
  | 'step-request-incomplete'
  // ── Phase I — DAG + runIf + priorityFrom ─────────────────────
  | 'step-unknown-dep'
  | 'depends-on-cycle'
  | 'no-root-step'
  | 'gate-unknown-stepid'
  | 'gate-unreachable-stepid'
  | 'gate-unknown-capture'
  | 'gate-invalid-regex'
  | 'priority-unknown-stepid'
  | 'priority-unreachable-stepid'
  | 'priority-unknown-capture'
  | 'step-template-unreachable-stepid'
  | 'parallel-not-yet-implemented';

export interface StructuralError {
  issue: StructuralIssue;
  /** Step owning the error when relevant; null for workflow-level errors. */
  stepId: string | null;
  /** Referenced step id (e.g. the target of a forward ref). */
  referencedStepId?: string;
  /** Referenced capture name when relevant. */
  referencedCaptureName?: string;
  /**
   * Sub-reason for `step-request-incomplete` errors — lets the UI pick
   * a specific hint ("Set a URL" vs "Set a username" etc.).
   */
  incompleteReason?: RequestIncompleteReason;
  /** Human-readable message; used for structured error surfacing in UI. */
  message: string;
}

// ── Workflow-shape validator ──────────────────────────────────────

export function validateWorkflowShape(workflow: LiveWorkflow): StructuralError[] {
  const errors: StructuralError[] = [];
  const seenStepIds = new Set<string>();
  const knownStepIds = new Set(workflow.steps.map((s) => s.id));
  const captureIndex = new Map<string, Set<string>>();
  workflow.steps.forEach((s) => {
    captureIndex.set(s.id, new Set(s.captures.map((c) => c.name)));
  });

  for (const step of workflow.steps) {
    if (seenStepIds.has(step.id)) {
      errors.push({
        issue: 'duplicate-step-id',
        stepId: step.id,
        message: `Duplicate step id "${step.id}" in workflow "${workflow.name}".`,
      });
    }
    seenStepIds.add(step.id);

    const seenCaptures = new Set<string>();
    for (const capture of step.captures) {
      if (seenCaptures.has(capture.name)) {
        errors.push({
          issue: 'duplicate-capture-name',
          stepId: step.id,
          referencedCaptureName: capture.name,
          message: `Duplicate capture name "${capture.name}" in step "${step.id}".`,
        });
      }
      seenCaptures.add(capture.name);
    }
  }

  // Validate refresh-policy step / capture references.
  const policy = workflow.refresh;
  if (policy.kind === 'expires-in' || policy.kind === 'expires-at') {
    const step = workflow.steps.find((s) => s.id === policy.stepId);
    if (!step) {
      errors.push({
        issue: 'refresh-unknown-step',
        stepId: null,
        referencedStepId: policy.stepId,
        message: `Refresh policy references unknown step "${policy.stepId}".`,
      });
    } else if (!step.captures.some((c) => c.name === policy.captureName)) {
      errors.push({
        issue: 'refresh-unknown-capture',
        stepId: policy.stepId,
        referencedStepId: policy.stepId,
        referencedCaptureName: policy.captureName,
        message: `Refresh policy references capture "${policy.captureName}" on step "${policy.stepId}", which has no such capture.`,
      });
    }
  }

  // ── Phase I — parallelExecution reserved for a future release ──
  if (workflow.parallelExecution === true) {
    errors.push({
      issue: 'parallel-not-yet-implemented',
      stepId: null,
      message:
        'parallelExecution is reserved for a future release. Remove the flag or set it to false; execution is sequential in v1.',
    });
  }

  // ── Phase I — dependsOn validation (explicit references) ──────
  for (const step of workflow.steps) {
    if (step.dependsOn === undefined) continue; // implicit = prior step, handled elsewhere
    for (const depId of step.dependsOn) {
      if (!knownStepIds.has(depId)) {
        errors.push({
          issue: 'step-unknown-dep',
          stepId: step.id,
          referencedStepId: depId,
          message: `Step "${step.id}" depends on unknown step "${depId}".`,
        });
      }
    }
  }

  // ── Phase I — cycle detection on dependsOn (defensive duplicate of
  //                cycle-detect.ts; lets validateWorkflowShape stay
  //                self-contained without pulling in LV + requestRegistry).
  const cycles = detectDependsOnCycles(workflow);
  for (const cyclePath of cycles) {
    errors.push({
      issue: 'depends-on-cycle',
      stepId: cyclePath[0],
      message: `dependsOn cycle detected: ${cyclePath.join(' → ')}.`,
    });
  }

  // If the graph has cycles, reachability is not meaningful — skip the
  // remaining gate/priority/root checks to avoid cascading noise.
  if (cycles.length > 0) return errors;

  // ── Phase I — at least one root step must exist ───────────────
  const hasRoot = workflow.steps.some((step, i) => effectiveDependsOn(step, i, workflow).length === 0);
  if (!hasRoot) {
    errors.push({
      issue: 'no-root-step',
      stepId: null,
      message: 'Workflow has no root step (every step declares a non-empty dependsOn). Add a root or remove a dep.',
    });
  }

  // ── Phase I — reachability precompute for gate + priority checks ──
  const ancestors = computeTransitiveAncestors(workflow);

  // ── Phase I — runIf clause validation ─────────────────────────
  for (const step of workflow.steps) {
    const gate = step.runIf;
    if (!gate) continue;
    for (const clause of gate.all) {
      // stepId must exist in the workflow
      if (!knownStepIds.has(clause.stepId)) {
        errors.push({
          issue: 'gate-unknown-stepid',
          stepId: step.id,
          referencedStepId: clause.stepId,
          message: `Step "${step.id}" gate references unknown step "${clause.stepId}".`,
        });
        continue;
      }
      // stepId must be a transitive ancestor
      const reachable = ancestors.get(step.id) ?? new Set<string>();
      if (!reachable.has(clause.stepId)) {
        errors.push({
          issue: 'gate-unreachable-stepid',
          stepId: step.id,
          referencedStepId: clause.stepId,
          message: `Step "${step.id}" gate references "${clause.stepId}", which isn't in its dependency chain. Add "${clause.stepId}" (or an ancestor of it) to dependsOn.`,
        });
        continue;
      }
      // capture name (for capture-* clauses) must exist on the target step
      if (clause.kind !== 'status') {
        const caps = captureIndex.get(clause.stepId);
        if (caps && !caps.has(clause.captureName)) {
          errors.push({
            issue: 'gate-unknown-capture',
            stepId: step.id,
            referencedStepId: clause.stepId,
            referencedCaptureName: clause.captureName,
            message: `Step "${step.id}" gate references capture "${clause.captureName}" on step "${clause.stepId}", which has no such capture.`,
          });
        }
      }
      // capture-matches pattern must compile
      if (clause.kind === 'capture-matches') {
        try {
          new RegExp(clause.pattern);
        } catch {
          errors.push({
            issue: 'gate-invalid-regex',
            stepId: step.id,
            referencedStepId: clause.stepId,
            referencedCaptureName: clause.captureName,
            message: `Step "${step.id}" gate has an invalid regex pattern: ${clause.pattern}`,
          });
        }
      }
    }
  }

  // ── Phase I — priorityFrom validation ─────────────────────────
  for (const step of workflow.steps) {
    const ref = step.priorityFrom;
    if (!ref) continue;
    if (!knownStepIds.has(ref.stepId)) {
      errors.push({
        issue: 'priority-unknown-stepid',
        stepId: step.id,
        referencedStepId: ref.stepId,
        message: `Step "${step.id}" priorityFrom references unknown step "${ref.stepId}".`,
      });
      continue;
    }
    const reachable = ancestors.get(step.id) ?? new Set<string>();
    if (!reachable.has(ref.stepId)) {
      errors.push({
        issue: 'priority-unreachable-stepid',
        stepId: step.id,
        referencedStepId: ref.stepId,
        message: `Step "${step.id}" priorityFrom references "${ref.stepId}", which isn't in its dependency chain.`,
      });
      continue;
    }
    const caps = captureIndex.get(ref.stepId);
    if (caps && !caps.has(ref.captureName)) {
      errors.push({
        issue: 'priority-unknown-capture',
        stepId: step.id,
        referencedStepId: ref.stepId,
        referencedCaptureName: ref.captureName,
        message: `Step "${step.id}" priorityFrom references capture "${ref.captureName}" on step "${ref.stepId}", which has no such capture.`,
      });
    }
  }

  return errors;
}

// ── Phase I helpers ───────────────────────────────────────────────

/**
 * Compute transitive `dependsOn` ancestors per step. Returns a map
 * keyed by stepId → Set of ancestor stepIds. Excludes the step itself.
 * Uses BFS per step with visited-guard so cycles (if any slipped past
 * cycle-detect) don't loop forever.
 *
 * Exported so other validators + the editor's per-field preview can
 * reuse the reachability check without re-implementing it.
 */
export function computeTransitiveAncestors(workflow: LiveWorkflow): Map<string, Set<string>> {
  const byId = new Map<string, WorkflowStep>();
  const idx = new Map<string, number>();
  workflow.steps.forEach((s, i) => {
    byId.set(s.id, s);
    idx.set(s.id, i);
  });

  const result = new Map<string, Set<string>>();
  for (const step of workflow.steps) {
    const ancestors = new Set<string>();
    const queue: string[] = [step.id];
    const visited = new Set<string>([step.id]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const node = byId.get(current);
      if (!node) continue;
      const deps = effectiveDependsOn(node, idx.get(current) ?? 0, workflow);
      for (const dep of deps) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        ancestors.add(dep);
        queue.push(dep);
      }
    }
    result.set(step.id, ancestors);
  }
  return result;
}

/**
 * Detect cycles on the effective-`dependsOn` graph. Returns each cycle
 * as a path of stepIds where the first and last entries are the same
 * node (so callers can render `a → b → a` unambiguously). Empty list
 * means the graph is acyclic.
 *
 * DFS with white/grey/black coloring, O(V + E) amortized. The
 * LiveVariable-level cycle detector (`cycle-detect.ts`) walks a
 * different graph and remains a separate module; this helper is
 * scoped to one workflow's `dependsOn` edges for save-time validation.
 */
function detectDependsOnCycles(workflow: LiveWorkflow): string[][] {
  const idx = new Map<string, number>();
  workflow.steps.forEach((s, i) => {
    idx.set(s.id, i);
  });

  type Color = 'white' | 'grey' | 'black';
  const color = new Map<string, Color>();
  workflow.steps.forEach((s) => {
    color.set(s.id, 'white');
  });

  const cycles: string[][] = [];

  const dfs = (rootId: string): void => {
    const path: string[] = [rootId];
    const stack: { stepId: string; cursor: number; deps: string[] }[] = [
      {
        stepId: rootId,
        cursor: 0,
        deps: effectiveDependsOn(workflow.steps[idx.get(rootId) ?? 0], idx.get(rootId) ?? 0, workflow),
      },
    ];
    color.set(rootId, 'grey');

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.cursor >= top.deps.length) {
        color.set(top.stepId, 'black');
        stack.pop();
        path.pop();
        continue;
      }
      const next = top.deps[top.cursor];
      top.cursor += 1;
      if (!idx.has(next)) continue; // unknown dep handled by a different error
      const c = color.get(next);
      if (c === 'grey') {
        const start = path.indexOf(next);
        if (start !== -1) cycles.push([...path.slice(start), next]);
        continue;
      }
      if (c === 'white') {
        color.set(next, 'grey');
        path.push(next);
        const nextStep = workflow.steps[idx.get(next) ?? 0];
        stack.push({
          stepId: next,
          cursor: 0,
          deps: effectiveDependsOn(nextStep, idx.get(next) ?? 0, workflow),
        });
      }
    }
  };

  for (const step of workflow.steps) {
    if (color.get(step.id) === 'white') dfs(step.id);
  }

  return cycles;
}

// ── Step-request provider ─────────────────────────────────────────

/**
 * Snapshot of one persisted request, from the validator's perspective.
 *
 *   - `templates` — every string the executor would run through the
 *     variable resolver (URL, header values, param values, body
 *     content, auth fields). The validator scans these for
 *     `{{step.<id>.<capture>}}` refs.
 *   - `incompleteReason` — set when the request is missing fields
 *     the executor needs (see `isRequestComplete`). The validator
 *     surfaces it as `step-request-incomplete` so the workflow
 *     editor can badge the step.
 */
export interface StepRequestInfo {
  templates: readonly string[];
  /**
   * `null` when the request is complete. Any other value marks the
   *  step as incomplete and carries a machine-readable hint for the UI.
   */
  incompleteReason: RequestIncompleteReason | null;
}

/**
 * Function the caller provides to look up the persisted request
 * backing a step. Returning `null` means "request not found" — the
 * validator surfaces a dedicated `step-request-missing` error for the
 * step so the editor can highlight the broken link.
 *
 * The extension's adapter resolves the uid via `request-store.getRequest`,
 * runs `isRequestComplete` + `requestIncompleteReason` on the result,
 * and collects the executor-relevant template strings. Tests pass a
 * mock implementation.
 */
export type RequestInfoProvider = (requestUid: string) => StepRequestInfo | null;

/**
 * Build the `step-request-missing` error for one step. Single emitter
 * of the issue's shape + message — both {@link validateStepRequestsExist}
 * (editor-time, set-backed) and {@link validateStepReferences}
 * (save-time, provider-backed) route their missing-request reporting
 * through here so the two validators never drift.
 */
function stepRequestMissingError(step: WorkflowStep): StructuralError {
  return {
    issue: 'step-request-missing',
    stepId: step.id,
    referencedStepId: step.requestUid,
    message: `Step "${step.id}" references a request that no longer exists (uid "${step.requestUid}").`,
  };
}

/**
 * Editor-time cross-request check: does every step's `requestUid`
 * still resolve to a persisted request? A step whose backing request
 * was deleted only fails at run time today — this surfaces it as a
 * static workflow-validity error instead.
 *
 * Lighter than {@link validateStepReferences}: the caller passes a
 * plain `Set` of known request uids rather than a full
 * {@link RequestInfoProvider}, since existence is the only fact
 * needed. An empty `requestUid` is the editor's not-yet-picked
 * placeholder — skipped here (incompleteness is `isWorkflowComplete`'s
 * concern, not a "deleted request").
 *
 * The caller MUST only invoke this once the request registry has
 * hydrated; an empty `knownRequestUids` during load would false-flag
 * every step.
 */
export function validateStepRequestsExist(
  workflow: LiveWorkflow,
  knownRequestUids: ReadonlySet<string>,
): StructuralError[] {
  const errors: StructuralError[] = [];
  for (const step of workflow.steps) {
    if (step.requestUid.length === 0) continue;
    if (!knownRequestUids.has(step.requestUid)) errors.push(stepRequestMissingError(step));
  }
  return errors;
}

export function validateStepReferences(workflow: LiveWorkflow, requestInfo: RequestInfoProvider): StructuralError[] {
  const errors: StructuralError[] = [];

  // Phase I — template refs are validated against the transitive
  // `dependsOn` ancestors of the referencing step, not against
  // declared-list position. Backwards compat: a step with no
  // explicit `dependsOn` implicitly depends on the previous step
  // (`effectiveDependsOn`), so linear chains without dependsOn
  // declarations still pass validation identically to Phase A–H.
  const idToStep = new Map<string, WorkflowStep>();
  workflow.steps.forEach((s) => {
    idToStep.set(s.id, s);
  });
  const ancestors = computeTransitiveAncestors(workflow);

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const info = requestInfo(step.requestUid);
    if (info == null) {
      errors.push(stepRequestMissingError(step));
      continue;
    }

    // Request-completeness check — mirrors `isRuleComplete` in
    // role-and-discipline. Incomplete requests can't be executed as
    // workflow steps; the editor should badge them red until fixed.
    if (info.incompleteReason) {
      errors.push({
        issue: 'step-request-incomplete',
        stepId: step.id,
        referencedStepId: step.requestUid,
        incompleteReason: info.incompleteReason,
        message: `Step "${step.id}" points at an incomplete request (${info.incompleteReason}). Fix the request before this workflow can run.`,
      });
      // Continue cross-request template scanning — missing URL doesn't
      // block us from surfacing an unrelated forward-reference error,
      // and the editor benefits from seeing every problem at once.
    }

    if (info.templates.length === 0) continue;

    const reachable = ancestors.get(step.id) ?? new Set<string>();

    for (const template of info.templates) {
      const refs = scanTemplateReferences(template).step;
      for (const ref of refs) {
        const target = idToStep.get(ref.stepId);
        if (!target) {
          errors.push({
            issue: 'step-unknown-step-id',
            stepId: step.id,
            referencedStepId: ref.stepId,
            referencedCaptureName: ref.captureName,
            message: `Step "${step.id}" references unknown stepId "${ref.stepId}".`,
          });
          continue;
        }
        if (!reachable.has(ref.stepId)) {
          errors.push({
            issue: 'step-template-unreachable-stepid',
            stepId: step.id,
            referencedStepId: ref.stepId,
            referencedCaptureName: ref.captureName,
            message: `Step "${step.id}" template references "${ref.stepId}", which isn't in its dependency chain. Add "${ref.stepId}" (or an ancestor of it) to dependsOn.`,
          });
          continue;
        }
        if (!target.captures.some((c) => c.name === ref.captureName)) {
          errors.push({
            issue: 'step-unknown-capture',
            stepId: step.id,
            referencedStepId: ref.stepId,
            referencedCaptureName: ref.captureName,
            message: `Step "${step.id}" references capture "${ref.captureName}" on step "${ref.stepId}", which has no such capture.`,
          });
        }
      }
    }
  }

  return errors;
}
