/**
 * Where an error of a step is shown in its panel (the workflow runs
 * plan, Decisions log, S35): on a card of a tab — the tab then wears a
 * dot — in the list under the head, or in neither.
 */

import type { DraftCallStep, StructuralError, StructuralIssue } from '@openheaders/core/live';
import type { ListenWorkflowStep } from '@openheaders/core/types';
import {
  isListedUnderHead,
  STEP_TABS,
  tabOfError,
  tabsWithErrors,
} from '@openheaders/ui/workbench/components/live/step-tabs';
import { describe, expect, it } from 'vitest';

const CALL: DraftCallStep = { uid: 'stpcall0', id: 'reboot', requestUid: 'reqfixt1', captures: [] };

const LISTEN: ListenWorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 5000,
  captures: [],
};

function errorOf(issue: StructuralIssue, more: Partial<StructuralError> = {}): StructuralError {
  return { issue, stepId: 'reboot', message: `${issue} on reboot`, ...more };
}

describe('step tabs', () => {
  it('are four, in the order the head draws them', () => {
    expect(STEP_TABS).toEqual(['setup', 'flow', 'data', 'last-run']);
  });

  it.each<[StructuralIssue, 'setup' | 'flow']>([
    ['step-request-missing', 'setup'],
    ['criterion-invalid-regex', 'setup'],
    ['poll-without-criteria', 'setup'],
    ['poll-exceeds-limit', 'setup'],
    ['listen-request-missing', 'setup'],
    ['session-step-unknown-listen', 'setup'],
    ['session-step-unreachable-listen', 'setup'],
    ['expect-unknown-trigger', 'setup'],
    ['expect-unreachable-trigger', 'setup'],
    ['expect-unarmed-trigger', 'setup'],
    ['expect-address-reads-trigger', 'setup'],
    ['step-unknown-dep', 'flow'],
    ['depends-on-cycle', 'flow'],
    ['gate-unknown-stepid', 'flow'],
    ['gate-unreachable-stepid', 'flow'],
    ['gate-unknown-capture', 'flow'],
    ['gate-invalid-regex', 'flow'],
    ['priority-unknown-stepid', 'flow'],
    ['priority-unreachable-stepid', 'flow'],
    ['priority-unknown-capture', 'flow'],
  ])('%s is shown on a card of %s, and the head does not list it', (issue, tab) => {
    const error = errorOf(issue);
    expect(tabOfError(error, issue === 'listen-request-missing' ? LISTEN : CALL)).toBe(tab);
    expect(isListedUnderHead(error)).toBe(false);
  });

  it.each<StructuralIssue>([
    'duplicate-capture-name',
    'step-forward-reference',
    'step-unknown-step-id',
    'step-unknown-capture',
    'step-request-incomplete',
    'step-template-unreachable-stepid',
    'session-step-status-read',
    'listen-has-captures',
    'send-end-input-unsupported',
    'expect-stored-unsure',
  ])('%s is on no card: the head lists it', (issue) => {
    const error = errorOf(issue);
    expect(tabOfError(error, CALL)).toBeNull();
    expect(isListedUnderHead(error)).toBe(true);
  });

  it.each<StructuralIssue>(['duplicate-step-id', 'step-needs-update', 'send-without-message'])(
    '%s is on no card and in no list',
    (issue) => {
      const error = errorOf(issue);
      expect(tabOfError(error, CALL)).toBeNull();
      expect(isListedUnderHead(error)).toBe(false);
    },
  );

  it('an error that names a criteria row is on Setup, whatever its issue', () => {
    const error = errorOf('step-unknown-step-id', { referencedCriterionUid: 'critxxxx' });
    expect(tabOfError(error, CALL)).toBe('setup');
    expect(isListedUnderHead(error)).toBe(false);
  });

  it('a listen that names no request yet has no error on its picker, so none on its tab', () => {
    const error = errorOf('listen-request-missing', { stepId: 'probe' });
    expect(tabOfError(error, { ...LISTEN, sessionRequestUid: '' })).toBeNull();
    expect(tabOfError(error, LISTEN)).toBe('setup');
    expect(isListedUnderHead(error)).toBe(false);
  });

  it('gathers the tabs that hold a card with an error, each once', () => {
    const errors = [
      errorOf('gate-unknown-stepid'),
      errorOf('priority-unknown-capture'),
      errorOf('poll-without-criteria'),
      errorOf('duplicate-capture-name'),
    ];
    expect(Array.from(tabsWithErrors(errors, CALL)).sort()).toEqual(['flow', 'setup']);
    expect(tabsWithErrors([errorOf('duplicate-capture-name')], CALL).size).toBe(0);
    expect(tabsWithErrors([], CALL).size).toBe(0);
  });
});
