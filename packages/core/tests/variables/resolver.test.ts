import { beforeEach, describe, expect, it } from 'vitest';
import type { Environment, Variable, Vault, WorkspaceVariables } from '../../src/types/v5';
import { resolveTemplate, VariableResolver } from '../../src/variables';

// ── Factories ──────────────────────────────────────────────────────

function makeVariable(name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  return { name, value, type };
}

let envCounter = 0;
function makeEnvironment(name: string, vars: Variable[]): Environment {
  envCounter += 1;
  return { schemaVersion: 5, uid: `env-${envCounter}`, name, variables: vars };
}

function makeVault(secrets: Array<{ name: string; value: string }>): Vault {
  return {
    schemaVersion: 5,
    secrets: secrets.map((s) => ({ ...s })),
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
      secrets: [{ name: 'TOKEN', value: 'vault-token' }],
    });
    resolver.setEnvironments([
      {
        schemaVersion: 5,
        uid: 'e-staging',
        name: 'staging',
        variables: [{ name: 'API_URL', value: 'https://api.staging', type: 'default' }],
      },
    ]);
    resolver.setActiveEnvironmentId('e-staging');
    resolver.setWorkspaceVariables({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });
    resolver.setCollectionVariables('coll-1', [{ name: 'REGION', value: 'eu-west-1', type: 'default' }]);
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

  it('{{file.X}} is reserved and unresolvable today', () => {
    const { result, variables } = resolver.resolveTemplate('{{file.fixture.json}}');
    expect(result).toBe('{{file.fixture.json}}');
    expect(variables[0]).toEqual({ name: 'file.fixture.json', resolved: false });
  });

  it('{{dynamic.uuid}} is reserved for a future dedicated resolver', () => {
    const { result, variables } = resolver.resolveTemplate('{{dynamic.uuid}}');
    expect(result).toBe('{{dynamic.uuid}}');
    expect(variables[0]).toEqual({ name: 'dynamic.uuid', resolved: false });
  });

  it('{{foo.X}} is left literal (unknown namespace)', () => {
    const { result, variables } = resolver.resolveTemplate('{{foo.X}}');
    expect(result).toBe('{{foo.X}}');
    expect(variables[0]).toEqual({ name: 'foo.X', resolved: false });
  });
});

describe('VariableResolver — default environment fallback', () => {
  let resolver: VariableResolver;

  const makeEnv = (uid: string, name: string, vars: Array<[string, string]>): Environment => ({
    schemaVersion: 5,
    uid,
    name,
    variables: vars.map(([n, v]) => ({ name: n, value: v, type: 'default' as const })),
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
      variables: [{ name: 'KNOWN', value: 'v', type: 'default' }],
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

  it('emits a reserved-namespace error for {{file.X}}', () => {
    const { errors } = resolver.resolveTemplate('{{file.fixture.json}}');
    expect(errors[0]).toMatchObject({
      reference: 'file.fixture.json',
      reason: 'reserved-namespace',
      namespace: 'file',
    });
    expect(errors[0].hint).toMatch(/v2/);
  });

  it('emits a reserved-namespace error for {{dynamic.uuid}}', () => {
    const { errors } = resolver.resolveTemplate('{{dynamic.uuid}}');
    expect(errors[0]).toMatchObject({ reason: 'reserved-namespace', namespace: 'dynamic' });
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
