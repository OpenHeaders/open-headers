/**
 * Pure validators for a Live Workflow's structural invariants.
 *
 * Covers two distinct checks the editor + save path must run:
 *
 *   1. {@link validateWorkflowShape} — local invariants that don't
 *      touch any other entity. Unique step ids, unique capture names
 *      within a step, valid `expires-in` / `expires-at` references
 *      into the workflow's own steps. Runs before `v.parse` passes
 *      (the schema enforces identifier shapes; this enforces the
 *      relational invariants a discriminated union can't).
 *
 *   2. {@link validateStepReferences} — cross-request invariants.
 *      A step's request templates can only reference `{{step.X.Y}}`
 *      where `X` is an EARLIER step's id AND `Y` is a capture
 *      declared on that step. Runs at save time against the current
 *      request registry.
 *
 * Both return `StructuralError[]` — empty means valid. Never throw.
 */

import type { LiveWorkflow } from '../types/v5/live';
import type { RequestIncompleteReason } from '../utils/request-validation';
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
  | 'step-request-incomplete';

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

  return errors;
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

export function validateStepReferences(workflow: LiveWorkflow, requestInfo: RequestInfoProvider): StructuralError[] {
  const errors: StructuralError[] = [];

  // Walk steps in declaration order. A step at index i can reference
  // step ids at positions 0..i-1 only. Build a map of allowed step
  // ids as we iterate so the check is O(step count × refs).
  const idToIndex = new Map<string, number>();
  workflow.steps.forEach((s, i) => {
    idToIndex.set(s.id, i);
  });

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const info = requestInfo(step.requestUid);
    if (info == null) {
      errors.push({
        issue: 'step-request-missing',
        stepId: step.id,
        referencedStepId: step.requestUid,
        message: `Step "${step.id}" references a request that no longer exists (uid "${step.requestUid}").`,
      });
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

    for (const template of info.templates) {
      const refs = scanTemplateReferences(template).step;
      for (const ref of refs) {
        const idx = idToIndex.get(ref.stepId);
        if (idx === undefined) {
          errors.push({
            issue: 'step-unknown-step-id',
            stepId: step.id,
            referencedStepId: ref.stepId,
            referencedCaptureName: ref.captureName,
            message: `Step "${step.id}" references unknown stepId "${ref.stepId}".`,
          });
        } else if (idx >= i) {
          errors.push({
            issue: 'step-forward-reference',
            stepId: step.id,
            referencedStepId: ref.stepId,
            referencedCaptureName: ref.captureName,
            message: `Step "${step.id}" (position ${i}) references step "${ref.stepId}" (position ${idx}); only earlier steps can be referenced.`,
          });
        } else {
          const referenced = workflow.steps[idx];
          if (!referenced.captures.some((c) => c.name === ref.captureName)) {
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
  }

  return errors;
}
