import type { Collection, Environment } from '@openheaders/core/types';
import {
  buildScopeEditorDispatch,
  buildVariableEditorDispatch,
  type DispatchVariable,
  type ScopeEditorContext,
  type ScopeEditorOpeners,
} from '@/workbench/components/panels/scope-editor-dispatch';
import { describe, expect, it, vi } from 'vitest';

function coll(uid: string, path: string): Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name: path.split('/').pop() ?? path,
    variables: [],
    defaultEnvironmentId: null,
    pinnedEnvironmentIds: [],
  } as Collection;
}

const RULE_COLL = coll('rc', 'rules/A');
const REQ_COLL = coll('qc', 'requests/A');
const TPL_COLL = coll('tc', 'templates/A');

const ENV_PROD: Environment = {
  schemaVersion: 5,
  uid: 'env-prod',
  name: 'prod',
  variables: [],
} as Environment;
const ENV_STAGE: Environment = {
  schemaVersion: 5,
  uid: 'env-stage',
  name: 'stage',
  variables: [],
} as Environment;

const BASE_CTX: ScopeEditorContext = {
  activeCollectionId: null,
  families: {
    ruleCollections: [RULE_COLL],
    requestCollections: [REQ_COLL],
    templateCollections: [TPL_COLL],
  },
  activeEnvironmentId: null,
  defaultEnvironmentId: null,
  environments: [ENV_PROD, ENV_STAGE],
  liveVariables: [{ uid: 'lv-1', name: 'TOKEN' }],
};

function makeOpeners(): ScopeEditorOpeners & {
  vault: ReturnType<typeof vi.fn>;
  workspace: ReturnType<typeof vi.fn>;
  liveList: ReturnType<typeof vi.fn>;
  liveEdit: ReturnType<typeof vi.fn>;
  envEdit: ReturnType<typeof vi.fn>;
  ruleColl: ReturnType<typeof vi.fn>;
  reqColl: ReturnType<typeof vi.fn>;
  tplColl: ReturnType<typeof vi.fn>;
} {
  const vault = vi.fn();
  const workspace = vi.fn();
  const liveList = vi.fn();
  const liveEdit = vi.fn();
  const envEdit = vi.fn();
  const ruleColl = vi.fn();
  const reqColl = vi.fn();
  const tplColl = vi.fn();
  return {
    vault,
    workspace,
    liveList,
    liveEdit,
    envEdit,
    ruleColl,
    reqColl,
    tplColl,
    onOpenVault: vault,
    onOpenWorkspaceVariables: workspace,
    onOpenLiveVariables: liveList,
    onOpenLiveVariableEdit: liveEdit,
    onOpenEnvironmentEdit: envEdit,
    onOpenRuleCollectionVariables: ruleColl,
    onOpenRequestCollectionVariables: reqColl,
    onOpenTemplateCollectionVariables: tplColl,
  };
}

describe('buildScopeEditorDispatch', () => {
  it('routes the singleton scopes (vault / workspace / live) to their list openers', () => {
    const o = makeOpeners();
    const dispatch = buildScopeEditorDispatch(o, BASE_CTX);
    dispatch('vault')?.();
    dispatch('workspace')?.();
    dispatch('live')?.();
    expect(o.vault).toHaveBeenCalledOnce();
    expect(o.workspace).toHaveBeenCalledOnce();
    expect(o.liveList).toHaveBeenCalledOnce();
  });

  it('routes environment scope to the active env when one is selected', () => {
    const o = makeOpeners();
    const dispatch = buildScopeEditorDispatch(o, { ...BASE_CTX, activeEnvironmentId: 'env-prod' });
    dispatch('environment')?.();
    expect(o.envEdit).toHaveBeenCalledWith('env-prod', 'prod');
  });

  it('falls back to the default env when no active env is selected', () => {
    const o = makeOpeners();
    const dispatch = buildScopeEditorDispatch(o, { ...BASE_CTX, defaultEnvironmentId: 'env-stage' });
    dispatch('environment')?.();
    expect(o.envEdit).toHaveBeenCalledWith('env-stage', 'stage');
  });

  it('returns null for environment when neither active nor default is set', () => {
    const o = makeOpeners();
    const dispatch = buildScopeEditorDispatch(o, BASE_CTX);
    expect(dispatch('environment')).toBeNull();
  });

  it('routes collection scope to the right family', () => {
    for (const [collId, family, key] of [
      ['rc', 'rule', 'ruleColl'],
      ['qc', 'request', 'reqColl'],
      ['tc', 'template', 'tplColl'],
    ] as const) {
      const o = makeOpeners();
      const dispatch = buildScopeEditorDispatch(o, { ...BASE_CTX, activeCollectionId: collId });
      dispatch('collection')?.();
      expect(o[key], `family=${family} should fire ${key}`).toHaveBeenCalledOnce();
      // Other families must NOT fire — the bug pre-session-49 was that
      // request + template collections silently routed to the rule
      // editor.
      const others = (['ruleColl', 'reqColl', 'tplColl'] as const).filter((k) => k !== key);
      for (const k of others) expect(o[k], `family=${family} should NOT fire ${k}`).not.toHaveBeenCalled();
    }
  });

  it('returns null for collection when activeCollectionId is missing', () => {
    const o = makeOpeners();
    const dispatch = buildScopeEditorDispatch(o, BASE_CTX);
    expect(dispatch('collection')).toBeNull();
  });

  it('returns null when the corresponding opener is not wired', () => {
    const dispatch = buildScopeEditorDispatch({}, BASE_CTX);
    expect(dispatch('vault')).toBeNull();
    expect(dispatch('workspace')).toBeNull();
    expect(dispatch('live')).toBeNull();
  });
});

describe('buildVariableEditorDispatch', () => {
  it('routes a live row with a known uid to the per-LV editor (not the list)', () => {
    const o = makeOpeners();
    const dispatch = buildVariableEditorDispatch(o, BASE_CTX);
    const variable: DispatchVariable = { scope: 'live', liveVariableUid: 'lv-1' };
    dispatch(variable, 'TOKEN')?.();
    expect(o.liveEdit).toHaveBeenCalledWith('lv-1', 'TOKEN');
    expect(o.liveList).not.toHaveBeenCalled();
  });

  it('falls back to the live list when the row carries no uid AND the registry has no match', () => {
    const o = makeOpeners();
    const dispatch = buildVariableEditorDispatch(o, { ...BASE_CTX, liveVariables: [] });
    const variable: DispatchVariable = { scope: 'live' };
    dispatch(variable, 'UNKNOWN')?.();
    expect(o.liveEdit).not.toHaveBeenCalled();
    expect(o.liveList).toHaveBeenCalledOnce();
  });

  it('uses the live registry to look up uid by name when the row did not carry one', () => {
    const o = makeOpeners();
    const dispatch = buildVariableEditorDispatch(o, BASE_CTX);
    const variable: DispatchVariable = { scope: 'live' };
    dispatch(variable, 'TOKEN')?.();
    expect(o.liveEdit).toHaveBeenCalledWith('lv-1', 'TOKEN');
  });

  it('non-live rows delegate to the section-level dispatch unchanged', () => {
    const o = makeOpeners();
    const dispatch = buildVariableEditorDispatch(o, { ...BASE_CTX, activeCollectionId: 'qc' });
    const variable: DispatchVariable = { scope: 'collection' };
    dispatch(variable, 'BASE_URL')?.();
    expect(o.reqColl).toHaveBeenCalledWith('qc', 'A');
    expect(o.ruleColl).not.toHaveBeenCalled();
    expect(o.tplColl).not.toHaveBeenCalled();
  });
});
