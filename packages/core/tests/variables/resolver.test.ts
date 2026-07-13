import { beforeEach, describe, expect, it } from 'vitest';
import type { Environment, Variable, Vault, WorkspaceVariables } from '../../src/types';
import { type ResolvedLiveValue, resolveTemplate, VariableResolver } from '../../src/variables';

// ── Factories ──────────────────────────────────────────────────────

let varCounter = 0;
function makeVariable(name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  varCounter += 1;
  return { uid: `var-${varCounter.toString().padStart(4, '0')}`, name, value, type };
}

let envCounter = 0;
function makeEnvironment(name: string, vars: Variable[]): Environment {
  envCounter += 1;
  return { schemaVersion: 5, uid: `env-${envCounter}`, name, variables: vars };
}

let secretCounter = 0;
function makeVault(secrets: Array<{ name: string; value: string }>): Vault {
  return {
    schemaVersion: 5,
    secrets: secrets.map((s) => {
      secretCounter += 1;
      return {
        uid: `sec-${secretCounter.toString().padStart(4, '0')}`,
        kind: 'string' as const,
        name: s.name,
        value: s.value,
      };
    }),
  };
}

function makeWorkspaceVars(vars: Variable[]): WorkspaceVariables {
  return { schemaVersion: 5, variables: vars };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('VariableResolver', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    resolver = new VariableResolver();
  });

  describe('resolve — scope priority', () => {
    it('returns null for unknown variable', () => {
      expect(resolver.resolve('NONEXISTENT')).toBeNull();
    });

    it('resolves from globals (lowest priority)', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('API_URL', 'https://api.openheaders.io')]));

      const result = resolver.resolve('API_URL');
      expect(result).toEqual({
        name: 'API_URL',
        value: 'https://api.openheaders.io',
        scope: 'workspace',
        isSensitive: false,
      });
    });

    it('resolves from active environment over globals', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('BASE_URL', 'https://global.openheaders.io')]));
      const dev = makeEnvironment('Development', [makeVariable('BASE_URL', 'https://dev.openheaders.io')]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);

      const result = resolver.resolve('BASE_URL');
      expect(result?.value).toBe('https://dev.openheaders.io');
      expect(result?.scope).toBe('environment');
    });

    it('resolves from environment over collection (env has higher priority)', () => {
      const dev = makeEnvironment('Dev', [makeVariable('VERSION', 'v2')]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);
      resolver.setCollectionVariables('coll-1', [makeVariable('VERSION', 'v3')]);

      const result = resolver.resolve('VERSION', { collectionId: 'coll-1' });
      expect(result?.value).toBe('v2');
      expect(result?.scope).toBe('environment');
    });

    it('falls through to collection when environment has no value', () => {
      const dev = makeEnvironment('Dev', []);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);
      resolver.setCollectionVariables('coll-1', [makeVariable('VERSION', 'v3')]);

      const result = resolver.resolve('VERSION', { collectionId: 'coll-1' });
      expect(result?.value).toBe('v3');
      expect(result?.scope).toBe('collection');
    });

    it('resolves from vault over everything', () => {
      const dev = makeEnvironment('Dev', [makeVariable('SECRET_KEY', 'from-env')]);
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('SECRET_KEY', 'from-globals')]));
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);
      resolver.setCollectionVariables('coll-1', [makeVariable('SECRET_KEY', 'from-collection')]);
      resolver.setVault(makeVault([{ name: 'SECRET_KEY', value: 'from-vault' }]));

      const result = resolver.resolve('SECRET_KEY', { collectionId: 'coll-1' });
      expect(result?.value).toBe('from-vault');
      expect(result?.scope).toBe('vault');
      expect(result?.isSensitive).toBe(true);
    });

    it('falls through to lower scope when higher scope has empty value', () => {
      const dev = makeEnvironment('Dev', [makeVariable('TOKEN', '')]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('TOKEN', 'fallback')]));

      const result = resolver.resolve('TOKEN');
      expect(result?.value).toBe('fallback');
      expect(result?.scope).toBe('workspace');
    });

    it('skips vault secrets with empty value', () => {
      resolver.setVault(makeVault([{ name: 'KEY', value: '' }]));
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('KEY', 'from-globals')]));

      const result = resolver.resolve('KEY');
      expect(result?.value).toBe('from-globals');
      expect(result?.scope).toBe('workspace');
    });

    it('resolves nothing from environment when no active env is set ("no environment" state)', () => {
      const dev = makeEnvironment('Dev', [makeVariable('X', 'v')]);
      resolver.setEnvironments([dev]);
      // activeEnvironmentId stays null by default — Postman "no environment" semantics.
      expect(resolver.resolve('X')).toBeNull();
    });

    it('uses specific environment via context override', () => {
      const dev = makeEnvironment('Dev', [makeVariable('URL', 'https://dev.openheaders.io')]);
      const prod = makeEnvironment('Prod', [makeVariable('URL', 'https://prod.openheaders.io')]);
      resolver.setEnvironments([dev, prod]);
      resolver.setActiveEnvironmentId(dev.uid);

      const result = resolver.resolve('URL', { environmentId: prod.uid });
      expect(result?.value).toBe('https://prod.openheaders.io');
    });

    it('an explicit null override forces "No environment" over a configured active env', () => {
      const dev = makeEnvironment('Dev', [makeVariable('URL', 'https://dev.openheaders.io')]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);

      expect(resolver.resolve('URL', { environmentId: null })).toBeNull();
      // Absent override still defers to the configured active env.
      expect(resolver.resolve('URL', {})?.value).toBe('https://dev.openheaders.io');
    });

    it('an explicit null override still resolves lower scopes and the default env', () => {
      const dev = makeEnvironment('Dev', [makeVariable('URL', 'https://dev.openheaders.io')]);
      const fallback = makeEnvironment('Fallback', [makeVariable('URL', 'https://fallback.openheaders.io')]);
      resolver.setEnvironments([dev, fallback]);
      resolver.setActiveEnvironmentId(dev.uid);
      resolver.setDefaultEnvironmentId(fallback.uid);
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('HOST', 'ws.openheaders.io')]));

      // Same semantics as a null active pointer: default-env fallback
      // and lower scopes stay live under "No environment".
      expect(resolver.resolve('URL', { environmentId: null })?.value).toBe('https://fallback.openheaders.io');
      expect(resolver.resolve('HOST', { environmentId: null })?.scope).toBe('workspace');
    });

    it('{{env.X}} honors the explicit null override', () => {
      const dev = makeEnvironment('Dev', [makeVariable('URL', 'https://dev.openheaders.io')]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);

      expect(resolver.resolveScoped('URL', 'env', { environmentId: null })).toBeNull();
      expect(resolver.resolveScoped('URL', 'env', {})?.value).toBe('https://dev.openheaders.io');
    });

    it('marks secret variables correctly', () => {
      const dev = makeEnvironment('Dev', [makeVariable('API_KEY', 'sk-123', 'secret')]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);

      const result = resolver.resolve('API_KEY');
      expect(result?.isSensitive).toBe(true);
    });

    it('does not use collection scope without context', () => {
      resolver.setCollectionVariables('coll-1', [makeVariable('ONLY_IN_COLLECTION', 'value')]);

      const result = resolver.resolve('ONLY_IN_COLLECTION');
      expect(result).toBeNull();
    });
  });

  describe('resolveTemplate', () => {
    it('resolves a simple template', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('NAME', 'OpenHeaders')]));

      const { result, variables } = resolver.resolveTemplate('Hello {{NAME}}!');
      expect(result).toBe('Hello OpenHeaders!');
      expect(variables).toHaveLength(1);
      expect(variables[0]).toEqual({
        name: 'NAME',
        resolved: true,
        value: 'OpenHeaders',
        scope: 'workspace',
        isSensitive: false,
      });
    });

    it('resolves multiple variables', () => {
      resolver.setWorkspaceVariables(
        makeWorkspaceVars([makeVariable('HOST', 'api.openheaders.io'), makeVariable('VERSION', 'v2')]),
      );

      const { result } = resolver.resolveTemplate('https://{{HOST}}/{{VERSION}}/users');
      expect(result).toBe('https://api.openheaders.io/v2/users');
    });

    it('leaves unresolved variables as-is', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('KNOWN', 'yes')]));

      const { result, variables } = resolver.resolveTemplate('{{KNOWN}} and {{UNKNOWN}}');
      expect(result).toBe('yes and {{UNKNOWN}}');
      expect(variables).toHaveLength(2);
      expect(variables.find((v) => v.name === 'UNKNOWN')?.resolved).toBe(false);
    });

    it('handles template with no variables', () => {
      const { result, variables } = resolver.resolveTemplate('plain text');
      expect(result).toBe('plain text');
      expect(variables).toHaveLength(0);
    });

    it('handles duplicate variable references', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('X', 'val')]));

      const { result, variables } = resolver.resolveTemplate('{{X}} and {{X}}');
      expect(result).toBe('val and val');
      expect(variables).toHaveLength(1); // deduped
    });

    it('handles whitespace in variable names', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('MY_VAR', 'trimmed')]));

      const { result } = resolver.resolveTemplate('{{ MY_VAR }}');
      expect(result).toBe('trimmed');
    });

    it('resolves comma-separated domain lists', () => {
      const dev = makeEnvironment('Dev', [
        makeVariable('DOMAINS', '*.dev.openheaders.io,staging.openheaders.io,localhost:3000'),
      ]);
      resolver.setEnvironments([dev]);
      resolver.setActiveEnvironmentId(dev.uid);

      const { result } = resolver.resolveTemplate('{{DOMAINS}}');
      expect(result).toBe('*.dev.openheaders.io,staging.openheaders.io,localhost:3000');
    });
  });

  describe('extractVariableNames', () => {
    it('extracts all variable names', () => {
      const names = resolver.extractVariableNames('{{A}} and {{B}} and {{A}}');
      expect(names).toEqual(['A', 'B']); // deduped
    });

    it('returns empty array for plain text', () => {
      expect(resolver.extractVariableNames('no vars here')).toEqual([]);
    });
  });

  describe('allResolved / getUnresolved', () => {
    it('returns true when all variables are resolved', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('A', '1'), makeVariable('B', '2')]));
      expect(resolver.allResolved('{{A}} {{B}}')).toBe(true);
    });

    it('returns false when any variable is unresolved', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('A', '1')]));
      expect(resolver.allResolved('{{A}} {{B}}')).toBe(false);
    });

    it('lists unresolved variables', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('A', '1')]));
      expect(resolver.getUnresolved('{{A}} {{B}} {{C}}')).toEqual(['B', 'C']);
    });
  });

  describe('scope management', () => {
    it('removeCollectionVariables clears collection scope', () => {
      resolver.setCollectionVariables('coll-1', [makeVariable('X', 'val')]);
      expect(resolver.resolve('X', { collectionId: 'coll-1' })?.value).toBe('val');

      resolver.removeCollectionVariables('coll-1');
      expect(resolver.resolve('X', { collectionId: 'coll-1' })).toBeNull();
    });
  });
});

describe('resolveTemplate (standalone)', () => {
  it('works with a custom lookup function', () => {
    const lookup = (name: string) => {
      if (name === 'TOKEN') return { name, value: 'abc123', scope: 'vault' as const, isSensitive: true };
      return null;
    };

    const { result, variables } = resolveTemplate('Bearer {{TOKEN}}', lookup);
    expect(result).toBe('Bearer abc123');
    expect(variables[0].scope).toBe('vault');
  });

  it('leaves references with unknown namespaces literal', () => {
    const lookup = () => null;
    const { result, variables } = resolveTemplate('{{foo.X}}', lookup);
    expect(result).toBe('{{foo.X}}');
    expect(variables[0]).toEqual({ name: 'foo.X', resolved: false });
  });
});

describe('VariableResolver — explicit namespaces', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    resolver = new VariableResolver();
    resolver.setVault({
      schemaVersion: 5,
      secrets: [{ uid: 'sec-token', kind: 'string', name: 'TOKEN', value: 'vault-token' }],
    });
    resolver.setEnvironments([
      {
        schemaVersion: 5,
        uid: 'e-staging',
        name: 'staging',
        variables: [{ uid: 'var-api-url', name: 'API_URL', value: 'https://api.staging', type: 'default' }],
      },
    ]);
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setWorkspaceVariables({
      schemaVersion: 5,
      variables: [{ uid: 'var-ws-token', name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });
    resolver.setCollectionVariables('coll-1', [
      { uid: 'var-region', name: 'REGION', value: 'eu-west-1', type: 'default' },
    ]);
  });

  it('{{vault.X}} resolves only from the vault', () => {
    const { result, variables } = resolver.resolveTemplate('Bearer {{vault.TOKEN}}');
    expect(result).toBe('Bearer vault-token');
    expect(variables[0]).toMatchObject({ name: 'vault.TOKEN', resolved: true, scope: 'vault' });
  });

  it('{{env.X}} resolves only from the active environment', () => {
    const { result } = resolver.resolveTemplate('{{env.API_URL}}');
    expect(result).toBe('https://api.staging');
  });

  it('{{env.X}} does not fall through to lower scopes', () => {
    // TOKEN exists in vault + workspace but NOT in the active env.
    const { result, variables } = resolver.resolveTemplate('{{env.TOKEN}}');
    expect(result).toBe('{{env.TOKEN}}');
    expect(variables[0]).toEqual({ name: 'env.TOKEN', resolved: false });
  });

  it('{{collection.X}} resolves only from the named collection', () => {
    const { result } = resolver.resolveTemplate('{{collection.REGION}}', { collectionId: 'coll-1' });
    expect(result).toBe('eu-west-1');
  });

  it('{{workspace.X}} resolves only from workspace vars', () => {
    const { result } = resolver.resolveTemplate('{{workspace.TOKEN}}');
    expect(result).toBe('ws-token');
  });

  it('flat {{X}} still walks the 4-scope chain (backward compat)', () => {
    const { result } = resolver.resolveTemplate('{{TOKEN}}');
    expect(result).toBe('vault-token'); // vault wins in the chain
  });

  it('{{file.X}} with no registry leaves literal + marks unresolved', () => {
    const { result, variables } = resolver.resolveTemplate('{{file.fixture.json}}');
    expect(result).toBe('{{file.fixture.json}}');
    expect(variables[0]).toEqual({ name: 'file.fixture.json', resolved: false });
  });

  it('{{dynamic.uuid}} resolves to a fresh generated UUID', () => {
    const { result, variables, errors } = resolver.resolveTemplate('{{dynamic.uuid}}');
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(errors).toEqual([]);
    expect(variables[0]).toMatchObject({ name: 'dynamic.uuid', resolved: true, scope: 'dynamic' });
  });

  it('{{dynamic.nope}} surfaces unset-in-scope (unknown generator)', () => {
    const { result, errors } = resolver.resolveTemplate('{{dynamic.nope}}');
    expect(result).toBe('{{dynamic.nope}}');
    expect(errors[0]).toMatchObject({ reason: 'unset-in-scope', namespace: 'dynamic' });
  });

  it('{{foo.X}} is left literal (unknown namespace)', () => {
    const { result, variables } = resolver.resolveTemplate('{{foo.X}}');
    expect(result).toBe('{{foo.X}}');
    expect(variables[0]).toEqual({ name: 'foo.X', resolved: false });
  });
});

describe('VariableResolver — default environment fallback', () => {
  let resolver: VariableResolver;

  let envVarCounter = 0;
  const makeEnv = (uid: string, name: string, vars: Array<[string, string]>): Environment => ({
    schemaVersion: 5,
    uid,
    name,
    variables: vars.map(([n, v]) => {
      envVarCounter += 1;
      return { uid: `var-env-${envVarCounter}`, name: n, value: v, type: 'default' as const };
    }),
  });

  beforeEach(() => {
    resolver = new VariableResolver();
    resolver.setEnvironments([
      makeEnv('e-default', 'default', [
        ['API_URL', 'https://api.default'],
        ['TIMEOUT', '30'],
      ]),
      makeEnv('e-staging', 'staging', [['API_URL', 'https://api.staging']]),
    ]);
  });

  it('falls back to default env when active env is missing the variable', () => {
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setDefaultEnvironmentId('e-default');

    // TIMEOUT only exists in default.
    const out = resolver.resolve('TIMEOUT');
    expect(out?.value).toBe('30');
    expect(out?.scope).toBe('environment');
  });

  it('active env wins over default when both define the variable', () => {
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setDefaultEnvironmentId('e-default');

    const out = resolver.resolve('API_URL');
    expect(out?.value).toBe('https://api.staging');
  });

  it('resolves from default env even when no active env is selected', () => {
    resolver.setActiveEnvironmentId(null);
    resolver.setDefaultEnvironmentId('e-default');

    const out = resolver.resolve('TIMEOUT');
    expect(out?.value).toBe('30');
  });

  it('does not fall back when default env is not configured', () => {
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setDefaultEnvironmentId(null);

    expect(resolver.resolve('TIMEOUT')).toBeNull();
  });

  it('setDefaultEnvironmentId(null) disables the fallback', () => {
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setDefaultEnvironmentId('e-default');
    expect(resolver.resolve('TIMEOUT')?.value).toBe('30');

    resolver.setDefaultEnvironmentId(null);
    expect(resolver.resolve('TIMEOUT')).toBeNull();
  });

  it('{{env.X}} also falls back to default env for scoped lookups', () => {
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setDefaultEnvironmentId('e-default');
    const { result } = resolver.resolveTemplate('{{env.TIMEOUT}}');
    expect(result).toBe('30');
  });

  it('default == active is not double-checked', () => {
    resolver.setActiveEnvironmentId('e-default');
    resolver.setDefaultEnvironmentId('e-default');
    // Behaviorally identical to "no default configured" — single lookup.
    expect(resolver.resolve('TIMEOUT')?.value).toBe('30');
    expect(resolver.resolve('NOPE')).toBeNull();
  });
});

describe('VariableResolver — structured resolution errors', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    resolver = new VariableResolver();
    resolver.setWorkspaceVariables({
      schemaVersion: 5,
      variables: [{ uid: 'var-known', name: 'KNOWN', value: 'v', type: 'default' }],
    });
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setDefaultEnvironmentId('e-default');
  });

  it('emits an unresolved error for a flat unknown variable', () => {
    const { errors } = resolver.resolveTemplate('{{UNKNOWN}}');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      reference: 'UNKNOWN',
      reason: 'unresolved',
      namespace: null,
      variableName: 'UNKNOWN',
      activeEnvironmentId: 'e-staging',
      defaultEnvironmentId: 'e-default',
    });
    expect(errors[0].hint).toMatch(/vault, environment/);
  });

  it('emits an unset-in-scope error for explicit env lookup missing the key', () => {
    const { errors } = resolver.resolveTemplate('{{env.API_URL}}');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      reference: 'env.API_URL',
      reason: 'unset-in-scope',
      namespace: 'env',
      variableName: 'API_URL',
    });
    expect(errors[0].hint).toMatch(/Environments/);
  });

  it('emits an unknown-namespace error for {{foo.X}}', () => {
    const { errors } = resolver.resolveTemplate('{{foo.X}}');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      reference: 'foo.X',
      reason: 'unknown-namespace',
      namespace: 'unknown',
    });
    expect(errors[0].hint).toMatch(/Valid namespaces/);
  });

  it('emits an unset-in-scope error for {{file.X}} when no file is registered', () => {
    const { errors } = resolver.resolveTemplate('{{file.fixture.json}}');
    expect(errors[0]).toMatchObject({
      reference: 'file.fixture.json',
      reason: 'unset-in-scope',
      namespace: 'file',
    });
    expect(errors[0].hint).toMatch(/Upload this file|sha256/);
  });

  it('resolves {{file.X}} to the content hash when the file is registered', () => {
    resolver.setFileRegistry([
      {
        fileId: 'file:test-fixture',
        hash: 'sha256:abc1234567890abc1234567890abc1234567890abc1234567890abc12345678',
        filename: 'fixture.json',
        size: 42,
      },
    ]);
    const { result, errors } = resolver.resolveTemplate('{{file.fixture.json}}');
    expect(errors).toEqual([]);
    expect(result).toBe('sha256:abc1234567890abc1234567890abc1234567890abc1234567890abc12345678');
  });

  it('resolves {{file.sha256:xxx}} directly by hash (bypasses filename lookup)', () => {
    const hash = 'sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    resolver.setFileRegistry([{ fileId: 'file:test-invoice', hash, filename: 'invoice.pdf', size: 1024 }]);
    const { result, errors } = resolver.resolveTemplate(`{{file.${hash}}}`);
    expect(errors).toEqual([]);
    expect(result).toBe(hash);
  });

  it('{{file.X}} does NOT participate in the flat {{X}} walk', () => {
    // Flat {{X}} must never find a file by name — files are always
    // explicit via the {{file.X}} form so URL/header values can't
    // accidentally substitute a filename.
    resolver.setFileRegistry([
      { fileId: 'file:test-api-url', hash: `sha256:${'a'.repeat(64)}`, filename: 'API_URL', size: 10 },
    ]);
    const r = resolver.resolve('API_URL');
    expect(r).toBeNull();
  });

  it('flat {{X}} still resolves from other scopes when a same-named file exists', () => {
    resolver.setEnvironments([makeEnvironment('E', [makeVariable('SHARED_NAME', 'from-env')])]);
    resolver.setActiveEnvironmentId(`env-${envCounter}`);
    resolver.setFileRegistry([
      { fileId: 'file:test-shared', hash: `sha256:${'a'.repeat(64)}`, filename: 'SHARED_NAME', size: 1 },
    ]);
    expect(resolver.resolve('SHARED_NAME')?.value).toBe('from-env');
  });

  it('emits an unset-in-scope error for an unknown {{dynamic.*}} generator', () => {
    const { errors } = resolver.resolveTemplate('{{dynamic.notAGenerator}}');
    expect(errors[0]).toMatchObject({ reason: 'unset-in-scope', namespace: 'dynamic' });
    expect(errors[0].hint).toMatch(/generator/);
  });

  it('emits an unset-in-scope error for {{live.X}} when no live registry is set', () => {
    const { errors } = resolver.resolveTemplate('{{live.authToken}}');
    expect(errors[0]).toMatchObject({
      reference: 'live.authToken',
      reason: 'unset-in-scope',
      namespace: 'live',
      variableName: 'authToken',
    });
    expect(errors[0].hint).toMatch(/Live Variable/);
  });

  it('resolves {{live.X}} against the registered LiveRegistry', () => {
    const registry = new Map<string, ResolvedLiveValue>([
      ['authToken', { value: 'token-42', workflowUid: 'wf-abc12345' }],
    ]);
    resolver.setLiveRegistry(registry);
    const { result, errors, variables } = resolver.resolveTemplate('Bearer {{live.authToken}}');
    expect(result).toBe('Bearer token-42');
    expect(errors).toEqual([]);
    expect(variables[0]).toMatchObject({
      name: 'live.authToken',
      resolved: true,
      value: 'token-42',
      scope: 'live',
      // Default sensitive=true — live values are typically tokens.
      isSensitive: true,
    });
  });

  it('honors registry-level isSensitive override for {{live.X}}', () => {
    resolver.setLiveRegistry(
      new Map([['buildId', { value: 'abc-123', workflowUid: 'wf-xyz98765', isSensitive: false }]]),
    );
    const { variables } = resolver.resolveTemplate('{{live.buildId}}');
    expect(variables[0]).toMatchObject({ value: 'abc-123', isSensitive: false });
  });

  it('{{live.X}} does NOT participate in the flat {{X}} walk', () => {
    // A live registry entry named "API_URL" must not leak into flat
    // `{{X}}` lookups — the explicit `{{live.X}}` form is the only
    // route to live values (same discipline as `{{file.X}}`).
    resolver.setLiveRegistry(new Map([['API_URL', { value: 'from-live', workflowUid: 'wf-11111111' }]]));
    expect(resolver.resolve('API_URL')).toBeNull();
  });

  it('emits step-out-of-context for {{step.X.Y}} without an installed context', () => {
    const { errors } = resolver.resolveTemplate('{{step.login.sessionId}}');
    expect(errors[0]).toMatchObject({
      reference: 'step.login.sessionId',
      reason: 'step-out-of-context',
      namespace: 'step',
    });
    expect(errors[0].hint).toMatch(/only valid inside a Live Workflow step/);
  });

  it('resolves {{step.X.Y}} when a step-capture context is installed', () => {
    resolver.setStepCaptures(new Map([['login', new Map([['sessionId', 'sess-1234']])]]));
    const { result, errors } = resolver.resolveTemplate('sid={{step.login.sessionId}}');
    expect(result).toBe('sid=sess-1234');
    expect(errors).toEqual([]);
  });

  it('emits unset-in-scope for {{step.X.Y}} when the stepId is missing from the context', () => {
    resolver.setStepCaptures(new Map()); // context installed but empty
    const { errors } = resolver.resolveTemplate('{{step.login.sessionId}}');
    expect(errors[0]).toMatchObject({
      reason: 'unset-in-scope',
      namespace: 'step',
    });
    expect(errors[0].hint).toMatch(/workflow step/);
  });

  it('emits unset-in-scope for {{step.X.Y}} when the captureName is missing', () => {
    resolver.setStepCaptures(new Map([['login', new Map([['otherCapture', 'x']])]]));
    const { errors } = resolver.resolveTemplate('{{step.login.sessionId}}');
    expect(errors[0]).toMatchObject({
      reason: 'unset-in-scope',
      namespace: 'step',
    });
  });

  it('emits unset-in-scope for malformed step refs like {{step.login}} (no capture name)', () => {
    // `parseStepRefName` rejects single-segment names — the resolver's
    // `step` branch returns null (unset-in-scope), not a parse error,
    // because the outer parser already accepted the ref.
    resolver.setStepCaptures(new Map());
    const { errors } = resolver.resolveTemplate('{{step.login}}');
    expect(errors[0]).toMatchObject({ reason: 'unset-in-scope', namespace: 'step' });
  });

  it('setStepCaptures(null) toggles back to step-out-of-context', () => {
    resolver.setStepCaptures(new Map([['login', new Map([['sessionId', 'x']])]]));
    expect(resolver.resolveTemplate('{{step.login.sessionId}}').errors).toEqual([]);
    resolver.setStepCaptures(null);
    expect(resolver.resolveTemplate('{{step.login.sessionId}}').errors[0]).toMatchObject({
      reason: 'step-out-of-context',
    });
  });

  it('emits an empty error for whitespace-only {{   }}', () => {
    const { errors } = resolver.resolveTemplate('Hello {{   }}');
    expect(errors[0]).toMatchObject({ reason: 'empty', namespace: null });
  });

  it('emits an empty error for trailing-dot {{env.}}', () => {
    const { errors } = resolver.resolveTemplate('{{env.}}');
    expect(errors[0]).toMatchObject({ reason: 'empty', namespace: null });
  });

  it('deduplicates errors by reference — same {{X}} twice → one error', () => {
    const { errors } = resolver.resolveTemplate('{{MISSING}} {{MISSING}} {{MISSING}}');
    expect(errors).toHaveLength(1);
  });

  it('returns no errors when every reference resolves', () => {
    const { errors } = resolver.resolveTemplate('Hello {{KNOWN}}!');
    expect(errors).toEqual([]);
  });

  it('returns all errors for a mixed template', () => {
    const { errors } = resolver.resolveTemplate('{{KNOWN}} {{env.API_URL}} {{foo.X}} {{MISSING}}');
    expect(errors).toHaveLength(3);
    const reasons = errors.map((e) => e.reason).sort();
    expect(reasons).toEqual(['unknown-namespace', 'unresolved', 'unset-in-scope']);
  });
});
