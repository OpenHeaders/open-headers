/**
 * The pages of a step's panel (the workflow runs plan, Decisions log,
 * S35): Setup — what the step does; Flow — when it runs; Data — what it
 * keeps and reads; Last run — what happened. The same four on a step of
 * every action the model knows.
 *
 * Also where an error of a step is shown: on a field of a card, and so
 * on that card's tab; in the list under the panel's head; or, for the
 * few a field says in its own way, in neither.
 */

import { type DraftStep, isListenStep, type StructuralError, type StructuralIssue } from '@openheaders/core/live';
import type { MessageKey } from '@openheaders/i18n';

export const STEP_TABS = ['setup', 'flow', 'data', 'last-run'] as const;
export type StepTab = (typeof STEP_TABS)[number];

export const STEP_TAB_WORD: Record<StepTab, MessageKey> = {
  setup: 'workbench.editors.live.panel.tabSetup',
  flow: 'workbench.editors.live.panel.tabFlow',
  data: 'workbench.editors.live.panel.tabData',
  'last-run': 'workbench.editors.live.panel.tabLastRun',
};

/** The issues a card shows on a field of its own, by the tab the card is on. */
const TAB_OF_ISSUE: ReadonlyMap<StructuralIssue, StepTab> = new Map<StructuralIssue, StepTab>([
  // Request, Success criteria, Poll.
  ['step-request-missing', 'setup'],
  ['criterion-invalid-regex', 'setup'],
  ['poll-without-criteria', 'setup'],
  ['poll-exceeds-limit', 'setup'],
  // Connection, Send message, Expect message.
  ['listen-request-missing', 'setup'],
  ['session-step-unknown-listen', 'setup'],
  ['session-step-unreachable-listen', 'setup'],
  ['expect-unknown-trigger', 'setup'],
  ['expect-unreachable-trigger', 'setup'],
  ['expect-unarmed-trigger', 'setup'],
  ['expect-address-reads-trigger', 'setup'],
  // Depends on, Run condition, Priority.
  ['step-unknown-dep', 'flow'],
  ['depends-on-cycle', 'flow'],
  ['gate-unknown-stepid', 'flow'],
  ['gate-unreachable-stepid', 'flow'],
  ['gate-unknown-capture', 'flow'],
  ['gate-invalid-regex', 'flow'],
  ['priority-unknown-stepid', 'flow'],
  ['priority-unreachable-stepid', 'flow'],
  ['priority-unknown-capture', 'flow'],
]);

/** Said by the head's name field, by the step's one sentence, or — a message not picked yet — by nothing. */
const UNLISTED_ISSUES: ReadonlySet<StructuralIssue> = new Set([
  'duplicate-step-id',
  'step-needs-update',
  'send-without-message',
]);

/** The tab whose card shows the error on a field of its own — `null` where no card does. */
export function tabOfError(error: StructuralError, step: DraftStep): StepTab | null {
  // A row of Success criteria or of Match criteria.
  if (error.referencedCriterionUid !== undefined) return 'setup';
  // A listen that names no request yet has none that could be missing: its picker shows no error.
  if (error.issue === 'listen-request-missing' && isListenStep(step) && step.sessionRequestUid === '') return null;
  return TAB_OF_ISSUE.get(error.issue) ?? null;
}

/** The tabs that hold a card with an error. */
export function tabsWithErrors(errors: readonly StructuralError[], step: DraftStep): ReadonlySet<StepTab> {
  const tabs = new Set<StepTab>();
  for (const error of errors) {
    const tab = tabOfError(error, step);
    if (tab !== null) tabs.add(tab);
  }
  return tabs;
}

/** An error no field of the panel owns: the head lists it, whatever tab is open. */
export function isListedUnderHead(error: StructuralError): boolean {
  return (
    error.referencedCriterionUid === undefined && !TAB_OF_ISSUE.has(error.issue) && !UNLISTED_ISSUES.has(error.issue)
  );
}
