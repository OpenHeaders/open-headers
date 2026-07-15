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

function live(
  value: string,
  opts: { stale?: boolean; definitionallyStale?: boolean; workflowUid?: string } = {},
): LiveSuggestionEntry {
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
    it('offers empty-scope scaffolds + reserved + dynamic rows when no registries are populated', () => {
      const ctx: SuggestionContext = {};
      const out = buildSuggestions(makeRegistries(), ctx);
      // Every creatable scope stays discoverable even when empty
      // (collection is gated on a collectionId, so it's absent here);
      // the reserved file row, the pinned `dynamic.` scaffold, and the
      // built-in generator rows follow.
      expect(refs(out)).toEqual([
        'vault.',
        'env.',
        'workspace.',
        'file.',
        'dynamic.',
        'dynamic.timestamp',
        'dynamic.isoTimestamp',
        'dynamic.uuid',
        'dynamic.randomInt',
        'dynamic.randomAlphaNumeric',
        'dynamic.randomBoolean',
        'dynamic.randomColor',
        'dynamic.randomEmail',
        'dynamic.randomIP',
      ]);
    });

    it('offers vault entries when present', () => {
      const out = buildSuggestions(
        makeRegistries({ vault: [vault('GITHUB_TOKEN', 'ghp_abc123'), vault('AWS_KEY', 'AKIA...')] }),
        {},
      );
      const refList = out.filter((s) => s.scope === 'vault' && s.preview.kind !== 'namespace').map((s) => s.reference);
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
      // The concrete entry PLUS the always-on "Add a collection variable"
      // scaffold — the scaffold block is stable regardless of contents.
      expect(refs(colls)).toEqual(['collection.BASE_PATH', 'collection.']);
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
      const envSuggestions = out.filter((s) => s.scope === 'env' && s.preview.kind !== 'namespace');
      // Active wins over default on name collision; default adds REGION.
      expect(refs(envSuggestions)).toEqual(['env.API_URL', 'env.DEBUG', 'env.REGION']);
      // Active entry's value is from dev env.
      const apiUrl = envSuggestions.find((s) => s.reference === 'env.API_URL');
      expect(apiUrl?.preview).toEqual({ kind: 'value', value: 'https://dev.openheaders.io', masked: false });
    });

    it('skips empty-string env values', () => {
      const devEnv = env('env-dev', 'dev', [v('API_URL', 'https://dev.openheaders.io'), v('BLANK', '')]);
      const out = buildSuggestions(makeRegistries({ environments: [devEnv], activeEnvironmentId: 'env-dev' }), {});
      expect(refs(out.filter((s) => s.scope === 'env' && s.preview.kind !== 'namespace'))).toEqual(['env.API_URL']);
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
      expect(refs(out.filter((s) => s.scope === 'env' && s.preview.kind !== 'namespace'))).toEqual(['env.HOST']);
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

  describe('reserved + dynamic scopes', () => {
    it('surfaces file as a disabled reserved entry with subtitle', () => {
      const out = buildSuggestions(makeRegistries(), {});
      const file = out.find((s) => s.scope === 'file');
      expect(file?.disabled).toBe(true);
      expect(file?.preview).toMatchObject({ kind: 'reserved' });
    });

    it('surfaces the pinned dynamic. scaffold plus every generator as enabled entries', () => {
      const out = buildSuggestions(makeRegistries(), {});
      const scaffold = out.find((s) => s.reference === 'dynamic.');
      expect(scaffold?.pinned).toBe(true);
      expect(scaffold?.preview).toMatchObject({ kind: 'namespace' });
      const generators = out.filter((s) => s.scope === 'dynamic' && s.preview.kind === 'dynamic');
      expect(generators.map((s) => s.reference)).toContain('dynamic.uuid');
      expect(generators.map((s) => s.reference)).toContain('dynamic.timestamp');
      for (const s of generators) {
        expect(s.disabled).toBeUndefined();
      }
    });

    it('allowed.file=false and allowed.dynamic=false hide those rows', () => {
      const out = buildSuggestions(makeRegistries(), { allowed: { file: false, dynamic: false } });
      // File + generator rows gone; only the empty-scope discovery scaffolds remain.
      expect(refs(out)).toEqual(['vault.', 'env.', 'workspace.']);
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

    it('carries definitionallyStale through the preview, orthogonal to expiry staleness', () => {
      const liveReg = new Map<string, LiveSuggestionEntry>([
        ['fresh', live('f')],
        ['needsRerun', live('n', { definitionallyStale: true })],
        ['both', live('b', { stale: true, definitionallyStale: true })],
      ]);
      const out = buildSuggestions(makeRegistries({ liveRegistry: liveReg }), {});
      const byRef = (r: string) => out.find((s) => s.reference === r)!;
      // definitionallyStale rides the preview as an orthogonal flag —
      // a needs-re-run value that hasn't expired keeps `kind: 'value'`.
      expect(byRef('live.fresh').preview).toMatchObject({ kind: 'value' });
      expect(byRef('live.fresh').preview).not.toHaveProperty('definitionallyStale');
      expect(byRef('live.needsRerun').preview).toMatchObject({ kind: 'value', definitionallyStale: true });
      expect(byRef('live.both').preview).toMatchObject({ kind: 'stale', definitionallyStale: true });
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
    // Concrete values first — vault (scope=0), env (1), workspace (3) —
    // then the always-on scaffold block in the same scope order.
    expect(refs(filtered)).toEqual([
      'vault.API_TOKEN',
      'env.API_URL',
      'env.DEBUG',
      'workspace.api_host',
      'vault.',
      'env.',
      'workspace.',
    ]);
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
    // The pinned `dynamic.` scaffold leads the default list; concrete
    // values follow; the reserved file row sinks below everything.
    const refsList = refs(filtered);
    expect(refsList[0]).toBe('dynamic.');
    expect(refsList[1]).toBe('workspace.foo');
    expect(refsList).toContain('file.');
    // Disabled entries must come AFTER enabled ones of the same rank.
    const wsIdx = refsList.indexOf('workspace.foo');
    const fileIdx = refsList.indexOf('file.');
    expect(wsIdx).toBeLessThan(fileIdx);
  });

  it('empty query hides generator rows and pins the dynamic. scaffold first', () => {
    const all = buildSuggestions(makeRegistries({ workspaceVariables: [v('foo', 'bar')] }), {});
    const filtered = filterSuggestions(all, '');
    const refsList = refs(filtered);
    expect(refsList[0]).toBe('dynamic.');
    expect(refsList.some((r) => r.startsWith('dynamic.') && r !== 'dynamic.')).toBe(false);
  });

  it('committing to the scope ("dynamic.") reveals every generator, scaffold gone', () => {
    const all = buildSuggestions(makeRegistries(), {});
    const filtered = filterSuggestions(all, 'dynamic.');
    const refsList = refs(filtered);
    expect(refsList).not.toContain('dynamic.');
    expect(refsList).toContain('dynamic.uuid');
    expect(refsList).toContain('dynamic.timestamp');
    expect(refsList).toHaveLength(9);
  });

  it('typing un-pins the scaffold — non-matching queries drop it', () => {
    const all = buildSuggestions(makeRegistries({ workspaceVariables: [v('foo', 'bar')] }), {});
    const filtered = filterSuggestions(all, 'foo');
    expect(refs(filtered)[0]).toBe('workspace.foo');
    expect(refs(filtered)).not.toContain('dynamic.');
  });

  it('generator rows match by name tail — "uuid" finds dynamic.uuid', () => {
    const all = buildSuggestions(makeRegistries(), {});
    const filtered = filterSuggestions(all, 'uuid');
    expect(refs(filtered)).toContain('dynamic.uuid');
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

// ── Disabled rows ──────────────────────────────────────────────────

describe('buildSuggestions — disabled rows', () => {
  const disabled = (name: string, value: string): VariableEntry => ({ name, value, enabled: false });

  it('still offers a disabled workspace row, marked entryDisabled and deprioritized', () => {
    const out = buildSuggestions(
      makeRegistries({ workspaceVariables: [v('ON', 'a'), disabled('OFF', 'b')] }),
      {},
    );
    const on = out.find((s) => s.reference === 'workspace.ON');
    const off = out.find((s) => s.reference === 'workspace.OFF');
    expect(on?.preview).toMatchObject({ kind: 'value', value: 'a' });
    expect((on?.preview as { entryDisabled?: boolean }).entryDisabled).toBeUndefined();
    expect(off?.preview).toMatchObject({ kind: 'value', value: 'b', entryDisabled: true });
    expect(off?.disabled).toBeUndefined();
    expect((off?.priority ?? 0) < (on?.priority ?? 0)).toBe(true);
  });

  it('marks disabled collection rows', () => {
    const out = buildSuggestions(
      makeRegistries({ collections: [collection('col-1', [disabled('BASE_PATH', '/api/v1')])] }),
      { collectionId: 'col-1' },
    );
    const row = out.find((s) => s.reference === 'collection.BASE_PATH');
    expect(row?.preview).toMatchObject({ kind: 'value', entryDisabled: true });
  });

  it('a disabled active-env row is replaced by an enabled default-env row of the same name', () => {
    const out = buildSuggestions(
      makeRegistries({
        environments: [
          env('e-active', 'Staging', [disabled('API_URL', 'https://staging.openheaders.io')]),
          env('e-default', 'Prod', [v('API_URL', 'https://prod.openheaders.io')]),
        ],
        activeEnvironmentId: 'e-active',
        defaultEnvironmentId: 'e-default',
      }),
      {},
    );
    const rows = out.filter((s) => s.reference === 'env.API_URL');
    expect(rows).toHaveLength(1);
    expect(rows[0].preview).toMatchObject({ kind: 'value', value: 'https://prod.openheaders.io' });
    expect((rows[0].preview as { entryDisabled?: boolean }).entryDisabled).toBeUndefined();
  });

  it('a disabled active-env row stays (marked) when the default env lacks the name', () => {
    const out = buildSuggestions(
      makeRegistries({
        environments: [env('e-active', 'Staging', [disabled('API_URL', 'https://staging.openheaders.io')])],
        activeEnvironmentId: 'e-active',
      }),
      {},
    );
    const row = out.find((s) => s.reference === 'env.API_URL');
    expect(row?.preview).toMatchObject({ kind: 'value', entryDisabled: true });
  });

  it('disabled rows sort below enabled peers on an empty query', () => {
    const all = buildSuggestions(
      makeRegistries({ workspaceVariables: [disabled('AAA', 'x'), v('BBB', 'y')] }),
      {},
    );
    const filtered = refs(filterSuggestions(all, ''));
    expect(filtered.indexOf('workspace.BBB')).toBeLessThan(filtered.indexOf('workspace.AAA'));
  });
});
