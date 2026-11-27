/**
 * What a line of the workflow graph says (the workflows redesign,
 * Connections): its label, whether the last run took it, and which of
 * its parent's captures its child reads. Pure.
 *
 * A line's label is the child's run-condition clauses that name the
 * line's parent — otherwise "always". A clause on a more distant step
 * is on no line; the step's panel shows it.
 *
 * Whether a run took a line is the child's own story: a step that ran
 * was reached by every line into it; a step its run condition skipped
 * names the clauses that did not hold, and a line that carries one of
 * them was not taken.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { scanTemplateReferencesMany, type WorkflowRunStepRow } from '@openheaders/core/live';
import type { StepGateClause, WorkflowStep } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { stepOwnTemplateSources } from './capture-uses';
import { classifyStepRun } from './live-display';

export type LineTruth = 'unknown' | 'taken' | 'not-taken';
export type LabelTruth = 'unknown' | 'true' | 'false';

export interface GraphLineState {
  line: LineTruth;
  label: LabelTruth;
}

/** How far the last run got with a step: it ran, its run condition skipped it, or the run never judged it. */
export interface StepReach {
  reached: 'ran' | 'skipped' | 'unknown';
  /** A skipped step's clauses that did not hold, by uid — absent where the run did not say. */
  unmet?: readonly string[];
}

const UNKNOWN: StepReach = { reached: 'unknown' };

export function reachOfRunRow(row: WorkflowRunStepRow | undefined): StepReach {
  if (row === undefined || row.state === 'waiting') return UNKNOWN;
  if (row.state === 'running') return { reached: 'ran' };
  switch (row.settlement.state) {
    case 'skipped':
      return {
        reached: 'skipped',
        ...(row.settlement.unmet !== undefined ? { unmet: row.settlement.unmet } : {}),
      };
    case 'not-run':
    case 'cannot-run':
      return UNKNOWN;
    default:
      return { reached: 'ran' };
  }
}

/** `run` is the active environment's cache row: it knows a skip, never which clause made it. */
export function reachOfCacheRow(run: LiveWorkflowRunSnapshot | null | undefined, stepId: string): StepReach {
  const state = classifyStepRun(run ?? null, stepId);
  if (state === 'not-run') return UNKNOWN;
  return { reached: state === 'skipped' ? 'skipped' : 'ran' };
}

/**
 * A line's state from its child's reach. `clauses` are the ones the
 * line carries; `meetsAtCapsule` says the line ends at its step's
 * capsule, where a line whose own clauses held is still taken — the
 * capsule's arrow is what a skip leaves dashed.
 */
export function lineStateOf(
  reach: StepReach,
  clauses: readonly StepGateClause[],
  meetsAtCapsule: boolean,
): GraphLineState {
  if (reach.reached === 'unknown') return { line: 'unknown', label: 'unknown' };
  if (reach.reached === 'ran') return { line: 'taken', label: 'true' };
  const unmet = reach.unmet;
  if (unmet === undefined) return { line: 'not-taken', label: 'unknown' };
  if (clauses.some((clause) => unmet.includes(clause.uid))) return { line: 'not-taken', label: 'false' };
  if (meetsAtCapsule) return { line: 'taken', label: 'true' };
  return { line: 'not-taken', label: clauses.length > 0 ? 'true' : 'unknown' };
}

/**
 * Whether one clause of a step's run condition held, from the step's
 * reach: every clause of a step that ran did; of a skipped step, the
 * ones the run named did not and the others did.
 */
export function clauseTruthOf(reach: StepReach, clauseUid: string): LabelTruth {
  if (reach.reached === 'unknown') return 'unknown';
  if (reach.reached === 'ran') return 'true';
  if (reach.unmet === undefined) return 'unknown';
  return reach.unmet.includes(clauseUid) ? 'false' : 'true';
}

/** The arrow from a capsule into its step: dashed where the run condition skipped the step. */
export function capsuleArrowState(reach: StepReach): LineTruth {
  if (reach.reached === 'unknown') return 'unknown';
  return reach.reached === 'ran' ? 'taken' : 'not-taken';
}

/** What a clause asks of its step, in a line's words. */
export function clauseWords(clause: StepGateClause, t: Translate): string {
  switch (clause.kind) {
    case 'status':
      if (typeof clause.match === 'string') return clause.match;
      if (clause.match[0] === 'eq') return String(clause.match[1]);
      if (clause.match[0] === 'ne') {
        return t('workbench.editors.live.graph.lineStatusNot', { value: clause.match[1] });
      }
      return clause.match[1].join(', ');
    case 'capture-exists':
      return t('workbench.editors.live.graph.lineCaptureExists', { name: clause.captureName });
    case 'capture-equals':
      // Pure technical composition — no English words, stays raw.
      return `${clause.captureName} = "${clause.value}"`;
    case 'capture-matches':
      return t('workbench.editors.live.graph.lineCaptureMatches', {
        name: clause.captureName,
        pattern: clause.pattern,
      });
  }
}

/** The clauses of a run condition that name `parentId`. */
export function clausesOn(clauses: readonly StepGateClause[], parentId: string): StepGateClause[] {
  return clauses.filter((clause) => clause.stepId === parentId);
}

/** `clauses` are the ones that name the line's parent. */
export function lineLabel(clauses: readonly StepGateClause[], t: Translate): string {
  if (clauses.length === 0) return t('workbench.editors.live.graph.lineAlways');
  return t('workbench.editors.live.graph.lineIf', {
    condition: clauses.map((clause) => clauseWords(clause, t)).join(' · '),
  });
}

/** The templates a step holds itself: a Wait's topic and match values, a Call's success criteria. */
export function stepOwnTemplates(step: WorkflowStep): string[] {
  return stepOwnTemplateSources(step).flatMap((source) => source.templates);
}

/** The captures of `parentId` that `templates` read, by name, first seen first. */
export function capturesRead(templates: readonly string[], parentId: string): string[] {
  return scanTemplateReferencesMany(templates)
    .step.filter((ref) => ref.stepId === parentId)
    .map((ref) => ref.captureName);
}
