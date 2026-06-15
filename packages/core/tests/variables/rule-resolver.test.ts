import { beforeEach, describe, expect, it } from 'vitest';
import type { Environment, HeaderRule, RedirectRule, Variable, WorkspaceVariables } from '../../src/types';
import { resolveRule, resolveRuleWithDiagnostics, VariableResolver } from '../../src/variables';

let varCounter = 0;
function makeVariable(name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  varCounter += 1;
  return { uid: `var-${varCounter.toString().padStart(4, '0')}`, name, value, type };
}

function makeWorkspaceVars(vars: Variable[]): WorkspaceVariables {
  return { schemaVersion: 5, variables: vars };
}

function makeEnvironment(name: string, vars: Variable[]): Environment {
  return { schemaVersion: 5, uid: `env-${name}`, name, variables: vars };
}

function makeHeaderRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'r1a2b3c4',
    path: 'rules/test',
    name: 'Test',
    type: 'header',
    enabled: true,
    conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['{{HOST}}'] }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', operation: 'override', headerName: 'X-Token', value: '{{TOKEN}}' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function makeRedirectRule(overrides: Partial<RedirectRule> = {}): RedirectRule {
  return {
    schemaVersion: 5,
    uid: 'r2a3b4c5',
    path: 'rules/redir',
    name: 'Redir',
    type: 'redirect',
    enabled: true,
    conditions: [{ uid: 'cnd00002', type: 'request-domains', values: ['{{HOST}}'] }],
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
        requestHeaders: [{ uid: 'hmd00002', operation: 'override', headerName: '{{HEADER}}', value: '{{TOKEN}}' }],
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
        requestHeaders: [{ uid: 'hmd00003', operation: 'override', headerName: 'X-{{SUFFIX}}', value: '{{TOKEN}}' }],
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
      conditions: [{ uid: 'cnd00003', type: 'request-domains', values: ['{{HOST}}'] }],
      action: {
        requestHeaders: [{ uid: 'hmd00004', operation: 'override', headerName: 'X-Env', value: '{{env.MISSING}}' }],
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
        requestHeaders: [
          { uid: 'hmd00005', operation: 'override', headerName: 'X-Ts', value: '{{dynamic.timestamp}}' },
        ],
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
        requestHeaders: [{ uid: 'hmd00006', operation: 'override', headerName: 'X-File', value: '{{file.fixture}}' }],
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
        requestHeaders: [{ uid: 'hmd00007', operation: 'override', headerName: 'X-Foo', value: '{{foo.X}}' }],
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
        requestHeaders: [{ uid: 'hmd00008', operation: 'override', headerName: 'X-Token', value: '{{env.TOKEN}}' }],
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
      conditions: [{ uid: 'cnd00004', type: 'request-domains', values: ['{{CORP_DOMAIN_LIST}}'] }],
      action: {
        requestHeaders: [{ uid: 'hmd00009', operation: 'override', headerName: 'X-Debug-True', value: 'true' }],
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
      conditions: [{ uid: 'cnd00005', type: 'request-domains', values: ['{{HOSTS}}'] }],
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual(['foo.com', 'bar.com', 'baz.com']);
  });

  it('list expansion does NOT split single-value condition types (url-filter)', () => {
    // url-filter takes a single pattern that may contain commas as part
    // of the URL — splitting would silently corrupt user input.
    resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('PAT', 'https://a.com/path,with,commas')]));
    const rule = makeHeaderRule({
      conditions: [{ uid: 'cnd00006', type: 'url-filter', values: ['{{PAT}}'] }],
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual(['https://a.com/path,with,commas']);
  });

  it('list expansion mixes literal entries + template-expanded entries', () => {
    // The user can have one row with `{{HOSTS}}` AND another row with
    // a literal hostname; both flow through expansion.
    resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('HOSTS', 'a.com,b.com')]));
    const rule = makeHeaderRule({
      conditions: [{ uid: 'cnd00007', type: 'request-domains', values: ['{{HOSTS}}', 'manual.com'] }],
    });
    const { rule: resolved } = resolveRuleWithDiagnostics(rule, resolver);
    expect(resolved.conditions[0].values).toEqual(['a.com', 'b.com', 'manual.com']);
  });

  it('delay rules carry conditions-only diagnostics (no action resolution needed)', () => {
    const rule = {
      schemaVersion: 5 as const,
      uid: 'r3a4b5c6',
      path: 'rules/delay',
      name: 'Delay',
      type: 'delay' as const,
      enabled: true,
      conditions: [{ uid: 'cnd00008', type: 'request-domains' as const, values: ['{{HOST}}'] }],
      action: { delayMs: 500 },
    };
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toHaveLength(1);
    expect(errors[0].reference).toBe('HOST');
  });

  it('ws rules resolve payload + filter value, leaving shape fields untouched', () => {
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([makeVariable('HOST', 'ws.openheaders.io'), makeVariable('SESSION', 's3cr3t')]),
    );
    const rule = {
      schemaVersion: 5 as const,
      uid: 'r4a5b6c7',
      path: 'rules/ws',
      name: 'WS',
      type: 'ws' as const,
      enabled: true,
      conditions: [{ uid: 'cnd00009', type: 'url-filter' as const, values: ['wss://{{HOST}}/*'] }],
      action: {
        operation: 'modify' as const,
        direction: 'send' as const,
        payload: '{"token":"{{SESSION}}"}',
        messageFilter: { matchType: 'contains' as const, value: '{{SESSION}}' },
      },
    };
    const { rule: resolved, errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toEqual([]);
    expect(resolved.conditions[0].values[0]).toBe('wss://ws.openheaders.io/*');
    const action = (resolved as typeof rule).action;
    expect(action.payload).toBe('{"token":"s3cr3t"}');
    expect(action.messageFilter?.value).toBe('s3cr3t');
    expect(action.operation).toBe('modify');
    expect(action.direction).toBe('send');
  });

  it('sse rules resolve payload + eventName', () => {
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([makeVariable('EVENT', 'price-update'), makeVariable('BODY', '{"px":1}')]),
    );
    const rule = {
      schemaVersion: 5 as const,
      uid: 'r5a6b7c8',
      path: 'rules/sse',
      name: 'SSE',
      type: 'sse' as const,
      enabled: true,
      conditions: [{ uid: 'cnd00010', type: 'request-domains' as const, values: ['openheaders.io'] }],
      action: { operation: 'inject' as const, eventName: '{{EVENT}}', payload: '{{BODY}}' },
    };
    const { rule: resolved, errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toEqual([]);
    const action = (resolved as typeof rule).action;
    expect(action.eventName).toBe('price-update');
    expect(action.payload).toBe('{"px":1}');
  });

  it('ws unresolved payload reference surfaces a diagnostic', () => {
    const rule = {
      schemaVersion: 5 as const,
      uid: 'r6a7b8c9',
      path: 'rules/ws-bad',
      name: 'WS bad',
      type: 'ws' as const,
      enabled: true,
      conditions: [{ uid: 'cnd00011', type: 'request-domains' as const, values: ['openheaders.io'] }],
      action: { operation: 'inject' as const, direction: 'receive' as const, payload: '{{MISSING}}' },
    };
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toHaveLength(1);
    expect(errors[0].reference).toBe('MISSING');
  });

  it('auth rules resolve username + password from variables (vault-backed credentials)', () => {
    resolver.setWorkspaceVariables(
      makeWorkspaceVars([makeVariable('PROXY_USER', 'devuser'), makeVariable('PROXY_PW', 's3cr3t-pw')]),
    );
    const rule = {
      schemaVersion: 5 as const,
      uid: 'r7a8b9c0',
      path: 'rules/auth',
      name: 'Auth',
      type: 'auth' as const,
      enabled: true,
      conditions: [{ uid: 'cnd00012', type: 'request-domains' as const, values: ['staging.openheaders.io'] }],
      action: { username: '{{PROXY_USER}}', password: '{{PROXY_PW}}' },
    };
    const { rule: resolved, errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toEqual([]);
    const action = (resolved as typeof rule).action;
    expect(action.username).toBe('devuser');
    expect(action.password).toBe('s3cr3t-pw');
  });

  it('auth unresolved password reference surfaces a diagnostic', () => {
    const rule = {
      schemaVersion: 5 as const,
      uid: 'r8a9b0c1',
      path: 'rules/auth-bad',
      name: 'Auth bad',
      type: 'auth' as const,
      enabled: true,
      conditions: [{ uid: 'cnd00013', type: 'request-domains' as const, values: ['staging.openheaders.io'] }],
      action: { username: 'devuser', password: '{{MISSING_PW}}' },
    };
    const { errors } = resolveRuleWithDiagnostics(rule, resolver);
    expect(errors).toHaveLength(1);
    expect(errors[0].reference).toBe('MISSING_PW');
  });
});
