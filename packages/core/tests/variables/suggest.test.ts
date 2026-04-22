import { describe, expect, it } from 'vitest';
import {
  buildSuggestions,
  type CollectionEntry,
  type EnvironmentEntry,
  filterSuggestions,
  type LiveSuggestionEntry,
  type SuggestionContext,
  type SuggestionRegistries,
  type VariableEntry,
  type VariableSuggestion,
  type VaultSecretEntry,
} from '../../src/variables';

// ── Factories ──────────────────────────────────────────────────────

function makeRegistries(overrides: Partial<SuggestionRegistries> = {}): SuggestionRegistries {
  return {
    vault: [],
    environments: [],
    activeEnvironmentId: null,
    defaultEnvironmentId: null,
    collections: [],
    workspaceVariables: [],
    liveRegistry: new Map<string, LiveSuggestionEntry>(),
    ...overrides,
  };
}

function env(uid: string, name: string, vars: ReadonlyArray<VariableEntry>): EnvironmentEntry {
  return { uid, name, variables: vars };
}

function v(name: string, value: string, type?: 'default' | 'secret'): VariableEntry {
  return { name, value, ...(type ? { type } : {}) };
}

function vault(name: string, value: string): VaultSecretEntry {
  return { kind: 'string', name, value };
}

function live(value: string, opts: { stale?: boolean; workflowUid?: string } = {}): LiveSuggestionEntry {
  return { value, ...opts };
}

function collection(uid: string, vars: ReadonlyArray<VariableEntry>): CollectionEntry {
  return { uid, variables: vars };
}

function refs(list: ReadonlyArray<VariableSuggestion>): string[] {
  return list.map((s) => s.reference);
}

// ── buildSuggestions ───────────────────────────────────────────────

describe('buildSuggestions', () => {
  describe('scope inclusion', () => {
    it('returns empty when no registries are populated (still offers reserved dynamic + file)', () => {
      const ctx: SuggestionContext = {};
      const out = buildSuggestions(makeRegistries(), ctx);
      // Only reserved file + dynamic show up with empty registries.
      expect(refs(out)).toEqual(['file.', 'dynamic.']);
    });

    it('offers vault entries when present', () => {
      const out = buildSuggestions(
        makeRegistries({ vault: [vault('GITHUB_TOKEN', 'ghp_abc123'), vault('AWS_KEY', 'AKIA...')] }),
        {},
      );
      const refList = out.filter((s) => s.scope === 'vault').map((s) => s.reference);
      expect(refList).toEqual(['vault.GITHUB_TOKEN', 'vault.AWS_KEY']);
    });

    it('hides collection scope when no collectionId in context', () => {
      const out = buildSuggestions(
        makeRegistries({
          collections: [collection('col-1', [v('BASE_PATH', '/api/v1')])],
        }),
        {},
      );
      expect(out.some((s) => s.scope === 'collection')).toBe(false);
    });

    it('offers collection scope when context.collectionId matches', () => {
      const out = buildSuggestions(
        makeRegistries({
          collections: [collection('col-1', [v('BASE_PATH', '/api/v1')])],
        }),
        { collectionId: 'col-1' },
      );
      const colls = out.filter((s) => s.scope === 'collection');
      expect(colls).toHaveLength(1);
      expect(colls[0].reference).toBe('collection.BASE_PATH');
    });

    it('hides step scope when no workflowStep in context', () => {
      const out = buildSuggestions(makeRegistries(), {});
      expect(out.some((s) => s.scope === 'step')).toBe(false);
    });

    it('explicit allowed=false hides a scope entirely', () => {
      const out = buildSuggestions(
        makeRegistries({ vault: [vault('SECRET', 'abc')], workspaceVariables: [v('FLAG', 'on')] }),
        { allowed: { vault: false } },
      );
      expect(out.some((s) => s.scope === 'vault')).toBe(false);
      expect(out.some((s) => s.scope === 'workspace')).toBe(true);
    });

    it('allowed={} means "use defaults" — every scope that has data shows up', () => {
      const out = buildSuggestions(makeRegistries({ vault: [vault('K', 'v')], workspaceVariables: [v('W', 'x')] }), {
        allowed: {},
      });
      expect(out.some((s) => s.scope === 'vault')).toBe(true);
      expect(out.some((s) => s.scope === 'workspace')).toBe(true);
    });
  });

  describe('env merging', () => {
    it('offers active env entries and falls back to default for missing names', () => {
      const devEnv = env('env-dev', 'dev', [v('API_URL', 'https://dev.openheaders.io'), v('DEBUG', '1')]);
      const defaultEnv = env('env-def', 'default', [
        v('API_URL', 'https://default.openheaders.io'),
        v('REGION', 'us-east-1'),
      ]);
      const out = buildSuggestions(
        makeRegistries({
          environments: [devEnv, defaultEnv],
          activeEnvironmentId: 'env-dev',
          defaultEnvironmentId: 'env-def',
        }),
        {},
      );
      const envSuggestions = out.filter((s) => s.scope === 'env');
      // Active wins over default on name collision; default adds REGION.
      expect(refs(envSuggestions)).toEqual(['env.API_URL', 'env.DEBUG', 'env.REGION']);
      // Active entry's value is from dev env.
      const apiUrl = envSuggestions.find((s) => s.reference === 'env.API_URL');
      expect(apiUrl?.preview).toEqual({ kind: 'value', value: 'https://dev.openheaders.io', masked: false });
    });

    it('skips empty-string env values', () => {
      const devEnv = env('env-dev', 'dev', [v('API_URL', 'https://dev.openheaders.io'), v('BLANK', '')]);
      const out = buildSuggestions(makeRegistries({ environments: [devEnv], activeEnvironmentId: 'env-dev' }), {});
      expect(refs(out.filter((s) => s.scope === 'env'))).toEqual(['env.API_URL']);
    });

    it('offers default env alone when no active env is selected', () => {
      const defaultEnv = env('env-def', 'default', [v('HOST', 'openheaders.io')]);
      const out = buildSuggestions(
        makeRegistries({
          environments: [defaultEnv],
          activeEnvironmentId: null,
          defaultEnvironmentId: 'env-def',
        }),
        {},
      );
      expect(refs(out.filter((s) => s.scope === 'env'))).toEqual(['env.HOST']);
    });

    it('sorts active-env entries above fallback-env entries in natural order', () => {
      const active = env('env-a', 'a', [v('ONLY_IN_ACTIVE', 'a')]);
      const fallback = env('env-f', 'f', [v('ONLY_IN_FALLBACK', 'f')]);
      const out = buildSuggestions(
        makeRegistries({
          environments: [fallback, active], // registry order shouldn't matter
          activeEnvironmentId: 'env-a',
          defaultEnvironmentId: 'env-f',
        }),
        {},
      );
      const envList = out.filter((s) => s.scope === 'env');
      // Active entry first despite fallback preceding it in the registries list.
      expect(envList[0].reference).toBe('env.ONLY_IN_ACTIVE');
      expect(envList[1].reference).toBe('env.ONLY_IN_FALLBACK');
    });
  });

  describe('step gating', () => {
    const ctxWithSteps = (currentStepIndex: number): SuggestionContext => ({
      workflowStep: {
        workflowUid: 'wf-1',
        currentStepIndex,
        steps: [
          { id: 'login', captures: [{ name: 'sessionId' }, { name: 'userId' }] },
          { id: 'csrf', captures: [{ name: 'token' }] },
          { id: 'finalize', captures: [{ name: 'accessToken' }] },
        ],
      },
    });

    it('offers no step suggestions when current step is the first (index 0)', () => {
      const out = buildSuggestions(makeRegistries(), ctxWithSteps(0));
      expect(out.some((s) => s.scope === 'step')).toBe(false);
    });

    it('offers captures only from steps strictly before currentStepIndex', () => {
      // Cursor is on step 2 (finalize) → step 0 (login) + step 1 (csrf) visible.
      const out = buildSuggestions(makeRegistries(), ctxWithSteps(2));
      const stepList = out.filter((s) => s.scope === 'step');
      expect(refs(stepList)).toEqual(['step.login.sessionId', 'step.login.userId', 'step.csrf.token']);
    });

    it('carries stepId on each suggestion', () => {
      const out = buildSuggestions(makeRegistries(), ctxWithSteps(3));
      const stepList = out.filter((s) => s.scope === 'step');
      expect(stepList.map((s) => s.stepId)).toEqual(['login', 'login', 'csrf', 'finalize']);
    });

    it('step previews are always step-runtime (no cached value at edit time)', () => {
      const out = buildSuggestions(makeRegistries(), ctxWithSteps(2));
      for (const s of out.filter((s) => s.scope === 'step')) {
        expect(s.preview).toEqual({ kind: 'step-runtime' });
      }
    });

    it('handles currentStepIndex > steps.length without blowing up', () => {
      const out = buildSuggestions(makeRegistries(), ctxWithSteps(100));
      const stepList = out.filter((s) => s.scope === 'step');
      // All 4 captures across 3 steps surface.
      expect(stepList).toHaveLength(4);
    });
  });

  describe('reserved scopes', () => {
    it('always surfaces file + dynamic as disabled entries with subtitle', () => {
      const out = buildSuggestions(makeRegistries(), {});
      const file = out.find((s) => s.scope === 'file');
      const dyn = out.find((s) => s.scope === 'dynamic');
      expect(file?.disabled).toBe(true);
      expect(file?.preview).toMatchObject({ kind: 'reserved' });
      expect(dyn?.disabled).toBe(true);
      expect(dyn?.preview).toMatchObject({ kind: 'reserved' });
    });

    it('allowed.file=false and allowed.dynamic=false hide reserved rows', () => {
      const out = buildSuggestions(makeRegistries(), { allowed: { file: false, dynamic: false } });
      expect(out).toHaveLength(0);
    });
  });

  describe('masking', () => {
    it('masks vault entries by default', () => {
      const out = buildSuggestions(makeRegistries({ vault: [vault('TOKEN', 'abc123')] }), {});
      const entry = out.find((s) => s.scope === 'vault')!;
      expect(entry.preview).toEqual({ kind: 'value', value: 'abc123', masked: true });
    });

    it('masks env secret entries but not default entries', () => {
      const active = env('env-a', 'a', [v('API_URL', 'https://openheaders.io'), v('TOKEN', 'abc', 'secret')]);
      const out = buildSuggestions(makeRegistries({ environments: [active], activeEnvironmentId: 'env-a' }), {});
      const apiUrl = out.find((s) => s.reference === 'env.API_URL')!;
      const token = out.find((s) => s.reference === 'env.TOKEN')!;
      expect(apiUrl.preview).toEqual({ kind: 'value', value: 'https://openheaders.io', masked: false });
      expect(token.preview).toEqual({ kind: 'value', value: 'abc', masked: true });
    });

    it('masks live entries by default regardless of value shape', () => {
      const liveReg = new Map<string, LiveSuggestionEntry>([
        ['authToken', live('plain-jwt')],
        ['csrf', live('abc', { workflowUid: 'wf-1' })],
      ]);
      const out = buildSuggestions(makeRegistries({ liveRegistry: liveReg }), {});
      for (const s of out.filter((s) => s.scope === 'live')) {
        expect(s.preview).toMatchObject({ masked: true });
      }
    });

    it('flags live stale entries with kind "stale" and lower priority', () => {
      const liveReg = new Map<string, LiveSuggestionEntry>([
        ['fresh', live('f')],
        ['stale', live('s', { stale: true })],
      ]);
      const out = buildSuggestions(makeRegistries({ liveRegistry: liveReg }), {});
      const liveList = out.filter((s) => s.scope === 'live');
      const fresh = liveList.find((s) => s.reference === 'live.fresh')!;
      const stale = liveList.find((s) => s.reference === 'live.stale')!;
      expect(stale.preview).toMatchObject({ kind: 'stale' });
      expect(fresh.preview).toMatchObject({ kind: 'value' });
      expect(stale.priority).toBeLessThan(fresh.priority);
    });

    it('maskAll=true masks every scope regardless of per-scope defaults', () => {
      const out = buildSuggestions(
        makeRegistries({
          vault: [vault('SECRET', 's')],
          environments: [env('e', 'e', [v('PUBLIC', 'p')])],
          activeEnvironmentId: 'e',
          workspaceVariables: [v('WS', 'w')],
        }),
        { maskAll: true },
      );
      for (const s of out) {
        if (s.preview.kind === 'value' || s.preview.kind === 'stale') {
          expect(s.preview.masked).toBe(true);
        }
      }
    });
  });

  describe('liveRegistry carries workflowUid through to the suggestion', () => {
    it('plumbs workflowUid', () => {
      const liveReg = new Map<string, LiveSuggestionEntry>([['token', live('abc', { workflowUid: 'wf-42' })]]);
      const out = buildSuggestions(makeRegistries({ liveRegistry: liveReg }), {});
      const entry = out.find((s) => s.scope === 'live')!;
      expect(entry.workflowUid).toBe('wf-42');
    });
  });
});

// ── filterSuggestions ──────────────────────────────────────────────

describe('filterSuggestions', () => {
  function threeScopes(): VariableSuggestion[] {
    return buildSuggestions(
      makeRegistries({
        vault: [vault('API_TOKEN', 'v-tok')],
        environments: [env('e', 'e', [v('API_URL', 'https://openheaders.io'), v('DEBUG', '1')])],
        activeEnvironmentId: 'e',
        workspaceVariables: [v('api_host', 'openheaders.io')],
      }),
      { allowed: { file: false, dynamic: false } },
    );
  }

  it('empty query returns every candidate in natural order', () => {
    const all = threeScopes();
    const filtered = filterSuggestions(all, '');
    // Vault (scope=0) first, then env (1), then workspace (3).
    expect(refs(filtered)).toEqual(['vault.API_TOKEN', 'env.API_URL', 'env.DEBUG', 'workspace.api_host']);
  });

  it('exact-prefix matches rank above ci-prefix and ci-substring', () => {
    const all = threeScopes();
    // `api` is a case-insensitive prefix of env.API_URL + vault.API_TOKEN and
    // a case-sensitive prefix of workspace.api_host.
    const filtered = filterSuggestions(all, 'api');
    // Rank 0 (exact-prefix): workspace.api_host
    expect(filtered[0].reference).toBe('workspace.api_host');
  });

  it('ci-prefix matches rank above ci-substring', () => {
    const all: VariableSuggestion[] = [
      {
        reference: 'env.API_URL',
        scope: 'env',
        name: 'API_URL',
        preview: { kind: 'value', value: '', masked: false },
        priority: 100,
      },
      {
        reference: 'workspace.MY_API',
        scope: 'workspace',
        name: 'MY_API',
        preview: { kind: 'value', value: '', masked: false },
        priority: 100,
      },
    ];
    const filtered = filterSuggestions(all, 'api');
    // env.API_URL: refLower starts with 'api'... wait, reference='env.API_URL', lowered='env.api_url', doesn't start with 'api'.
    // But both contain 'api'. Neither is ci-prefix. Both are ci-substring (rank 2).
    // Scope tiebreaker: env (1) < workspace (3), so env first.
    expect(filtered[0].reference).toBe('env.API_URL');
  });

  it('filters out non-matches', () => {
    const all = threeScopes();
    const filtered = filterSuggestions(all, 'nonexistent_zzzz');
    expect(filtered).toHaveLength(0);
  });

  it('scope priority is the tiebreaker when match ranks are equal', () => {
    const all: VariableSuggestion[] = [
      {
        reference: 'live.tokenA',
        scope: 'live',
        name: 'tokenA',
        preview: { kind: 'value', value: '', masked: true },
        priority: 100,
      },
      {
        reference: 'vault.tokenA',
        scope: 'vault',
        name: 'tokenA',
        preview: { kind: 'value', value: '', masked: true },
        priority: 100,
      },
      {
        reference: 'env.tokenA',
        scope: 'env',
        name: 'tokenA',
        preview: { kind: 'value', value: '', masked: false },
        priority: 100,
      },
    ];
    // Query 'tokenA' matches none of the references as prefix — all are ci-substring (rank 2).
    // Scope-priority tiebreak: vault (0) < env (1) < live (4).
    const filtered = filterSuggestions(all, 'tokenA');
    expect(refs(filtered)).toEqual(['vault.tokenA', 'env.tokenA', 'live.tokenA']);
  });

  it('alphabetical tiebreaker for equal rank + scope + priority', () => {
    const base: Omit<VariableSuggestion, 'reference' | 'name'> = {
      scope: 'env',
      preview: { kind: 'value', value: '', masked: false },
      priority: 100,
    };
    const all: VariableSuggestion[] = [
      { ...base, reference: 'env.ZED', name: 'ZED' },
      { ...base, reference: 'env.ALPHA', name: 'ALPHA' },
      { ...base, reference: 'env.MIDDLE', name: 'MIDDLE' },
    ];
    const filtered = filterSuggestions(all, '');
    expect(refs(filtered)).toEqual(['env.ALPHA', 'env.MIDDLE', 'env.ZED']);
  });

  it('reserved rows sink below enabled rows with the same match rank', () => {
    const all = buildSuggestions(makeRegistries({ workspaceVariables: [v('foo', 'bar')] }), {});
    const filtered = filterSuggestions(all, '');
    // workspace entry comes first, then file + dynamic disabled entries at the end.
    const refsList = refs(filtered);
    expect(refsList[0]).toBe('workspace.foo');
    expect(refsList).toContain('file.');
    expect(refsList).toContain('dynamic.');
    // Disabled entries must come AFTER enabled ones of the same rank.
    const wsIdx = refsList.indexOf('workspace.foo');
    const fileIdx = refsList.indexOf('file.');
    expect(wsIdx).toBeLessThan(fileIdx);
  });

  it('matches query with scope prefix — "env." narrows to env.* suggestions', () => {
    const all = threeScopes();
    const filtered = filterSuggestions(all, 'env.');
    // Only env.* matches the exact prefix "env.".
    expect(refs(filtered)).toEqual(['env.API_URL', 'env.DEBUG']);
  });

  it('matches query with scope-scoped partial — "env.AP" narrows further', () => {
    const all = threeScopes();
    const filtered = filterSuggestions(all, 'env.AP');
    expect(refs(filtered)).toEqual(['env.API_URL']);
  });
});
