import { beforeEach, describe, expect, it } from 'vitest';
import type { Environment, HeaderRule, RedirectRule, Variable, WorkspaceVariables } from '../../src/types/v5';
import { resolveRule, resolveRuleWithDiagnostics, VariableResolver } from '../../src/variables';

function makeVariable(name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  return { name, value, type };
}

function makeWorkspaceVars(vars: Variable[]): WorkspaceVariables {
  return { schemaVersion: 5, version: 1, variables: vars };
}

function makeEnvironment(name: string, vars: Variable[]): Environment {
  return { schemaVersion: 5, version: 1, uid: `env-${name}`, name, variables: vars };
}

function makeHeaderRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'r1a2b3c4',
    path: 'rules/test',
    name: 'Test',
    type: 'header',
    enabled: true,
    conditions: [{ type: 'request-domains', values: ['{{HOST}}'] }],
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'X-Token', value: '{{TOKEN}}' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function makeRedirectRule(overrides: Partial<RedirectRule> = {}): RedirectRule {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'r2a3b4c5',
    path: 'rules/redir',
    name: 'Redir',
    type: 'redirect',
    enabled: true,
    conditions: [{ type: 'request-domains', values: ['{{HOST}}'] }],
    action: {
      redirectTo: 'https://{{HOST}}/new',
    },
    ...overrides,
  };
}

describe('resolveRuleWithDiagnostics', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    resolver = new VariableResolver();
  });

  it('returns the resolved rule plus empty error list when every reference resolves', () => {
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([makeVariable('HOST', 'api.openheaders.io'), makeVariable('TOKEN', 'abc123')]),
    );
    const { rule, errors } = resolveRuleWithDiagnostics(makeHeaderRule(), resolver);
    expect(errors).toEqual([]);
    expect(rule.conditions[0].values[0]).toBe('api.openheaders.io');
    expect((rule as HeaderRule).action.requestHeaders[0].value).toBe('abc123');
  });

  it('resolves `{{var}}` segments inside header names', () => {
    // The DNR builder validates the resolved header name — the
    // resolver has to substitute templates in `headerName` alongside
    // `value`, otherwise the runtime would see `X-{{env.suffix}}` and
    // skip the rule.
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([
        makeVariable('HOST', 'api.openheaders.io'),
        makeVariable('HEADER', 'X-Auth-Token'),
        makeVariable('TOKEN', 'abc'),
      ]),
    );
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ operation: 'override', headerName: '{{HEADER}}', value: '{{TOKEN}}' }],
        responseHeaders: [],
      },
    });
    const { rule: resolved, errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toEqual([]);
    expect((resolved as HeaderRule).action.requestHeaders[0].headerName).toBe('X-Auth-Token');
    expect((resolved as HeaderRule).action.requestHeaders[0].value).toBe('abc');
  });

  it('resolves mixed literal + template header names', () => {
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([
        makeVariable('HOST', 'api.openheaders.io'),
        makeVariable('SUFFIX', 'Debug'),
        makeVariable('TOKEN', 'abc'),
      ]),
    );
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-{{SUFFIX}}', value: '{{TOKEN}}' }],
        responseHeaders: [],
      },
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect((resolved as HeaderRule).action.requestHeaders[0].headerName).toBe('X-Debug');
  });

  it('reports a single error per unresolved reference (deduped across fields)', () => {
    resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('HOST', 'api.openheaders.io')]));
    // {{TOKEN}} is referenced in the header value only
    const { errors } = resolveRuleWithDiagnostics(makeHeaderRule(), resolver);
    expect(errors).toHaveLength(1);
    expect(errors[0].reference).toBe('TOKEN');
    expect(errors[0].reason).toBe('unresolved');
  });

  it('dedupes identical references appearing in multiple fields', () => {
    // {{HOST}} appears in conditions + action.matchPattern + action.redirectTo
    const { errors } = resolveRuleWithDiagnostics(makeRedirectRule(), resolver);
    expect(errors).toHaveLength(1);
    expect(errors[0].reference).toBe('HOST');
  });

  it('distinguishes namespaced vs flat references', () => {
    // Two unresolved refs: {{env.MISSING}} and flat {{HOST}}
    const rule = makeHeaderRule({
      conditions: [{ type: 'request-domains', values: ['{{HOST}}'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Env', value: '{{env.MISSING}}' }],
        responseHeaders: [],
      },
    });
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    const refs = errors.map((e) => e.reference).sort();
    expect(refs).toEqual(['HOST', 'env.MISSING']);
  });

  it('reserved-namespace references (dynamic) surface with reason reserved-namespace', () => {
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Ts', value: '{{dynamic.timestamp}}' }],
        responseHeaders: [],
      },
    });
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    const err = errors.find((e) => e.reference === 'dynamic.timestamp');
    expect(err?.reason).toBe('reserved-namespace');
  });

  it('unregistered {{file.X}} surfaces as unset-in-scope (not reserved)', () => {
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-File', value: '{{file.fixture}}' }],
        responseHeaders: [],
      },
    });
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    const fileErr = errors.find((e) => e.reference === 'file.fixture');
    expect(fileErr?.reason).toBe('unset-in-scope');
    expect(fileErr?.namespace).toBe('file');
  });

  it('unknown-namespace references surface with reason unknown-namespace', () => {
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Foo', value: '{{foo.X}}' }],
        responseHeaders: [],
      },
    });
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    const err = errors.find((e) => e.reference === 'foo.X');
    expect(err?.reason).toBe('unknown-namespace');
  });

  it('unset-in-scope when env.X is referenced but env has no X', () => {
    resolver.setEnvironments([makeEnvironment('staging', [makeVariable('HOST', 'api.openheaders.io')])]);
    resolver.setActiveEnvironmentId('env-staging');
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Token', value: '{{env.TOKEN}}' }],
        responseHeaders: [],
      },
    });
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    const err = errors.find((e) => e.reference === 'env.TOKEN');
    expect(err?.reason).toBe('unset-in-scope');
  });

  it('resolveRule (legacy) stays as a thin drop-errors wrapper', () => {
    // Same unresolved input — resolveRule returns the rule, no errors surface.
    const out = resolveRule(makeHeaderRule(), resolver);
    expect(out.conditions[0].values[0]).toBe('{{HOST}}');
  });

  it('list-shaped variable expands across multiple values for request-domains', () => {
    // Real-world case: env var holds a comma-separated host list. Without
    // post-resolution split, Chrome receives a single
    // 'a.com,b.com,c.com' entry in requestDomains and atomically rejects
    // the whole updateDynamicRules call.
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([
        makeVariable('CORP_DOMAIN_LIST', 'development.api.openheaders.io,portal.corp,intranet,localhost'),
      ]),
    );
    const rule = makeHeaderRule({
      conditions: [{ type: 'request-domains', values: ['{{CORP_DOMAIN_LIST}}'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Debug-True', value: 'true' }],
        responseHeaders: [],
      },
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual([
      'development.api.openheaders.io',
      'portal.corp',
      'intranet',
      'localhost',
    ]);
  });

  it('list expansion handles whitespace + newlines + extra commas', () => {
    resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('HOSTS', '  foo.com ,bar.com\n , , baz.com\n ')]));
    const rule = makeHeaderRule({
      conditions: [{ type: 'request-domains', values: ['{{HOSTS}}'] }],
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual(['foo.com', 'bar.com', 'baz.com']);
  });

  it('list expansion does NOT split single-value condition types (url-filter)', () => {
    // url-filter takes a single pattern that may contain commas as part
    // of the URL — splitting would silently corrupt user input.
    resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('PAT', 'https://a.com/path,with,commas')]));
    const rule = makeHeaderRule({
      conditions: [{ type: 'url-filter', values: ['{{PAT}}'] }],
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual(['https://a.com/path,with,commas']);
  });

  it('list expansion mixes literal entries + template-expanded entries', () => {
    // The user can have one row with `{{HOSTS}}` AND another row with
    // a literal hostname; both flow through expansion.
    resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('HOSTS', 'a.com,b.com')]));
    const rule = makeHeaderRule({
      conditions: [{ type: 'request-domains', values: ['{{HOSTS}}', 'manual.com'] }],
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual(['a.com', 'b.com', 'manual.com']);
  });

  it('delay rules carry conditions-only diagnostics (no action resolution needed)', () => {
    const rule = {
      schemaVersion: 5 as const,
      version: 1,
      uid: 'r3a4b5c6',
      path: 'rules/delay',
      name: 'Delay',
      type: 'delay' as const,
      enabled: true,
      conditions: [{ type: 'request-domains' as const, values: ['{{HOST}}'] }],
      action: { delayMs: 500 },
    };
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toHaveLength(1);
    expect(errors[0].reference).toBe('HOST');
  });
});
