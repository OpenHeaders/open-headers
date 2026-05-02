import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { LiveVariableSchema, LiveWorkflowSchema } from '../../src/schemas/live';
import { buildEmptyLiveVariable, buildEmptyLiveWorkflow } from '../../src/utils/live-defaults';

describe('buildEmptyLiveWorkflow', () => {
  it('returns a structurally valid seed (manual refresh, single placeholder step)', () => {
    const seed = buildEmptyLiveWorkflow('My Workflow');
    expect(seed.name).toBe('My Workflow');
    expect(seed.enabled).toBe(true);
    expect(seed.refresh).toEqual({ kind: 'manual' });
    expect(seed.steps).toHaveLength(1);
    expect(seed.steps[0]?.id).toBe('step1');
    expect(seed.steps[0]?.requestUid).toBe('');
  });

  it('does NOT set published — write-client owns that invariant', () => {
    const seed = buildEmptyLiveWorkflow('x');
    expect((seed as { published?: boolean }).published).toBeUndefined();
  });

  it('produces a schema-valid payload once the user picks a request for the placeholder step', () => {
    const seed = buildEmptyLiveWorkflow('x');
    // requestUid is the documented placeholder — `isWorkflowComplete`
    // rejects the empty string until the user binds a real request, so
    // populate it here to exercise the rest of the schema shape.
    const steps = seed.steps.map((s) => ({ ...s, requestUid: 'reqxxxxx' }));
    const candidate = { schemaVersion: 5, uid: 'wfxxxxxx', path: 'live-workflows/x', ...seed, steps };
    expect(() => v.parse(LiveWorkflowSchema, candidate)).not.toThrow();
  });
});

describe('buildEmptyLiveVariable', () => {
  it('binds to the supplied workflow + step + capture', () => {
    const seed = buildEmptyLiveVariable({
      name: 'token',
      workflowUid: 'wfxxxxxx',
      stepId: 'step1',
      captureName: 'cap',
    });
    expect(seed.name).toBe('token');
    expect(seed.workflowUid).toBe('wfxxxxxx');
    expect(seed.stepId).toBe('step1');
    expect(seed.captureName).toBe('cap');
    expect(seed.enabled).toBe(true);
  });

  it('does NOT set published — write-client owns that invariant', () => {
    const seed = buildEmptyLiveVariable({
      name: 'token',
      workflowUid: 'wfxxxxxx',
      stepId: 'step1',
      captureName: 'cap',
    });
    expect((seed as { published?: boolean }).published).toBeUndefined();
  });

  it('produces a payload that parses against LiveVariableSchema once entity-managed fields are added', () => {
    const seed = buildEmptyLiveVariable({
      name: 'token',
      workflowUid: 'wfxxxxxx',
      stepId: 'step1',
      captureName: 'cap',
    });
    const candidate = { schemaVersion: 5, uid: 'lvxxxxxx', path: 'live-variables/x', ...seed };
    expect(() => v.parse(LiveVariableSchema, candidate)).not.toThrow();
  });
});
