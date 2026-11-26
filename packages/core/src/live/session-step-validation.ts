/**
 * Pure validator for a workflow's session steps (the workflow runs plan,
 * The model): what a `listen`, a `send` and an `expect` must hold for the
 * run to mean what it says.
 *
 *   - A `send` and an `expect` name a `listen` that completes before them.
 *   - An `expect` names its trigger, starts after it, and its `listen` is
 *     ready before the trigger can start — arming is a property of the
 *     steps, never a delay.
 *   - An `expect`'s address is fixed when its trigger starts, so it reads
 *     no capture from the trigger or later.
 *   - A session step has no status: nothing reads one from it.
 *   - A workflow with a session step is manual.
 *
 * Returns `StructuralError[]` — empty means valid. Never throws. A
 * workflow with no session step answers empty.
 */

import type {
  Capture,
  Criterion,
  ExpectWorkflowStep,
  LiveWorkflow,
  SessionWorkflowStep,
  WorkflowStep,
} from '../types/live';
import { isKnownStep, isListenStep, isSessionStep } from './step-actions';
import { computeTransitiveAncestors, criterionPatternErrors, type StructuralError } from './step-validation';
import { scanTemplateReferences } from './template-scan';

export function validateSessionSteps(workflow: LiveWorkflow): StructuralError[] {
  const sessionSteps = workflow.steps.filter(isSessionStep);
  if (sessionSteps.length === 0) return [];

  const errors: StructuralError[] = [];
  const byId = new Map<string, WorkflowStep>();
  for (const step of workflow.steps) byId.set(step.id, step);
  const ancestors = computeTransitiveAncestors(workflow);
  const ancestorsOf = (stepId: string): ReadonlySet<string> => ancestors.get(stepId) ?? new Set<string>();

  if (workflow.refresh.kind !== 'manual') {
    errors.push({
      issue: 'session-refresh-not-manual',
      stepId: null,
      message: `A workflow with a session step is refreshed by hand; this one's refresh policy is "${workflow.refresh.kind}".`,
    });
  }

  for (const step of workflow.steps) {
    if (!isKnownStep(step) || step.runIf === undefined) continue;
    for (const clause of step.runIf.all) {
      if (clause.kind !== 'status') continue;
      const target = byId.get(clause.stepId);
      if (target === undefined || !isSessionStep(target)) continue;
      errors.push({
        issue: 'session-step-status-read',
        stepId: step.id,
        referencedStepId: clause.stepId,
        message: `Step "${step.id}" gate reads the status of "${clause.stepId}", and a ${target.action} step has none.`,
      });
    }
  }

  for (const step of sessionSteps) {
    errors.push(...captureErrors(step));

    if (step.action === 'listen') {
      if (step.captures.length > 0) {
        errors.push({
          issue: 'listen-has-captures',
          stepId: step.id,
          message: `Step "${step.id}" is a listen step, which has nothing to capture.`,
        });
      }
      continue;
    }

    const listen = byId.get(step.on);
    if (listen === undefined || !isListenStep(listen)) {
      errors.push({
        issue: 'session-step-unknown-listen',
        stepId: step.id,
        referencedStepId: step.on,
        message: `Step "${step.id}" names "${step.on}" as its session, which is not a listen step.`,
      });
    } else if (!ancestorsOf(step.id).has(step.on)) {
      errors.push({
        issue: 'session-step-unreachable-listen',
        stepId: step.id,
        referencedStepId: step.on,
        message: `Step "${step.id}" uses the session of "${step.on}", which isn't in its dependency chain. Add "${step.on}" (or a step after it) to dependsOn.`,
      });
    }

    if (step.action === 'send') {
      if (step.messageUid === undefined && step.endInput !== true) {
        errors.push({
          issue: 'send-without-message',
          stepId: step.id,
          message: `Step "${step.id}" has no message to send.`,
        });
      }
      continue;
    }

    errors.push(...expectErrors(step, byId, ancestorsOf));
  }

  return errors;
}

function captureErrors(step: SessionWorkflowStep): StructuralError[] {
  const errors: StructuralError[] = [];
  const seen = new Set<string>();
  for (const capture of step.captures) {
    if (seen.has(capture.name)) {
      errors.push({
        issue: 'duplicate-capture-name',
        stepId: step.id,
        referencedCaptureName: capture.name,
        message: `Duplicate capture name "${capture.name}" in step "${step.id}".`,
      });
    }
    seen.add(capture.name);
    if (readsStatus(capture)) {
      errors.push({
        issue: 'session-step-status-read',
        stepId: step.id,
        referencedCaptureName: capture.name,
        message: `Step "${step.id}" capture "${capture.name}" reads a status, and a ${step.action} step has none.`,
      });
    }
  }
  return errors;
}

function readsStatus(row: Capture | Criterion): boolean {
  if ('kind' in row && row.kind === 'status') return true;
  return 'extractor' in row && row.extractor.kind === 'status-code';
}

function expectErrors(
  step: ExpectWorkflowStep,
  byId: ReadonlyMap<string, WorkflowStep>,
  ancestorsOf: (stepId: string) => ReadonlySet<string>,
): StructuralError[] {
  const errors: StructuralError[] = [];

  if (!byId.has(step.after)) {
    errors.push({
      issue: 'expect-unknown-trigger',
      stepId: step.id,
      referencedStepId: step.after,
      message: `Step "${step.id}" waits for what "${step.after}" sets off, and there is no such step.`,
    });
  } else {
    if (!ancestorsOf(step.id).has(step.after)) {
      errors.push({
        issue: 'expect-unreachable-trigger',
        stepId: step.id,
        referencedStepId: step.after,
        message: `Step "${step.id}" waits for what "${step.after}" sets off, which isn't in its dependency chain. Add "${step.after}" (or a step after it) to dependsOn.`,
      });
    }
    if (step.after !== step.on && !ancestorsOf(step.after).has(step.on)) {
      errors.push({
        issue: 'expect-unarmed-trigger',
        stepId: step.id,
        referencedStepId: step.after,
        message: `Step "${step.after}" can start before "${step.on}" is ready, so "${step.id}" could miss what it sets off. Add "${step.on}" (or a step after it) to the dependsOn of "${step.after}".`,
      });
    }
    const setBeforeTrigger = ancestorsOf(step.after);
    for (const ref of scanTemplateReferences(step.address ?? '').step) {
      if (setBeforeTrigger.has(ref.stepId)) continue;
      errors.push({
        issue: 'expect-address-reads-trigger',
        stepId: step.id,
        referencedStepId: ref.stepId,
        referencedCaptureName: ref.captureName,
        message: `Step "${step.id}" address reads "${ref.stepId}.${ref.captureName}", which is not captured before "${step.after}" starts.`,
      });
    }
  }

  errors.push(...criterionPatternErrors(step.id, step.match));
  for (const criterion of step.match) {
    if (readsStatus(criterion)) {
      errors.push({
        issue: 'session-step-status-read',
        stepId: step.id,
        message: `Step "${step.id}" has a criterion that reads a status, and an expect step has none.`,
      });
    }
    if (criterion.kind !== 'equals') continue;
    for (const ref of scanTemplateReferences(criterion.value).step) {
      if (ancestorsOf(step.id).has(ref.stepId)) continue;
      if (!byId.has(ref.stepId)) {
        errors.push({
          issue: 'step-unknown-step-id',
          stepId: step.id,
          referencedStepId: ref.stepId,
          referencedCaptureName: ref.captureName,
          referencedCriterionUid: criterion.uid,
          message: `Step "${step.id}" criterion references "${ref.stepId}", and there is no such step.`,
        });
        continue;
      }
      errors.push({
        issue: 'step-template-unreachable-stepid',
        stepId: step.id,
        referencedStepId: ref.stepId,
        referencedCaptureName: ref.captureName,
        referencedCriterionUid: criterion.uid,
        message: `Step "${step.id}" criterion references "${ref.stepId}", which isn't in its dependency chain. Add "${ref.stepId}" (or an ancestor of it) to dependsOn.`,
      });
    }
  }

  return errors;
}
