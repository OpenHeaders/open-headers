/**
 * The workflow editor's pure helpers and a step this build does not
 * know (the workflow runs plan, Laws — "A reader assumes only `uid`,
 * `id` and `action`").
 *
 * The step is laid out, tracked by its id, and carried through every
 * helper unchanged: none writes a key onto it, none reads one off it.
 */

import type { DraftCallStep, DraftWorkflow } from '@openheaders/core/live';
import type { LiveWorkflow, UnknownWorkflowStep } from '@openheaders/core/types';
import { buildDependencyRows } from '@openheaders/ui/workbench/components/live/dependencies-view';
import { addGraphDependency, removeGraphDependency } from '@openheaders/ui/workbench/components/live/graph-edit';
import { buildWorkflowGraphLayout } from '@openheaders/ui/workbench/components/live/graph-layout';
import {
  liveWorkflowConflictAdapter,
  liveWorkflowResolveAdapter,
} from '@openheaders/ui/workbench/components/live/live-workflow-conflict-adapter';
import { rebindCaptureReferences } from '@openheaders/ui/workbench/components/live/rebind-capture-references';
import { rebindStepReferences } from '@openheaders/ui/workbench/components/live/rebind-step-references';
import { projectLiveWorkflowToForm } from '@openheaders/ui/workbench/components/live/use-live-workflow-conflicts';
import { describe, expect, it } from 'vitest';

// Actions no build knows: `listen` and `expect` are the model's own now,
// and the editor's helpers read their keys.
const listen: UnknownWorkflowStep = { uid: 'stplistn', id: 'probe', action: 'watch' };
const call: DraftCallStep = { uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] };
const expectStep: UnknownWorkflowStep = { uid: 'stpexpct', id: 'status', action: 'verify' };

const workflow: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wfdevice',
  path: 'live-workflows/reboot-wfdevice',
  name: 'Reboot',
  steps: [listen, call, expectStep],
  refresh: { kind: 'manual' },
  enabled: true,
};

const draft: DraftWorkflow = {
  name: 'Reboot',
  description: '',
  steps: [listen, call, expectStep],
  refresh: { kind: 'manual' },
  enabled: true,
};

describe('layout', () => {
  it('lays the steps out as a chain, each after the one before it', () => {
    const layout = buildWorkflowGraphLayout(workflow, { nodeWidth: 100, gap: 20, laneWidth: 10 });
    expect(layout.nodes.map((node) => [node.step.id, node.layer])).toEqual([
      ['probe', 0],
      ['reboot', 1],
      ['status', 2],
    ]);
    expect(layout.edges).toEqual([
      { from: 'probe', to: 'reboot', lanes: [] },
      { from: 'reboot', to: 'status', lanes: [] },
    ]);
  });

  it('gives the form the same parents', () => {
    expect(buildDependencyRows(workflow).map((row) => row.parents)).toEqual([[], ['probe'], ['reboot']]);
  });
});

describe('graph edits', () => {
  it('take no edge onto a step this build does not know, and remove none from it', () => {
    expect(addGraphDependency(draft, 'probe', 'status')).toBeNull();
    expect(removeGraphDependency(draft, 'reboot', 'status')).toBeNull();
  });

  it('still edit the call step beside one', () => {
    expect(removeGraphDependency(draft, 'probe', 'reboot')?.steps).toEqual([
      listen,
      { ...call, dependsOn: [] },
      expectStep,
    ]);
  });
});

describe('reference rebinding', () => {
  it('carries the unknown steps through a step rename by reference', () => {
    const renamed: DraftWorkflow = { ...draft, steps: [{ ...listen, id: 'listener' }, call, expectStep] };
    const out = rebindStepReferences({ draft: renamed, targetUid: listen.uid, oldId: 'probe', newId: 'listener' });
    expect(out.steps[2]).toBe(expectStep);
  });

  it('carries them through a capture rename by reference', () => {
    const out = rebindCaptureReferences({ draft, ownerStepId: 'reboot', oldName: 'id', newName: 'commandId' });
    expect(out.steps[0]).toBe(listen);
    expect(out.steps[2]).toBe(expectStep);
  });
});

describe('conflict tracking', () => {
  it('tracks an unknown step by its id alone', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(workflow);
    expect(Object.keys(baseline).filter((path) => path.startsWith('steps.stplistn'))).toEqual(['steps.stplistn.id']);
    expect(baseline['steps.stplistn.id']).toBe('probe');
    expect(liveWorkflowConflictAdapter.readPath(workflow, 'steps.stplistn.requestUid')).toBeNull();
  });

  it('keeps it a member of the step set, with no captures of its own', () => {
    const sets = liveWorkflowConflictAdapter.snapshotSets?.(workflow) ?? [];
    expect([...(sets.find((set) => set.setPath === 'steps')?.byUid.keys() ?? [])]).toEqual([
      'stplistn',
      'stpcall0',
      'stpexpct',
    ]);
    expect(sets.find((set) => set.setPath === 'steps.stplistn.captures')?.byUid.size).toBe(0);
  });

  it('projects the form the same way, so the two sides compare path for path', () => {
    const form = projectLiveWorkflowToForm({ ...draft, steps: workflow.steps });
    expect(Object.keys(form).filter((path) => path.startsWith('steps.stpexpct'))).toEqual(['steps.stpexpct.id']);
  });

  it('writes no resolution onto one', () => {
    const entity = structuredClone(workflow);
    const applied = liveWorkflowResolveAdapter.applyResolutionToEntity(entity, 'steps.stplistn.requestUid', {
      base: '',
      theirs: 'httpreq9',
    });
    expect(applied).toBe(false);
    expect(entity.steps[0]).toEqual(listen);
  });
});
