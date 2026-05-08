import { describe, expect, it } from 'vitest';
import { evaluateClause, evaluateGate, matchStatus } from '../../src/live/gate-evaluator';
import type { StepGate, StepGateClause } from '../../src/types/v5/live';

function captures(shape: Record<string, Record<string, string>>): ReadonlyMap<string, ReadonlyMap<string, string>> {
  return new Map(Object.entries(shape).map(([stepId, caps]) => [stepId, new Map(Object.entries(caps))]));
}

function statuses(shape: Record<string, number>): ReadonlyMap<string, number> {
  return new Map(Object.entries(shape));
}

describe('matchStatus', () => {
  it('matches status class literals', () => {
    expect(matchStatus(200, '2xx')).toBe(true);
    expect(matchStatus(299, '2xx')).toBe(true);
    expect(matchStatus(300, '2xx')).toBe(false);
    expect(matchStatus(404, '4xx')).toBe(true);
    expect(matchStatus(500, '5xx')).toBe(true);
    expect(matchStatus(500, '2xx')).toBe(false);
  });

  it('matches exact status via ["eq", N]', () => {
    expect(matchStatus(200, ['eq', 200])).toBe(true);
    expect(matchStatus(201, ['eq', 200])).toBe(false);
  });

  it('matches not-equal via ["ne", N]', () => {
    expect(matchStatus(200, ['ne', 201])).toBe(true);
    expect(matchStatus(201, ['ne', 201])).toBe(false);
  });

  it('matches in-list via ["in", [N,N,...]]', () => {
    expect(matchStatus(200, ['in', [200, 201, 204]])).toBe(true);
    expect(matchStatus(204, ['in', [200, 201, 204]])).toBe(true);
    expect(matchStatus(500, ['in', [200, 201, 204]])).toBe(false);
  });
});

describe('evaluateClause', () => {
  const caps = captures({
    probe: { flag: 'a', token: 'abc123', status_text: 'ok' },
  });
  const sts = statuses({ probe: 200 });

  it('status clause — class match', () => {
    const c: StepGateClause = { uid: 'gat0sta1', kind: 'status', stepId: 'probe', match: '2xx' };
    expect(evaluateClause(c, caps, sts)).toBe(true);
  });

  it('status clause — step without a recorded status is false (skipped ancestor)', () => {
    const c: StepGateClause = { uid: 'gat0sta2', kind: 'status', stepId: 'ghost', match: '2xx' };
    expect(evaluateClause(c, caps, sts)).toBe(false);
  });

  it('capture-exists — present = true', () => {
    const c: StepGateClause = { uid: 'gat0ex01', kind: 'capture-exists', stepId: 'probe', captureName: 'flag' };
    expect(evaluateClause(c, caps, sts)).toBe(true);
  });

  it('capture-exists — absent = false', () => {
    const c: StepGateClause = { uid: 'gat0ex02', kind: 'capture-exists', stepId: 'probe', captureName: 'missing' };
    expect(evaluateClause(c, caps, sts)).toBe(false);
  });

  it('capture-exists — skipped-step = false', () => {
    const c: StepGateClause = { uid: 'gat0ex03', kind: 'capture-exists', stepId: 'ghost', captureName: 'anything' };
    expect(evaluateClause(c, caps, sts)).toBe(false);
  });

  it('capture-equals — exact match', () => {
    const c: StepGateClause = {
      uid: 'gat0eq01',
      kind: 'capture-equals',
      stepId: 'probe',
      captureName: 'flag',
      value: 'a',
    };
    expect(evaluateClause(c, caps, sts)).toBe(true);
  });

  it('capture-equals — mismatch', () => {
    const c: StepGateClause = {
      uid: 'gat0eq02',
      kind: 'capture-equals',
      stepId: 'probe',
      captureName: 'flag',
      value: 'b',
    };
    expect(evaluateClause(c, caps, sts)).toBe(false);
  });

  it('capture-matches — regex hit', () => {
    const c: StepGateClause = {
      uid: 'gat0ma01',
      kind: 'capture-matches',
      stepId: 'probe',
      captureName: 'token',
      pattern: '^abc',
    };
    expect(evaluateClause(c, caps, sts)).toBe(true);
  });

  it('capture-matches — regex miss', () => {
    const c: StepGateClause = {
      uid: 'gat0ma02',
      kind: 'capture-matches',
      stepId: 'probe',
      captureName: 'token',
      pattern: '^xyz',
    };
    expect(evaluateClause(c, caps, sts)).toBe(false);
  });

  it('capture-matches — invalid regex evaluates to false (defensive)', () => {
    const c: StepGateClause = {
      uid: 'gat0ma03',
      kind: 'capture-matches',
      stepId: 'probe',
      captureName: 'token',
      pattern: '[invalid',
    };
    expect(evaluateClause(c, caps, sts)).toBe(false);
  });
});

describe('evaluateGate — AND across clauses', () => {
  const caps = captures({ probe: { flag: 'a', n: '5' } });
  const sts = statuses({ probe: 200 });

  it('empty gate matches everything', () => {
    const gate: StepGate = { all: [] };
    expect(evaluateGate(gate, caps, sts)).toBe(true);
  });

  it('all clauses true → true', () => {
    const gate: StepGate = {
      all: [
        { uid: 'gat1sta1', kind: 'status', stepId: 'probe', match: '2xx' },
        { uid: 'gat1eq01', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'a' },
      ],
    };
    expect(evaluateGate(gate, caps, sts)).toBe(true);
  });

  it('any clause false → false', () => {
    const gate: StepGate = {
      all: [
        { uid: 'gat1sta2', kind: 'status', stepId: 'probe', match: '2xx' }, // true
        { uid: 'gat1eq02', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'b' }, // false
      ],
    };
    expect(evaluateGate(gate, caps, sts)).toBe(false);
  });
});
