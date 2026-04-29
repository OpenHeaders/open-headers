/**
 * `buildImportPlan` — strategy resolution + force-disable + uid remap.
 *
 * Asserts the per-entity strategies turn into the right `PlanEntry`
 * actions, that `Rule` / `LiveWorkflow` / `LiveVariable` import disabled
 * by default, and that `new-uid` regenerates uids consistently across
 * the tree (collection → folder → entity path remap stays linked).
 */

import { describe, expect, it } from 'vitest';
import type {
  Collection,
  Environment,
  Folder,
  HeaderRule,
  LiveVariable,
  LiveWorkflow,
  Request,
  WorkspaceVariables,
} from '../../src/types/v5/index';
import {
  buildImportPlan,
  buildWorkspaceExport,
  diffWorkspaceExport,
  type StrategyMap,
} from '../../src/workspace-export/index';

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

function rule(uid: string, name: string, path: string, enabled = true): HeaderRule {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
    type: 'header',
    enabled,
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
  };
}

function collection(uid: string, name: string, path: string): Collection {
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

function folder(uid: string, name: string, path: string): Folder {
  return { schemaVersion: 5, uid, name, path };
}

function env(uid: string, name: string): Environment {
  return { schemaVersion: 5, uid, path: `environments/${name}-${uid}`, name, variables: [] };
}

function workflow(uid: string, name: string, enabled = true): LiveWorkflow {
  return {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `live-workflows/${name}-${uid}`,
    name,
    enabled,
    steps: [],
    refresh: { kind: 'manual' },
  };
}

function liveVar(uid: string, name: string, workflowUid: string, enabled = true): LiveVariable {
  return {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `live-variables/${name}-${uid}`,
    name,
    enabled,
    workflowUid,
    stepId: 's1',
    captureName: 'token',
  };
}

// ── Force-disable on import (design §2.2) ─────────────────────────

describe('buildImportPlan — force-disable', () => {
  it('forces Rule.enabled=false even when source had enabled=true', () => {
    const input = baseInput();
    input.entities.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001', true)];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget());
    const created = plan.rules.find((r) => r.action === 'create');
    expect(created).toBeDefined();
    expect(created?.entity.enabled).toBe(false);
  });

  it('preserves Rule.enabled when trustExport is true', () => {
    const input = baseInput();
    input.entities.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001', true)];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget(), {}, { trustExport: true });
    const created = plan.rules.find((r) => r.action === 'create');
    expect(created?.entity.enabled).toBe(true);
  });

  it('strips request scripts when stripScripts=true', () => {
    const input = baseInput();
    const req: Request = {
      schemaVersion: 5,
      version: 1,
      uid: 'req00001',
      path: 'requests/api-req00001',
      name: 'API',
      method: 'GET',
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      preRequestScript: 'pre',
      postResponseScript: 'post',
    };
    input.entities.requests = [req];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget(), {}, { stripScripts: true });
    const created = plan.requests.find((r) => r.action === 'create');
    expect(created?.entity.preRequestScript).toBeUndefined();
    expect(created?.entity.postResponseScript).toBeUndefined();
  });

  it('preserves request scripts when stripScripts is unset', () => {
    const input = baseInput();
    const req: Request = {
      schemaVersion: 5,
      version: 1,
      uid: 'req00001',
      path: 'requests/api-req00001',
      name: 'API',
      method: 'GET',
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      preRequestScript: 'pre',
    };
    input.entities.requests = [req];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget(), {});
    const created = plan.requests.find((r) => r.action === 'create');
    expect(created?.entity.preRequestScript).toBe('pre');
  });

  it('forces LiveWorkflow.enabled=false', () => {
    const input = baseInput();
    input.entities.liveWorkflows = [workflow('wf000001', 'Refresh', true)];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget());
    expect(plan.liveWorkflows[0].entity.enabled).toBe(false);
  });

  it('forces LiveVariable.enabled=false', () => {
    const input = baseInput();
    input.entities.liveWorkflows = [workflow('wf000001', 'Refresh', true)];
    input.entities.liveVariables = [liveVar('lv000001', 'TOKEN', 'wf000001', true)];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget());
    expect(plan.liveVariables[0].entity.enabled).toBe(false);
  });

  it('forces Rule.enabled=false EVEN when strategy is update', () => {
    const input = baseInput();
    input.entities.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001', true)];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001', false)];
    const diff = diffWorkspaceExport(exp, target);
    const strategies: StrategyMap = { rules: { rul00001: 'update' } };
    const plan = buildImportPlan(exp, diff, target, strategies);
    expect(plan.rules[0].action).toBe('update');
    expect(plan.rules[0].entity.enabled).toBe(false);
  });
});

// ── Strategy resolution ────────────────────────────────────────────

describe('buildImportPlan — strategy resolution', () => {
  it('skip strategy emits action=skip', () => {
    const input = baseInput();
    input.entities.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001')];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { rules: { rul00001: 'skip' } });
    expect(plan.rules[0].action).toBe('skip');
  });

  it('update strategy emits action=update with targetUid', () => {
    const input = baseInput();
    input.entities.rules = [rule('rul00001', 'Auth', 'rules/col/auth-rul00001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    // Different uid in target — collision-name match.
    target.rules = [rule('rul99999', 'Auth', 'rules/col/auth-rul99999')];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { rules: { rul00001: 'update' } });
    expect(plan.rules[0].action).toBe('update');
    expect(plan.rules[0].targetUid).toBe('rul99999');
    // Update writes the entity at the matched target's uid.
    expect(plan.rules[0].entity.uid).toBe('rul99999');
  });

  // Note: Rule.version was the Phase-10 stale-draft counter — removed
  // by the sync engine (`docs/SYNC_ENGINE_DESIGN.md` §24). The importer
  // still honors `version` on entities that retain it (Collection,
  // Request, Environment, etc.); rule-specific version-bump cases are
  // gone with the field.

  it('new-uid (default) regenerates the uid + path', () => {
    const input = baseInput();
    input.entities.rules = [rule('rul00001', 'Auth', 'rules/auth-col/auth-rul00001')];
    input.entities.collections = [collection('col00001', 'Auth', 'rules/auth-col')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.rules = [rule('rul00001', 'Other', 'rules/other-col/other-rul00001')];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target);
    const created = plan.rules.find((r) => r.action === 'create');
    expect(created).toBeDefined();
    expect(created?.entity.uid).not.toBe('rul00001');
    expect(created?.entity.uid).toMatch(/^[a-z0-9]{8}$/);
    // uidRemap records the rename.
    expect(plan.uidRemap.rul00001).toBe(created?.entity.uid);
  });
});

// ── Tree-aware new-uid: collection + folder + rule remap together ─

describe('buildImportPlan — tree-aware new-uid', () => {
  it('regenerates a collection + its folder + its rule consistently', () => {
    const input = baseInput();
    input.entities.collections = [collection('col00001', 'API', 'rules/api-col00001')];
    input.entities.folders = [folder('fld00001', 'Auth', 'rules/api-col00001/auth-fld00001')];
    input.entities.rules = [rule('rul00001', 'X-Auth', 'rules/api-col00001/auth-fld00001/x-auth-rul00001')];
    const exp = buildWorkspaceExport(input);

    const target = emptyTarget();
    // Make all three collide so they all default to `new-uid`.
    target.collections = [collection('col00001', 'OtherName', 'rules/other-col')];
    target.folders = [folder('fld00001', 'OtherName', 'rules/other-col/other-fld')];
    target.rules = [rule('rul00001', 'OtherName', 'rules/other-col/other-fld/other-rule')];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target);

    const newCol = plan.collections.find((c) => c.action === 'create');
    const newFolder = plan.folders.find((f) => f.action === 'create');
    const newRule = plan.rules.find((r) => r.action === 'create');
    expect(newCol).toBeDefined();
    expect(newFolder).toBeDefined();
    expect(newRule).toBeDefined();
    if (!newCol || !newFolder || !newRule) throw new Error('unreachable');

    // New folder lives under new collection's path.
    expect(newFolder.entity.path.startsWith(`${newCol.entity.path}/`)).toBe(true);
    // New rule lives under the new folder's path.
    expect(newRule.entity.path.startsWith(`${newFolder.entity.path}/`)).toBe(true);
  });
});

// ── Live-* uidRemap consistency ────────────────────────────────────

describe('buildImportPlan — live workflow + variable rebind through uidRemap', () => {
  it('rebinds LiveVariable.workflowUid to the new workflow uid', () => {
    const input = baseInput();
    input.entities.liveWorkflows = [workflow('wf000001', 'Refresh')];
    input.entities.liveVariables = [liveVar('lv000001', 'TOKEN', 'wf000001')];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.liveWorkflows = [workflow('wf000001', 'OtherWF')];
    target.liveVariables = [liveVar('lv000001', 'OtherLV', 'wf000001')];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target);

    const newWf = plan.liveWorkflows[0].entity;
    const newLv = plan.liveVariables[0].entity;
    expect(newWf.uid).not.toBe('wf000001');
    expect(newLv.workflowUid).toBe(newWf.uid);
  });
});

// ── Singletons ─────────────────────────────────────────────────────

describe('buildImportPlan — singleton resolution', () => {
  it('merge-by-name combines incoming and target workspace variables (incoming wins)', () => {
    const input = baseInput();
    input.entities.workspaceVars = {
      schemaVersion: 5,
      variables: [
        { name: 'A', value: 'incoming-a', type: 'default' },
        { name: 'C', value: 'incoming-c', type: 'default' },
      ],
    };
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.workspaceVars = {
      schemaVersion: 5,
      variables: [
        { name: 'A', value: 'target-a', type: 'default' },
        { name: 'B', value: 'target-b', type: 'default' },
      ],
    };
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target);
    expect(plan.workspaceVars.action).toBe('merge-by-name');
    const byName = Object.fromEntries(plan.workspaceVars.variables.map((v) => [v.name, v.value]));
    expect(byName.A).toBe('incoming-a'); // incoming wins
    expect(byName.B).toBe('target-b');
    expect(byName.C).toBe('incoming-c');
  });

  it('replace strategy ships only the incoming workspace variables', () => {
    const input = baseInput();
    input.entities.workspaceVars = {
      schemaVersion: 5,
      variables: [{ name: 'X', value: 'incoming', type: 'default' }],
    };
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.workspaceVars = {
      schemaVersion: 5,
      variables: [{ name: 'Y', value: 'target', type: 'default' }],
    };
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { workspaceVars: 'replace' });
    expect(plan.workspaceVars.action).toBe('replace');
    expect(plan.workspaceVars.variables).toEqual([{ name: 'X', value: 'incoming', type: 'default' }]);
  });

  it('skip preserves the target workspace variables verbatim', () => {
    const input = baseInput();
    input.entities.workspaceVars = {
      schemaVersion: 5,
      variables: [{ name: 'X', value: 'incoming', type: 'default' }],
    };
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.workspaceVars = {
      schemaVersion: 5,
      variables: [{ name: 'Y', value: 'target', type: 'default' }],
    };
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { workspaceVars: 'skip' });
    expect(plan.workspaceVars.action).toBe('skip');
    expect(plan.workspaceVars.variables).toEqual([{ name: 'Y', value: 'target', type: 'default' }]);
  });

  it('vault stays skipped when the incoming export has no vault block', () => {
    const exp = buildWorkspaceExport(baseInput());
    const target = emptyTarget();
    target.vault = { schemaVersion: 5, secrets: [{ kind: 'string', name: 'X', value: 'y' }] };
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target);
    expect(plan.vault.action).toBe('skip');
    expect(plan.vault.secrets.length).toBe(1);
  });
});

// ── Cross-workspace target=existing ────────────────────────────────

describe('buildImportPlan — cross-workspace fresh import', () => {
  it('creates everything against an empty target', () => {
    const input = baseInput();
    input.entities.collections = [collection('col00001', 'API', 'rules/api-col00001')];
    input.entities.rules = [rule('rul00001', 'X', 'rules/api-col00001/x-rul00001')];
    input.entities.environments = [env('env00001', 'Staging')];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget());
    expect(plan.collections.every((c) => c.action === 'create')).toBe(true);
    expect(plan.rules.every((r) => r.action === 'create')).toBe(true);
    expect(plan.environments.every((e) => e.action === 'create')).toBe(true);
  });
});

// ── Advanced overrides (design §5.5) ──────────────────────────────

describe('buildImportPlan — omitOAuthConfigs', () => {
  it('replaces oauth2 Request.auth with { type: none } when set', () => {
    const input = baseInput();
    const req: Request = {
      schemaVersion: 5,
      version: 1,
      uid: 'req00001',
      path: 'requests/api-req00001',
      name: 'API',
      method: 'GET',
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: {
        type: 'oauth2',
        credentialRef: 'cred-1',
        flow: 'authorization-code-pkce',
        tokenEndpoint: 'https://auth.openheaders.io/token',
        clientId: 'client-1',
        scopes: ['read'],
      },
      body: { type: 'none' },
    };
    input.entities.requests = [req];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget(), {}, { omitOAuthConfigs: true });
    const created = plan.requests.find((r) => r.action === 'create');
    expect(created?.entity.auth).toEqual({ type: 'none' });
  });

  it('leaves non-oauth2 auth untouched even when omitOAuthConfigs=true', () => {
    const input = baseInput();
    const req: Request = {
      schemaVersion: 5,
      version: 1,
      uid: 'req00002',
      path: 'requests/api-req00002',
      name: 'API',
      method: 'GET',
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: { type: 'bearer', token: 'tok' },
      body: { type: 'none' },
    };
    input.entities.requests = [req];
    const exp = buildWorkspaceExport(input);
    const diff = diffWorkspaceExport(exp, emptyTarget());
    const plan = buildImportPlan(exp, diff, emptyTarget(), {}, { omitOAuthConfigs: true });
    const created = plan.requests.find((r) => r.action === 'create');
    expect(created?.entity.auth).toEqual({ type: 'bearer', token: 'tok' });
  });
});

describe('buildImportPlan — keepTargetCollectionOrder', () => {
  it('preserves target order on update when set', () => {
    const input = baseInput();
    input.entities.collections = [{ ...collection('col00001', 'API', 'rules/api-col00001'), order: ['a', 'b', 'c'] }];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.collections = [{ ...collection('col00001', 'API', 'rules/api-col00001'), order: ['z', 'y', 'x'] }];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(
      exp,
      diff,
      target,
      { collections: { col00001: 'update' } },
      { keepTargetCollectionOrder: true },
    );
    expect(plan.collections[0].action).toBe('update');
    expect((plan.collections[0].entity as Collection & { order?: string[] }).order).toEqual(['z', 'y', 'x']);
  });

  it('takes export order on update when keepTargetCollectionOrder is unset', () => {
    const input = baseInput();
    input.entities.collections = [{ ...collection('col00001', 'API', 'rules/api-col00001'), order: ['a', 'b', 'c'] }];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.collections = [{ ...collection('col00001', 'API', 'rules/api-col00001'), order: ['z', 'y', 'x'] }];
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { collections: { col00001: 'update' } });
    expect((plan.collections[0].entity as Collection & { order?: string[] }).order).toEqual(['a', 'b', 'c']);
  });
});
