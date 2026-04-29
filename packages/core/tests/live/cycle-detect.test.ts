import { describe, expect, it } from 'vitest';
import { detectCycles, type RequestTemplateProvider } from '../../src/live/cycle-detect';
import type { LiveVariable, LiveWorkflow } from '../../src/types/v5/live';

function wf(uid: string, name: string, requestUid: string, captureName = 'value'): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid,
    path: `live-workflows/${name}-${uid}`,
    name,
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      {
        id: 'only',
        requestUid,
        captures: [{ name: captureName, extractor: { kind: 'whole-body' } }],
      },
    ],
  };
}

function lv(uid: string, name: string, workflowUid: string, captureName = 'value'): LiveVariable {
  return {
    schemaVersion: 5,
    uid,
    path: `live-variables/${name}-${uid}`,
    name,
    enabled: true,
    workflowUid,
    stepId: 'only',
    captureName,
  };
}

describe('detectCycles', () => {
  it('returns [] when there are no cycles', () => {
    const lvs = [lv('lv000001', 'a', 'wf000001'), lv('lv000002', 'b', 'wf000002')];
    const wfs = [wf('wf000001', 'a', 'req00001'), wf('wf000002', 'b', 'req00002')];
    // req2 uses live.a (forward edge only) — no cycle.
    const provider: RequestTemplateProvider = (uid) => (uid === 'req00002' ? ['{{live.a}}'] : []);
    expect(detectCycles(lvs, wfs, provider)).toEqual([]);
  });

  it('detects a 2-node cycle A → B → A', () => {
    const lvs = [lv('lv000001', 'a', 'wf000001'), lv('lv000002', 'b', 'wf000002')];
    const wfs = [wf('wf000001', 'a', 'req00001'), wf('wf000002', 'b', 'req00002')];
    const provider: RequestTemplateProvider = (uid) => {
      if (uid === 'req00001') return ['{{live.b}}']; // a depends on b
      if (uid === 'req00002') return ['{{live.a}}']; // b depends on a → cycle
      return [];
    };
    const cycles = detectCycles(lvs, wfs, provider);
    expect(cycles).toHaveLength(1);
    // Cycle path closes on itself — first and last entries are the same node.
    expect(cycles[0].cycle[0]).toBe(cycles[0].cycle[cycles[0].cycle.length - 1]);
    expect(cycles[0].cycle).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('detects a self-cycle A → A', () => {
    const lvs = [lv('lv000001', 'self', 'wf000001')];
    const wfs = [wf('wf000001', 'self', 'req00001')];
    const provider: RequestTemplateProvider = (uid) => (uid === 'req00001' ? ['{{live.self}}'] : []);
    const cycles = detectCycles(lvs, wfs, provider);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].cycle[0]).toBe('self');
    expect(cycles[0].edges[0]).toMatchObject({ fromLvName: 'self', toLvName: 'self' });
  });

  it('detects a longer cycle A → B → C → A', () => {
    const lvs = [lv('lv000001', 'a', 'wf000001'), lv('lv000002', 'b', 'wf000002'), lv('lv000003', 'c', 'wf000003')];
    const wfs = [wf('wf000001', 'a', 'req00001'), wf('wf000002', 'b', 'req00002'), wf('wf000003', 'c', 'req00003')];
    const provider: RequestTemplateProvider = (uid) => {
      if (uid === 'req00001') return ['{{live.b}}'];
      if (uid === 'req00002') return ['{{live.c}}'];
      if (uid === 'req00003') return ['{{live.a}}'];
      return [];
    };
    const cycles = detectCycles(lvs, wfs, provider);
    expect(cycles).toHaveLength(1);
    const names = new Set(cycles[0].cycle);
    expect(names).toEqual(new Set(['a', 'b', 'c']));
  });

  it('ignores edges to unresolved live names (resolver surfaces those separately)', () => {
    const lvs = [lv('lv000001', 'a', 'wf000001')];
    const wfs = [wf('wf000001', 'a', 'req00001')];
    const provider: RequestTemplateProvider = (uid) => (uid === 'req00001' ? ['{{live.nonexistent}}'] : []);
    expect(detectCycles(lvs, wfs, provider)).toEqual([]);
  });

  it('ignores {{env.X}} and other non-live refs', () => {
    const lvs = [lv('lv000001', 'a', 'wf000001')];
    const wfs = [wf('wf000001', 'a', 'req00001')];
    const provider: RequestTemplateProvider = () => ['{{env.API_URL}} {{vault.SECRET}}'];
    expect(detectCycles(lvs, wfs, provider)).toEqual([]);
  });

  it('reports multiple independent cycles', () => {
    // A ↔ B AND C ↔ D — two independent cycles.
    const lvs = [
      lv('lv000001', 'a', 'wf000001'),
      lv('lv000002', 'b', 'wf000002'),
      lv('lv000003', 'c', 'wf000003'),
      lv('lv000004', 'd', 'wf000004'),
    ];
    const wfs = [
      wf('wf000001', 'a', 'req00001'),
      wf('wf000002', 'b', 'req00002'),
      wf('wf000003', 'c', 'req00003'),
      wf('wf000004', 'd', 'req00004'),
    ];
    const provider: RequestTemplateProvider = (uid) => {
      if (uid === 'req00001') return ['{{live.b}}'];
      if (uid === 'req00002') return ['{{live.a}}'];
      if (uid === 'req00003') return ['{{live.d}}'];
      if (uid === 'req00004') return ['{{live.c}}'];
      return [];
    };
    const cycles = detectCycles(lvs, wfs, provider);
    expect(cycles.length).toBeGreaterThanOrEqual(2);
  });

  it('carries through-workflow and through-step metadata on edges', () => {
    const lvs = [lv('lv000001', 'a', 'wf000001'), lv('lv000002', 'b', 'wf000002')];
    const wfs = [wf('wf000001', 'a', 'req00001'), wf('wf000002', 'b', 'req00002')];
    const provider: RequestTemplateProvider = (uid) => {
      if (uid === 'req00001') return ['{{live.b}}'];
      if (uid === 'req00002') return ['{{live.a}}'];
      return [];
    };
    const cycles = detectCycles(lvs, wfs, provider);
    expect(cycles[0].edges.length).toBeGreaterThan(0);
    for (const e of cycles[0].edges) {
      expect(e.throughStepId).toBe('only');
      expect(e.throughWorkflowUid).toMatch(/^wf/);
    }
  });
});
