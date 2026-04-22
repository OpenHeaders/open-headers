import { describe, expect, it } from 'vitest';
import { comparePriority, PRIORITY_LAST, priorityValue } from '../../src/live/priority-evaluator';
import type { WorkflowStep } from '../../src/types/v5/live';

function step(id: string, priorityFrom?: WorkflowStep['priorityFrom']): WorkflowStep {
  return { id, requestUid: 'reqonly1', captures: [], priorityFrom };
}

function captures(shape: Record<string, Record<string, string>>): ReadonlyMap<string, ReadonlyMap<string, string>> {
  return new Map(Object.entries(shape).map(([stepId, caps]) => [stepId, new Map(Object.entries(caps))]));
}

describe('priorityValue', () => {
  it('no priorityFrom → Infinity (runs last)', () => {
    expect(priorityValue(step('a'), captures({}))).toBe(PRIORITY_LAST);
  });

  it('priorityFrom with missing capture → Infinity', () => {
    const s = step('a', { stepId: 'probe', captureName: 'p', sort: 'numeric' });
    expect(priorityValue(s, captures({}))).toBe(PRIORITY_LAST);
  });

  it('priorityFrom with numeric capture → parsed number', () => {
    const s = step('a', { stepId: 'probe', captureName: 'p', sort: 'numeric' });
    expect(priorityValue(s, captures({ probe: { p: '5' } }))).toBe(5);
  });

  it('priorityFrom with lexicographic capture → raw string', () => {
    const s = step('a', { stepId: 'probe', captureName: 'p', sort: 'lexicographic' });
    expect(priorityValue(s, captures({ probe: { p: 'banana' } }))).toBe('banana');
  });

  it('priorityFrom numeric mode with non-parseable value → falls back to lexicographic', () => {
    const s = step('a', { stepId: 'probe', captureName: 'p', sort: 'numeric' });
    expect(priorityValue(s, captures({ probe: { p: 'high' } }))).toBe('high');
  });

  it('priorityFrom default sort is numeric', () => {
    const s = step('a', { stepId: 'probe', captureName: 'p' });
    expect(priorityValue(s, captures({ probe: { p: '42' } }))).toBe(42);
  });
});

describe('comparePriority', () => {
  it('numeric ascending', () => {
    const items = [
      { value: 5, declaredIndex: 0 },
      { value: 1, declaredIndex: 1 },
      { value: 3, declaredIndex: 2 },
    ];
    items.sort(comparePriority);
    expect(items.map((i) => i.value)).toEqual([1, 3, 5]);
  });

  it('ties broken by declared index', () => {
    const items = [
      { value: 5, declaredIndex: 2 },
      { value: 5, declaredIndex: 0 },
      { value: 5, declaredIndex: 1 },
    ];
    items.sort(comparePriority);
    expect(items.map((i) => i.declaredIndex)).toEqual([0, 1, 2]);
  });

  it('Infinity runs last', () => {
    const items = [
      { value: PRIORITY_LAST, declaredIndex: 0 },
      { value: 3, declaredIndex: 1 },
      { value: 1, declaredIndex: 2 },
    ];
    items.sort(comparePriority);
    expect(items.map((i) => i.declaredIndex)).toEqual([2, 1, 0]);
  });

  it('lexicographic strings sort ascending', () => {
    const items = [
      { value: 'banana', declaredIndex: 0 },
      { value: 'apple', declaredIndex: 1 },
      { value: 'cherry', declaredIndex: 2 },
    ];
    items.sort(comparePriority);
    expect(items.map((i) => i.value)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('numbers beat strings (mixed degradation → string to back)', () => {
    const items = [
      { value: 'late', declaredIndex: 0 },
      { value: 10, declaredIndex: 1 },
    ];
    items.sort(comparePriority);
    expect(items[0].value).toBe(10);
  });
});
