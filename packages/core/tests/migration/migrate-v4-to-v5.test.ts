import { describe, expect, it } from 'vitest';
import { migrateV4toV5 } from '../../src/migration';
import type {
  BodyRule,
  HeaderRule,
  V4EnvironmentsFile,
  V4HeaderRule,
  V4PayloadRule,
  V4ProxyRule,
  V4RulesStorage,
  V4Source,
  V4WorkspaceData,
} from '../../src/types/v5';

// ── Factories ──────────────────────────────────────────────────────

function makeV4Source(overrides: Partial<V4Source> = {}): V4Source {
  return {
    sourceId: '1',
    sourceType: 'http',
    sourcePath: 'https://int.id.openheaders.io/token',
    sourceMethod: 'POST',
    sourceTag: 'TeamAlpha',
    requestOptions: {
      contentType: 'application/x-www-form-urlencoded',
      body: 'username:{{USERNAME}}\npassword:{{PASSWORD}}\ngrant_type:password',
      headers: [{ key: 'Authorization', value: '{{BASIC_AUTH}}' }],
      queryParams: [],
      totpSecret: '{{TOTP_SECRET}}',
    },
    jsonFilter: { enabled: true, path: 'root.access_token' },
    refreshOptions: {
      enabled: true,
      type: 'custom',
      interval: 238,
      lastRefresh: 1753716828914,
      nextRefresh: 1753716828103,
    },
    activationState: 'active',
    missingDependencies: [],
    sourceContent: 'eyJhbGciOiJSUzI1NiJ9.test-token',
    createdAt: '2025-07-28T11:35:48.104Z',
    updatedAt: '2026-04-04T10:58:27.713Z',
    ...overrides,
  };
}

function makeV4HeaderRule(overrides: Partial<V4HeaderRule> = {}): V4HeaderRule {
  return {
    id: '100',
    type: 'header',
    name: '',
    description: '',
    isEnabled: true,
    domains: ['{{DOMAIN_LIST}}'],
    createdAt: '2025-07-28T13:00:38.471Z',
    updatedAt: '2025-07-28T14:24:58.780Z',
    headerName: 'X-Tenantid',
    headerValue: '{{TENANT_ID}}',
    tag: 'TeamAlpha',
    isResponse: false,
    isDynamic: false,
    sourceId: null,
    prefix: '',
    suffix: '',
    hasEnvVars: true,
    envVars: ['TENANT_ID', 'DOMAIN_LIST'],
    ...overrides,
  };
}

function makeV4PayloadRule(overrides: Partial<V4PayloadRule> = {}): V4PayloadRule {
  return {
    id: '200',
    type: 'payload',
    name: '',
    description: '',
    isEnabled: true,
    domains: ['*.openheaders.io'],
    createdAt: '2025-07-28T13:00:38.471Z',
    updatedAt: '2025-07-28T14:24:58.780Z',
    matchPattern: '"debug":false',
    matchType: 'contains',
    replaceWith: '"debug":true',
    isRequest: true,
    isResponse: false,
    contentType: 'json',
    ...overrides,
  };
}

function makeV4RulesStorage(headerRules: V4HeaderRule[] = [], requestRules: V4PayloadRule[] = []): V4RulesStorage {
  return {
    version: '3.0.0',
    rules: {
      header: headerRules,
      request: requestRules,
      response: [],
    },
    metadata: {
      totalRules: headerRules.length + requestRules.length,
      lastUpdated: new Date().toISOString(),
    },
  };
}

function makeV4Environments(vars: Record<string, { value: string; isSecret: boolean }> = {}): V4EnvironmentsFile {
  const envVars: Record<string, { value: string; isSecret: boolean; updatedAt?: string }> = {};
  for (const [name, data] of Object.entries(vars)) {
    envVars[name] = { ...data, updatedAt: '2026-04-04T10:58:27.107Z' };
  }
  return {
    environments: { Default: envVars },
    activeEnvironment: 'Default',
  };
}

function makeV4Workspace(overrides: Partial<V4WorkspaceData> = {}): V4WorkspaceData {
  return {
    sources: [],
    rules: makeV4RulesStorage(),
    environments: makeV4Environments(),
    proxyRules: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('migrateV4toV5', () => {
  it('migrates an empty workspace', () => {
    const { workspace, result } = migrateV4toV5(makeV4Workspace());

    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(workspace.collections).toHaveLength(0);
    expect(workspace.rules).toHaveLength(0);
    expect(workspace.environments).toHaveLength(1); // Default
    expect(workspace.vault.secrets).toHaveLength(0);
    expect(workspace.globals.variables).toHaveLength(0);
  });

  describe('source → request migration', () => {
    it('converts an HTTP source to a Request in a collection', () => {
      const source = makeV4Source();
      const { workspace, result } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      expect(result.success).toBe(true);
      expect(workspace.collections).toHaveLength(1);

      const collection = workspace.collections[0];
      expect(collection.collection.name).toBe('TeamAlpha API');
      expect(collection.requests).toHaveLength(1);

      const request = collection.requests[0];
      expect(request.id).toBe('migrated-request-1');
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://int.id.openheaders.io/token');
    });

    it('parses form-urlencoded body into formData entries', () => {
      const source = makeV4Source();
      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      const request = workspace.collections[0].requests[0];
      expect(request.body.type).toBe('x-www-form-urlencoded');
      expect(request.body.formData).toHaveLength(3);
      expect(request.body.formData?.[0]).toEqual({
        key: 'username',
        value: '{{USERNAME}}',
        type: 'text',
        enabled: true,
      });
      expect(request.body.formData?.[1]).toEqual({
        key: 'password',
        value: '{{PASSWORD}}',
        type: 'text',
        enabled: true,
      });
      expect(request.body.formData?.[2]).toEqual({
        key: 'grant_type',
        value: 'password',
        type: 'text',
        enabled: true,
      });
    });

    it('preserves TOTP config', () => {
      const source = makeV4Source();
      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      const request = workspace.collections[0].requests[0];
      expect(request.totp).toEqual({
        secret: '{{TOTP_SECRET}}',
        placeholder: '[[TOTP_CODE]]',
      });
    });

    it('migrates request headers', () => {
      const source = makeV4Source();
      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      const request = workspace.collections[0].requests[0];
      expect(request.headers).toEqual([{ key: 'Authorization', value: '{{BASIC_AUTH}}', enabled: true }]);
    });

    it('groups sources by tag into separate collections', () => {
      const source1 = makeV4Source({ sourceId: '1', sourceTag: 'TeamAlpha' });
      const source2 = makeV4Source({
        sourceId: '2',
        sourceTag: 'TeamBeta',
        sourcePath: 'https://mc1.openheaders.io/auth',
      });
      const source3 = makeV4Source({
        sourceId: '3',
        sourceTag: 'TeamAlpha',
        sourcePath: 'https://int.id.openheaders.io/refresh',
      });

      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source1, source2, source3] }));

      expect(workspace.collections).toHaveLength(2);

      const mc2Collection = workspace.collections.find((c) => c.collection.name === 'TeamAlpha API');
      const mc1Collection = workspace.collections.find((c) => c.collection.name === 'TeamBeta API');

      expect(mc2Collection?.requests).toHaveLength(2);
      expect(mc1Collection?.requests).toHaveLength(1);
    });

    it('derives request name from URL path', () => {
      const source = makeV4Source({
        sourcePath: 'https://api.openheaders.io/v1/auth/login',
      });
      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      expect(workspace.collections[0].requests[0].name).toBe('login');
    });

    it('uses sourceName when available', () => {
      const source = makeV4Source({ sourceName: 'Token Refresh' });
      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      expect(workspace.collections[0].requests[0].name).toBe('Token Refresh');
    });

    it('warns about non-HTTP sources', () => {
      const fileSource: V4Source = {
        sourceId: '2',
        sourceType: 'file',
        sourcePath: '/tmp/token.txt',
        sourceTag: '',
        createdAt: '2026-01-01T00:00:00Z',
        activationState: 'active',
        missingDependencies: [],
      };

      const { result } = migrateV4toV5(makeV4Workspace({ sources: [fileSource] }));

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('environment variable');
    });

    it('creates collection tree nodes for sidebar display', () => {
      const source = makeV4Source();
      const { workspace } = migrateV4toV5(makeV4Workspace({ sources: [source] }));

      const tree = workspace.collections[0].tree;
      expect(tree).toHaveLength(1);
      expect(tree[0]).toEqual({
        type: 'request',
        id: 'migrated-request-1',
        name: 'token',
        method: 'POST',
      });
    });
  });

  describe('rule migration', () => {
    it('migrates a static header rule', () => {
      const rule = makeV4HeaderRule();
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          rules: makeV4RulesStorage([rule]),
        }),
      );

      expect(workspace.rules).toHaveLength(1);
      const v5Rule = workspace.rules[0] as HeaderRule;
      expect(v5Rule.type).toBe('header');
      expect(v5Rule.valueSource).toBe('static');
      expect(v5Rule.staticValue).toBe('{{TENANT_ID}}');
      expect(v5Rule.action.headerName).toBe('X-Tenantid');
      expect(v5Rule.action.isResponse).toBe(false);
      expect(v5Rule.enabled).toBe(true);
      expect(v5Rule.tags).toEqual(['TeamAlpha']);
      expect(v5Rule.domains).toEqual(['{{DOMAIN_LIST}}']);
    });

    it('migrates a dynamic rule with source linkage to request source', () => {
      const source = makeV4Source({ sourceId: '1' });
      const rule = makeV4HeaderRule({
        id: '300',
        headerName: 'Authorization',
        headerValue: '',
        isDynamic: true,
        sourceId: '1',
        prefix: 'Bearer ',
        suffix: '',
      });

      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          sources: [source],
          rules: makeV4RulesStorage([rule]),
        }),
      );

      const v5Rule = workspace.rules[0] as HeaderRule;
      expect(v5Rule.valueSource).toBe('request');
      expect(v5Rule.requestSource).toBeDefined();
      expect(v5Rule.requestSource?.requestId).toBe('migrated-request-1');
      expect(v5Rule.requestSource?.responseExtract).toBe('$.access_token');
      expect(v5Rule.requestSource?.extractTarget).toBe('body');
      expect(v5Rule.requestSource?.valueTemplate).toBe('Bearer {value}');
      expect(v5Rule.requestSource?.refreshMode).toBe('interval');
      expect(v5Rule.requestSource?.refreshInterval).toBe(238 * 60); // minutes → seconds
      expect(v5Rule.requestSource?.lastValue).toBe('eyJhbGciOiJSUzI1NiJ9.test-token');
    });

    it('converts v4 jsonFilter path to JSONPath notation', () => {
      const source = makeV4Source({
        jsonFilter: { enabled: true, path: 'root.data.items[0].token' },
      });
      const rule = makeV4HeaderRule({
        isDynamic: true,
        sourceId: '1',
        prefix: '',
        suffix: '',
      });

      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          sources: [source],
          rules: makeV4RulesStorage([rule]),
        }),
      );

      const v5Rule = workspace.rules[0] as HeaderRule;
      expect(v5Rule.requestSource?.responseExtract).toBe('$.data.items[0].token');
    });

    it('merges proxy rules into proxyEnabled flag', () => {
      const rule = makeV4HeaderRule({ id: '100' });
      const proxyRule: V4ProxyRule = {
        id: 'pr-1',
        name: 'ALPHA_X_Tenant',
        enabled: true,
        headerRuleId: '100',
        isDynamic: true,
      };

      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          rules: makeV4RulesStorage([rule]),
          proxyRules: [proxyRule],
        }),
      );

      expect(workspace.rules[0].proxyEnabled).toBe(true);
    });

    it('sets proxyEnabled false when no proxy rule exists', () => {
      const rule = makeV4HeaderRule();
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          rules: makeV4RulesStorage([rule]),
        }),
      );

      expect(workspace.rules[0].proxyEnabled).toBe(false);
    });

    it('migrates a payload rule to a body rule', () => {
      const rule = makeV4PayloadRule();
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          rules: makeV4RulesStorage([], [rule]),
        }),
      );

      expect(workspace.rules).toHaveLength(1);
      const v5Rule = workspace.rules[0] as BodyRule;
      expect(v5Rule.type).toBe('body');
      expect(v5Rule.action.matchPattern).toBe('"debug":false');
      expect(v5Rule.action.replaceWith).toBe('"debug":true');
      expect(v5Rule.action.contentType).toBe('json');
    });

    it('converts singular tag to tags array', () => {
      const rule = makeV4HeaderRule({ tag: 'Production' });
      const { workspace } = migrateV4toV5(makeV4Workspace({ rules: makeV4RulesStorage([rule]) }));

      expect(workspace.rules[0].tags).toEqual(['Production']);
    });

    it('handles empty tag as empty array', () => {
      const rule = makeV4HeaderRule({ tag: '' });
      const { workspace } = migrateV4toV5(makeV4Workspace({ rules: makeV4RulesStorage([rule]) }));

      expect(workspace.rules[0].tags).toEqual([]);
    });

    it('warns when dynamic rule references missing source', () => {
      const rule = makeV4HeaderRule({
        isDynamic: true,
        sourceId: '999',
      });

      const { result } = migrateV4toV5(
        makeV4Workspace({
          rules: makeV4RulesStorage([rule]),
        }),
      );

      expect(result.warnings.some((w) => w.message.includes('not found'))).toBe(true);
    });

    it('falls back to static value when source is missing', () => {
      const rule = makeV4HeaderRule({
        isDynamic: true,
        sourceId: '999',
        headerValue: 'fallback-value',
      });

      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          rules: makeV4RulesStorage([rule]),
        }),
      );

      const v5Rule = workspace.rules[0] as HeaderRule;
      expect(v5Rule.valueSource).toBe('static');
      expect(v5Rule.staticValue).toBe('fallback-value');
    });
  });

  describe('environment migration', () => {
    it('migrates environment variables', () => {
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          environments: makeV4Environments({
            BASE_URL: { value: 'https://dev.openheaders.io', isSecret: false },
            API_KEY: { value: 'sk-test-123', isSecret: true },
          }),
        }),
      );

      expect(workspace.environments).toHaveLength(1);
      expect(workspace.environments[0].name).toBe('Default');
      expect(workspace.environments[0].isActive).toBe(true);
      expect(workspace.environments[0].variables).toHaveLength(2);

      const baseUrl = workspace.environments[0].variables.find((v) => v.name === 'BASE_URL');
      expect(baseUrl?.value).toBe('https://dev.openheaders.io');
      expect(baseUrl?.type).toBe('default');
      expect(baseUrl?.source).toBe('static');

      const apiKey = workspace.environments[0].variables.find((v) => v.name === 'API_KEY');
      expect(apiKey?.value).toBe('sk-test-123');
      expect(apiKey?.type).toBe('secret');
    });

    it('creates environment manifest (names only, for git sync)', () => {
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          environments: makeV4Environments({
            BASE_URL: { value: 'https://dev.openheaders.io', isSecret: false },
            API_KEY: { value: 'sk-test-123', isSecret: true },
          }),
        }),
      );

      expect(workspace.environmentManifests).toHaveLength(1);
      const manifest = workspace.environmentManifests[0];
      expect(manifest.variables).toHaveLength(2);
      expect(manifest.variables[0]).toEqual({
        name: 'BASE_URL',
        type: 'default',
        source: 'static',
      });
      expect(manifest.variables[1]).toEqual({
        name: 'API_KEY',
        type: 'secret',
        source: 'static',
      });
    });

    it('creates local values file (actual values, gitignored)', () => {
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          environments: makeV4Environments({
            BASE_URL: { value: 'https://dev.openheaders.io', isSecret: false },
            API_KEY: { value: 'sk-test-123', isSecret: true },
          }),
        }),
      );

      expect(workspace.environmentLocalValues).toHaveLength(1);
      expect(workspace.environmentLocalValues[0].values).toEqual({
        BASE_URL: 'https://dev.openheaders.io',
        API_KEY: 'sk-test-123',
      });
    });

    it('moves secrets to vault', () => {
      const { workspace, result } = migrateV4toV5(
        makeV4Workspace({
          environments: makeV4Environments({
            PASSWORD: { value: 'secret123', isSecret: true },
            PUBLIC_VAR: { value: 'hello', isSecret: false },
            TOTP: { value: 'totp-seed', isSecret: true },
          }),
        }),
      );

      expect(workspace.vault.secrets).toHaveLength(2);
      expect(workspace.vault.secrets.map((s) => s.name).sort()).toEqual(['PASSWORD', 'TOTP']);
      expect(workspace.vault.secrets.find((s) => s.name === 'PASSWORD')?.value).toBe('secret123');

      // Should have a warning about vault migration
      expect(result.warnings.some((w) => w.entity === 'vault')).toBe(true);
    });

    it('does not add empty-value secrets to vault', () => {
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          environments: makeV4Environments({
            EMPTY_SECRET: { value: '', isSecret: true },
          }),
        }),
      );

      expect(workspace.vault.secrets).toHaveLength(0);
    });

    it('handles multiple environments', () => {
      const { workspace } = migrateV4toV5(
        makeV4Workspace({
          environments: {
            environments: {
              Default: {
                VAR1: { value: 'a', isSecret: false },
              },
              Staging: {
                VAR1: { value: 'b', isSecret: false },
              },
            },
            activeEnvironment: 'Default',
          },
        }),
      );

      expect(workspace.environments).toHaveLength(2);
      expect(workspace.environments.find((e) => e.name === 'Default')?.isActive).toBe(true);
      expect(workspace.environments.find((e) => e.name === 'Staging')?.isActive).toBe(false);
    });
  });

  describe('real-world: ALPHA team workspace shape', () => {
    it('migrates the full ALPHA workspace correctly', () => {
      const data = makeV4Workspace({
        sources: [
          makeV4Source({
            sourceId: '1',
            sourcePath: 'https://int.id.openheaders.io/token',
            sourceMethod: 'POST',
            sourceTag: 'TeamAlpha',
            requestOptions: {
              contentType: 'application/x-www-form-urlencoded',
              body: 'username:{{ALPHA_USERNAME}}\npassword:{{ALPHA_PASSWORD}}\nclient_id:{{ALPHA_CLIENT_ID}}\nverification_code:[[TOTP_CODE]]\ngrant_type:password\nscope:openid email profile',
              headers: [{ key: 'Authorization', value: '{{ALPHA_BASIC_AUTH}}' }],
              queryParams: [],
              totpSecret: '{{ALPHA_TOTP_SECRET}}',
            },
            jsonFilter: { enabled: true, path: 'root.access_token' },
            refreshOptions: { enabled: true, type: 'custom', interval: 238 },
            sourceContent: 'eyJ-test-token',
          }),
        ],
        rules: makeV4RulesStorage([
          // Static env-var rule
          makeV4HeaderRule({
            id: '1001',
            headerName: 'X-Tenantid',
            headerValue: '{{ALPHA_TENANT_ID}}',
            tag: 'TeamAlpha',
            isDynamic: false,
            sourceId: null,
          }),
          // Static env-var rule
          makeV4HeaderRule({
            id: '1002',
            headerName: 'X-Bearer-Token',
            headerValue: '{{ALPHA_BEARER_TOKEN}}',
            tag: 'TeamAlpha',
            isDynamic: false,
            sourceId: null,
          }),
          // Dynamic source-linked rule
          makeV4HeaderRule({
            id: '1003',
            headerName: 'Authorization',
            headerValue: '',
            tag: 'TeamAlpha',
            isDynamic: true,
            sourceId: '1',
            prefix: 'Bearer ',
            suffix: '',
          }),
          // Static rule on different tag
          makeV4HeaderRule({
            id: '1004',
            headerName: 'Authorization',
            headerValue: 'Bearer {{BETA_TOKEN}}',
            tag: 'TeamBeta',
            isDynamic: false,
            sourceId: null,
            domains: ['{{BETA_DOMAINS}}'],
          }),
        ]),
        proxyRules: [
          { id: 'pr1', name: 'ALPHA_X_Tenant', enabled: true, headerRuleId: '1001', isDynamic: true },
          { id: 'pr2', name: 'ALPHA_X_Bearer', enabled: true, headerRuleId: '1002', isDynamic: true },
          { id: 'pr3', name: 'ALPHA_Auth', enabled: true, headerRuleId: '1003', isDynamic: true },
          { id: 'pr4', name: 'BETA_Auth', enabled: true, headerRuleId: '1004', isDynamic: true },
        ],
        environments: makeV4Environments({
          ALPHA_CLIENT_ID: { value: '7koqk2jawr3li', isSecret: true },
          ALPHA_PASSWORD: { value: 'test-password', isSecret: true },
          ALPHA_TOTP_SECRET: { value: 'LJXXXXBNIQMM7DYY', isSecret: true },
          ALPHA_BASIC_AUTH: { value: 'Basic N2tvcWsyamF3...', isSecret: true },
          ALPHA_TENANT_ID: { value: '1', isSecret: false },
          ALPHA_BEARER_TOKEN: { value: 'eyJ-bearer-token', isSecret: true },
          ALPHA_USERNAME: { value: 'user@openheaders.io', isSecret: false },
          BETA_TOKEN: { value: '', isSecret: true },
          BETA_DOMAINS: { value: '', isSecret: false },
          ALPHA_DOMAINS: { value: '*.1.development.openheaders.io,dev.openheaders.io', isSecret: false },
        }),
      });

      const { workspace, result } = migrateV4toV5(data);

      expect(result.success).toBe(true);

      // 1 collection (ALPHA) with 1 request (the token endpoint)
      expect(workspace.collections).toHaveLength(1);
      expect(workspace.collections[0].collection.name).toBe('TeamAlpha API');
      expect(workspace.collections[0].requests).toHaveLength(1);

      // 4 rules migrated
      expect(workspace.rules).toHaveLength(4);

      // Rule 1: static, proxyEnabled
      const r1 = workspace.rules.find((r) => r.id === '1001') as HeaderRule;
      expect(r1.valueSource).toBe('static');
      expect(r1.staticValue).toBe('{{ALPHA_TENANT_ID}}');
      expect(r1.proxyEnabled).toBe(true);
      expect(r1.tags).toEqual(['TeamAlpha']);

      // Rule 3: dynamic → request source
      const r3 = workspace.rules.find((r) => r.id === '1003') as HeaderRule;
      expect(r3.valueSource).toBe('request');
      expect(r3.requestSource?.requestId).toBe('migrated-request-1');
      expect(r3.requestSource?.valueTemplate).toBe('Bearer {value}');
      expect(r3.requestSource?.responseExtract).toBe('$.access_token');
      expect(r3.proxyEnabled).toBe(true);

      // Rule 4: different tag
      const r4 = workspace.rules.find((r) => r.id === '1004') as HeaderRule;
      expect(r4.tags).toEqual(['TeamBeta']);
      expect(r4.domains).toEqual(['{{BETA_DOMAINS}}']);

      // Environment
      expect(workspace.environments).toHaveLength(1);
      expect(workspace.environments[0].variables).toHaveLength(10);

      // Vault: should have secrets (non-empty ones)
      const vaultNames = workspace.vault.secrets.map((s) => s.name).sort();
      expect(vaultNames).toEqual([
        'ALPHA_BASIC_AUTH',
        'ALPHA_BEARER_TOKEN',
        'ALPHA_CLIENT_ID',
        'ALPHA_PASSWORD',
        'ALPHA_TOTP_SECRET',
      ]);
      // BETA_TOKEN has empty value, should not be in vault
      expect(vaultNames).not.toContain('BETA_TOKEN');
    });
  });
});
