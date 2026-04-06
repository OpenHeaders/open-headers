import { beforeEach, describe, expect, it } from 'vitest';
import type { Environment, Variable, Vault, WorkspaceVariables } from '../../src/types/v5';
import { resolveTemplate, VariableResolver } from '../../src/variables';

// ── Factories ──────────────────────────────────────────────────────

function makeVariable(name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  return { name, value, type, source: 'static' };
}

function makeEnvironment(name: string, vars: Variable[], isActive = false): Environment {
  return { id: `env-${name.toLowerCase()}`, name, variables: vars, isActive };
}

function makeVault(secrets: Array<{ name: string; value: string }>): Vault {
  const now = new Date().toISOString();
  return {
    secrets: secrets.map((s) => ({ ...s, createdAt: now, updatedAt: now })),
  };
}

function makeWorkspaceVars(vars: Variable[]): WorkspaceVariables {
  return { variables: vars };
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
      resolver.setEnvironments([
        makeEnvironment('Development', [makeVariable('BASE_URL', 'https://dev.openheaders.io')], true),
      ]);

      const result = resolver.resolve('BASE_URL');
      expect(result?.value).toBe('https://dev.openheaders.io');
      expect(result?.scope).toBe('environment');
    });

    it('resolves from environment over collection (env has higher priority)', () => {
      resolver.setEnvironments([makeEnvironment('Dev', [makeVariable('VERSION', 'v2')], true)]);
      resolver.setCollectionVariables('coll-1', [makeVariable('VERSION', 'v3')]);

      const result = resolver.resolve('VERSION', { collectionId: 'coll-1' });
      expect(result?.value).toBe('v2');
      expect(result?.scope).toBe('environment');
    });

    it('falls through to collection when environment has no value', () => {
      resolver.setEnvironments([makeEnvironment('Dev', [], true)]);
      resolver.setCollectionVariables('coll-1', [makeVariable('VERSION', 'v3')]);

      const result = resolver.resolve('VERSION', { collectionId: 'coll-1' });
      expect(result?.value).toBe('v3');
      expect(result?.scope).toBe('collection');
    });

    it('resolves from vault over everything', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('SECRET_KEY', 'from-globals')]));
      resolver.setEnvironments([makeEnvironment('Dev', [makeVariable('SECRET_KEY', 'from-env')], true)]);
      resolver.setCollectionVariables('coll-1', [makeVariable('SECRET_KEY', 'from-collection')]);
      resolver.setVault(makeVault([{ name: 'SECRET_KEY', value: 'from-vault' }]));

      const result = resolver.resolve('SECRET_KEY', { collectionId: 'coll-1' });
      expect(result?.value).toBe('from-vault');
      expect(result?.scope).toBe('secret');
      expect(result?.isSensitive).toBe(true);
    });

    it('falls through to lower scope when higher scope has empty value', () => {
      resolver.setEnvironments([makeEnvironment('Dev', [makeVariable('TOKEN', '')], true)]);
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

    it('uses specific environment via context', () => {
      resolver.setEnvironments([
        makeEnvironment('Dev', [makeVariable('URL', 'https://dev.openheaders.io')], true),
        makeEnvironment('Prod', [makeVariable('URL', 'https://prod.openheaders.io')], false),
      ]);

      const result = resolver.resolve('URL', { environmentId: 'env-prod' });
      expect(result?.value).toBe('https://prod.openheaders.io');
    });

    it('marks secret variables correctly', () => {
      resolver.setEnvironments([makeEnvironment('Dev', [makeVariable('API_KEY', 'sk-123', 'secret')], true)]);

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
      expect(variables[0]).toEqual({ name: 'NAME', resolved: true, value: 'OpenHeaders', scope: 'workspace' });
    });

    it('resolves multiple variables', () => {
      resolver.setWorkspaceVariables(makeWorkspaceVars([makeVariable('HOST', 'api.openheaders.io'), makeVariable('VERSION', 'v2')]));

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
      resolver.setEnvironments([
        makeEnvironment(
          'Dev',
          [makeVariable('DOMAINS', '*.dev.openheaders.io,staging.openheaders.io,localhost:3000')],
          true,
        ),
      ]);

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
      if (name === 'TOKEN') return { name, value: 'abc123', scope: 'secret' as const, isSensitive: true };
      return null;
    };

    const { result, variables } = resolveTemplate('Bearer {{TOKEN}}', lookup);
    expect(result).toBe('Bearer abc123');
    expect(variables[0].scope).toBe('secret');
  });
});
