import type { LiveVariable } from '@openheaders/core/types';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import {
  liveVariableConflictAdapter,
  liveVariableResolveAdapter,
} from '@openheaders/ui/workbench/components/live/live-variable-conflict-adapter';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

function makeLv(overrides: Partial<LiveVariable> = {}): LiveVariable {
  return {
    schemaVersion: 5,
    uid: 'lv-aaaa',
    path: 'live-vars/lv-aaaa.yaml',
    name: 'accessToken',
    description: 'desc',
    enabled: true,
    requireFreshOnRuleBuild: false,
    workflowUid: 'wf-bbbb',
    stepId: 'login',
    captureName: 'token',
    ...overrides,
  } as LiveVariable;
}

describe('liveVariableConflictAdapter', () => {
  it('extracts every save-batch leaf', () => {
    const baseline = liveVariableConflictAdapter.extractBaseline(makeLv());
    expect(baseline).toEqual({
      name: 'accessToken',
      description: 'desc',
      enabled: 'true',
      requireFreshOnRuleBuild: 'false',
      workflowUid: 'wf-bbbb',
      stepId: 'login',
      captureName: 'token',
    });
  });

  it('reads scalar leaves by path', () => {
    const lv = makeLv({ enabled: false, requireFreshOnRuleBuild: true });
    expect(liveVariableConflictAdapter.readPath(lv, 'enabled')).toBe('false');
    expect(liveVariableConflictAdapter.readPath(lv, 'requireFreshOnRuleBuild')).toBe('true');
    expect(liveVariableConflictAdapter.readPath(lv, 'workflowUid')).toBe('wf-bbbb');
    expect(liveVariableConflictAdapter.readPath(lv, 'unknown.path')).toBeNull();
  });

  it('snapshotSets is empty (no set-modeled fields)', () => {
    expect(liveVariableConflictAdapter.snapshotSets(makeLv())).toEqual([]);
    expect(liveVariableConflictAdapter.snapshotSetsFromForm({}, makeLv())).toEqual([]);
  });

  it('handles missing optional description as empty string', () => {
    const lv = makeLv({ description: undefined });
    expect(liveVariableConflictAdapter.readPath(lv, 'description')).toBe('');
  });
});

describe('liveVariableResolveAdapter', () => {
  it('writes scalar leaves into the entity clone', () => {
    const lv = makeLv();
    liveVariableResolveAdapter.applyResolutionToEntity(lv, 'name', { base: '', theirs: 'renamed' });
    expect(lv.name).toBe('renamed');
    liveVariableResolveAdapter.applyResolutionToEntity(lv, 'enabled', { base: '', theirs: 'false' });
    expect(lv.enabled).toBe(false);
    liveVariableResolveAdapter.applyResolutionToEntity(lv, 'requireFreshOnRuleBuild', {
      base: '',
      theirs: 'true',
    });
    expect(lv.requireFreshOnRuleBuild).toBe(true);
    liveVariableResolveAdapter.applyResolutionToEntity(lv, 'description', { base: '', theirs: 'new desc' });
    expect(lv.description).toBe('new desc');
  });

  it('returns false for unrecognized paths', () => {
    const lv = makeLv();
    expect(liveVariableResolveAdapter.applyResolutionToEntity(lv, 'unknown', { base: '', theirs: 'x' })).toBe(false);
  });

  it('produces human labels for known leaves', () => {
    const lv = makeLv();
    expect(liveVariableResolveAdapter.prettyPath(t, lv, 'name')).toContain('name');
    expect(liveVariableResolveAdapter.prettyPath(t, lv, 'requireFreshOnRuleBuild')).toContain('fresh');
    expect(liveVariableResolveAdapter.prettyPath(t, lv, 'unknown.path')).toBe('unknown.path');
  });
});
