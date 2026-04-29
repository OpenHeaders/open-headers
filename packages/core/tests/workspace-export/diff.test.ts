/**
 * Collision-detection coverage for `diffWorkspaceExport`.
 *
 * Each entity row of design §2.1 gets a positive (collision detected,
 * strategy applied) and a negative (no collision, default path) test.
 */

import { describe, expect, it } from 'vitest';
import type { Collection, Environment, Folder, HeaderRule, WorkspaceVariables } from '../../src/types/v5/index';
import { applyBackupRestoreToggle, buildWorkspaceExport, diffWorkspaceExport } from '../../src/workspace-export/index';

const FIXED_TIMESTAMP = '2026-04-27T18:30:00.000Z';

function makeWorkspaceVars(): WorkspaceVariables {
  return { schemaVersion: 5, variables: [] };
}

function baseInput(): Parameters<typeof buildWorkspaceExport>[0] {
  return {
    exportedAt: FIXED_TIMESTAMP,
    exportId: 'e8a1b2c3',
    source: { app: 'extension', appVersion: '5.0.4', platform: 'chrome' },
    scope: 'workspace',
    workspace: { uid: 'a1b2c3d4', name: 'Project' },
    entities: {
      collections: [],
      folders: [],
      rules: [],
      requests: [],
      templates: [],
      environments: [],
      workspaceVars: makeWorkspaceVars(),
      liveWorkflows: [],
      liveVariables: [],
    },
  };
}

function emptyTarget(): Parameters<typeof diffWorkspaceExport>[1] {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
  };
}

function makeCollection(uid: string, name: string, path: string): Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

function makeFolder(uid: string, name: string, path: string): Folder {
  return { schemaVersion: 5, uid, name, path };
}

function makeHeaderRule(uid: string, name: string, path: string): HeaderRule {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
    type: 'header',
    enabled: true,
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
  };
}

function makeEnv(uid: string, name: string): Environment {
  return { schemaVersion: 5, uid, path: `environments/${name}-${uid}`, name, variables: [] };
}

// ── Per-entity collision matrix ────────────────────────────────────

describe('diffWorkspaceExport — Rule collisions', () => {
  it('detects collision-uid', () => {
    const input = baseInput();
    const ruleA = makeHeaderRule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001');
    input.entities.rules = [ruleA];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [makeHeaderRule('rul00001', 'OtherName', 'rules/other-col/other-rul00001')];
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.rules[0].state).toBe('collision-uid');
    expect(diff.rules[0].defaultStrategy).toBe('new-uid');
  });

  it('detects collision-name within the same parent', () => {
    const input = baseInput();
    const rule = makeHeaderRule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001');
    input.entities.rules = [rule];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [makeHeaderRule('rul99999', 'Auth', 'rules/auth-col/auth-rul99999')];
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.rules[0].state).toBe('collision-name');
  });

  it('does NOT detect a collision when names match across different parents', () => {
    const input = baseInput();
    const rule = makeHeaderRule('rul00001', 'Auth', 'rules/coll-a/auth-rul00001');
    input.entities.rules = [rule];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [makeHeaderRule('rul99999', 'Auth', 'rules/coll-b/auth-rul99999')];
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.rules[0].state).toBe('no-collision');
  });

  it('returns no-collision when target has no rules', () => {
    const input = baseInput();
    input.entities.rules = [makeHeaderRule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001')];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    expect(diff.rules[0].state).toBe('no-collision');
  });
});

describe('diffWorkspaceExport — Collection / Folder collisions', () => {
  it('detects collection collision-uid', () => {
    const input = baseInput();
    input.entities.collections = [makeCollection('col00001', 'API', 'rules/api-col00001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.collections = [makeCollection('col00001', 'OtherName', 'rules/other-col00001')];
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.collections[0].state).toBe('collision-uid');
    expect(diff.collections[0].defaultStrategy).toBe('new-uid');
    expect(diff.collections[0].allowedStrategies).toContain('merge-children');
  });

  it('detects folder collision-name within the same collection', () => {
    const input = baseInput();
    input.entities.folders = [makeFolder('fld00001', 'Auth', 'rules/api-col/auth-fld00001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.folders = [makeFolder('fld99999', 'Auth', 'rules/api-col/auth-fld99999')];
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.folders[0].state).toBe('collision-name');
  });
});

describe('diffWorkspaceExport — Environment (workspace-wide match)', () => {
  it('detects collision-name workspace-wide (no parent scoping)', () => {
    const input = baseInput();
    input.entities.environments = [makeEnv('env00001', 'Staging')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.environments = [makeEnv('env99999', 'Staging')];
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.environments[0].state).toBe('collision-name');
    expect(diff.environments[0].allowedStrategies).toContain('merge-vars');
  });
});

describe('diffWorkspaceExport — Singletons', () => {
  it('reports workspaceVars collision when target has any variables', () => {
    const target = emptyTarget();
    target.workspaceVars = { schemaVersion: 5, variables: [{ name: 'X', value: 'y', type: 'default' }] };
    const exp = buildWorkspaceExport(baseInput());
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.workspaceVars.state).toBe('collision-name');
    expect(diff.workspaceVars.targetHasContent).toBe(true);
    expect(diff.workspaceVars.defaultStrategy).toBe('merge-by-name');
  });

  it('reports vault no-collision when target has no secrets', () => {
    const target = emptyTarget();
    target.vault = { schemaVersion: 5, version: 1, secrets: [] };
    const exp = buildWorkspaceExport(baseInput());
    const diff = diffWorkspaceExport(exp, target);
    expect(diff.vault.state).toBe('no-collision');
    expect(diff.vault.targetHasContent).toBe(false);
  });
});

// ── Diverged-target detection ──────────────────────────────────────

describe('diffWorkspaceExport — diverged target', () => {
  it('flags a target whose updatedAt is newer than the export', () => {
    const input = baseInput();
    input.entities.environments = [makeEnv('env00001', 'Staging')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    // Templates + Rules don't carry updatedAt today; only Templates do.
    // Use template path to test divergence detection.
    const t = {
      schemaVersion: 5 as const,
      version: 1,
      uid: 'tpl00001',
      path: 'templates/x-tpl00001',
      name: 'X',
      ruleType: 'header' as const,
      icon: 'shield',
      description: '',
      includes: { conditions: true, formValues: true },
      conditions: [],
      formValues: {},
      createdAt: FIXED_TIMESTAMP,
      // 2 days after the export
      updatedAt: '2026-04-29T18:30:00.000Z',
    };
    input.entities.templates = [t];
    const exp2 = buildWorkspaceExport(input);
    target.templates = [t];
    const diff = diffWorkspaceExport(exp2, target);
    expect(diff.templates[0].state).toBe('collision-uid');
    expect(diff.templates[0].divergedFromExport).toBe(true);
  });
});

// ── Backup-restore toggle ──────────────────────────────────────────

describe('applyBackupRestoreToggle', () => {
  it('flips Rule collision-uid default to update', () => {
    const input = baseInput();
    input.entities.rules = [makeHeaderRule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [makeHeaderRule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001')];
    const diff = applyBackupRestoreToggle(diffWorkspaceExport(exp, target));
    expect(diff.rules[0].defaultStrategy).toBe('update');
  });

  it('does NOT flip when entity is diverged from export', () => {
    const input = baseInput();
    const t = {
      schemaVersion: 5 as const,
      version: 1,
      uid: 'tpl00001',
      path: 'templates/x-tpl00001',
      name: 'X',
      ruleType: 'header' as const,
      icon: 'shield',
      description: '',
      includes: { conditions: true, formValues: true },
      conditions: [],
      formValues: {},
      createdAt: FIXED_TIMESTAMP,
      updatedAt: '2026-04-29T18:30:00.000Z',
    };
    input.entities.templates = [t];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.templates = [t];
    const diff = applyBackupRestoreToggle(diffWorkspaceExport(exp, target));
    expect(diff.templates[0].defaultStrategy).toBe('new-uid');
  });

  it('does NOT flip collision-name (only collision-uid is auto-updated)', () => {
    const input = baseInput();
    input.entities.rules = [makeHeaderRule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [makeHeaderRule('rul99999', 'Auth', 'rules/auth-col/auth-rul99999')];
    const diff = applyBackupRestoreToggle(diffWorkspaceExport(exp, target));
    expect(diff.rules[0].state).toBe('collision-name');
    expect(diff.rules[0].defaultStrategy).toBe('new-uid');
  });
});
