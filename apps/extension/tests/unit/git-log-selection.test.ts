/**
 * The commit lists' reading of the shared selection model
 * (`log-selection.ts`): the details commit after a click and where an
 * arrow lands.
 */

import { EMPTY_SELECTION, selectOnly } from '@openheaders/ui/shared/selection';
import { commitClickOutcome, stepTarget } from '@openheaders/ui/workbench/components/panels/git/log-selection';
import { describe, expect, it } from 'vitest';

const ORDER = ['c1', 'c2', 'c3', 'c4'];
const PLAIN = { toggle: false, range: false };
const TOGGLE = { toggle: true, range: false };
const RANGE = { toggle: false, range: true };

describe('commitClickOutcome', () => {
  it('a plain click follows the clicked commit alone', () => {
    const outcome = commitClickOutcome(selectOnly('c1'), ORDER, 'c3', PLAIN);
    expect([...outcome.next.ids]).toEqual(['c3']);
    expect(outcome.lead).toBe('c3');
  });

  it('a range click follows the clicked commit over the range', () => {
    const outcome = commitClickOutcome(selectOnly('c1'), ORDER, 'c3', RANGE);
    expect([...outcome.next.ids].sort()).toEqual(['c1', 'c2', 'c3']);
    expect(outcome.lead).toBe('c3');
  });

  it('a toggle in follows the toggled commit', () => {
    const outcome = commitClickOutcome(selectOnly('c1'), ORDER, 'c4', TOGGLE);
    expect([...outcome.next.ids].sort()).toEqual(['c1', 'c4']);
    expect(outcome.lead).toBe('c4');
  });

  it('a toggle out follows the first commit still selected', () => {
    const two = commitClickOutcome(selectOnly('c1'), ORDER, 'c4', TOGGLE).next;
    const outcome = commitClickOutcome(two, ORDER, 'c1', TOGGLE);
    expect([...outcome.next.ids]).toEqual(['c4']);
    expect(outcome.lead).toBe('c4');
  });

  it('a toggle out of the last commit follows nothing', () => {
    const outcome = commitClickOutcome(selectOnly('c2'), ORDER, 'c2', TOGGLE);
    expect(outcome.next.ids.size).toBe(0);
    expect(outcome.lead).toBeNull();
  });
});

describe('stepTarget', () => {
  it('steps one row from the cursor and clamps at the ends', () => {
    expect(stepTarget(ORDER, 'c2', 1)).toBe('c3');
    expect(stepTarget(ORDER, 'c2', -1)).toBe('c1');
    expect(stepTarget(ORDER, 'c4', 1)).toBe('c4');
    expect(stepTarget(ORDER, 'c1', -1)).toBe('c1');
  });

  it('lands on the first row without a cursor or with one the list lost', () => {
    expect(stepTarget(ORDER, null, 1)).toBe('c1');
    expect(stepTarget(ORDER, null, -1)).toBe('c1');
    expect(stepTarget(ORDER, 'gone', 1)).toBe('c1');
    expect(stepTarget(ORDER, EMPTY_SELECTION.lead, 1)).toBe('c1');
  });

  it('answers null on an empty list', () => {
    expect(stepTarget([], 'c1', 1)).toBeNull();
  });
});
