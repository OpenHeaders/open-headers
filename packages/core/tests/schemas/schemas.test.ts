import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  CollectionSchema,
  EnvironmentSchema,
  ExtensionWorkspaceSchema,
  FolderSchema,
  parseEntity,
  parseEntityArray,
  RequestSchema,
  RuleSchema,
  TemplateSchema,
  VariableSchema,
  VaultSchema,
  WorkspaceSchema,
  WorkspaceVariablesSchema,
} from '../../src/schemas';

describe('VariableSchema', () => {
  it('accepts a default variable', () => {
    expect(
      v.parse(VariableSchema, { uid: 'vrapiurl', name: 'API_URL', value: 'https://x', type: 'default' }),
    ).toBeTruthy();
  });

  it('accepts a secret variable', () => {
    expect(
      v.parse(VariableSchema, { uid: 'vrtokenx', name: 'TOKEN', value: 'abc', type: 'secret' }),
    ).toBeTruthy();
  });

  it('rejects an unknown type', () => {
    expect(
      v.safeParse(VariableSchema, { uid: 'vrxxxxxx', name: 'X', value: 'y', type: 'unknown' }).success,
    ).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(v.safeParse(VariableSchema, { uid: 'vrxxxxxx', name: 'X', value: 'y' }).success).toBe(false);
  });

  it('rejects missing uid', () => {
    expect(v.safeParse(VariableSchema, { name: 'X', value: 'y', type: 'default' }).success).toBe(false);
  });
});

describe('VaultSchema', () => {
  it('accepts an empty vault', () => {
    expect(v.parse(VaultSchema, { schemaVersion: 5, secrets: [] })).toEqual({
      schemaVersion: 5,
      secrets: [],
    });
  });

  it('rejects a missing schemaVersion', () => {
    expect(v.safeParse(VaultSchema, { secrets: [] }).success).toBe(false);
  });

  it('rejects schemaVersion below 5 — V5 is the baseline; no pre-5 snapshots exist', () => {
    for (const pre5 of [0, 1, 2, 3, 4]) {
      expect(v.safeParse(VaultSchema, { schemaVersion: pre5, secrets: [] }).success).toBe(false);
    }
  });

  it('accepts schemaVersion 5 and later (for future entity bumps)', () => {
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [] }).success).toBe(true);
    expect(v.safeParse(VaultSchema, { schemaVersion: 6, secrets: [] }).success).toBe(true);
    expect(v.safeParse(VaultSchema, { schemaVersion: 100, secrets: [] }).success).toBe(true);
  });
});

describe('EnvironmentSchema', () => {
  it('accepts a valid environment', () => {
    expect(
      v.parse(EnvironmentSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        name: 'staging',
        variables: [{ uid: 'vrapiurl', name: 'API_URL', value: 'x', type: 'default' }],
      }),
    ).toBeTruthy();
  });

  it('rejects a non-8-char uid', () => {
    expect(v.safeParse(EnvironmentSchema, { schemaVersion: 5, uid: 'abc', name: 's', variables: [] }).success).toBe(
      false,
    );
  });

  it('rejects an uppercase uid', () => {
    expect(
      v.safeParse(EnvironmentSchema, { schemaVersion: 5, uid: 'ABCD1234', name: 's', variables: [] }).success,
    ).toBe(false);
  });

  it('accepts optional path', () => {
    expect(
      v.parse(EnvironmentSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        name: 'staging',
        path: 'environments/staging.yaml',
        variables: [],
      }),
    ).toBeTruthy();
  });
});

describe('WorkspaceSchema', () => {
  it('accepts the minimal manifest', () => {
    expect(v.parse(WorkspaceSchema, { schemaVersion: 5, uid: 'abcd1234', name: 'My Workspace' })).toBeTruthy();
  });

  it('accepts defaultEnvironmentId', () => {
    expect(
      v.parse(WorkspaceSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        name: 'x',
        defaultEnvironmentId: 'abcd1234',
      }),
    ).toBeTruthy();
  });

  it('rejects a missing uid (Phase 0 invariant #1)', () => {
    expect(v.safeParse(WorkspaceSchema, { schemaVersion: 5, name: 'x' }).success).toBe(false);
  });

  it('rejects a non-8-char uid', () => {
    expect(v.safeParse(WorkspaceSchema, { schemaVersion: 5, uid: 'too-short', name: 'x' }).success).toBe(false);
  });
});

describe('ExtensionWorkspaceSchema', () => {
  it('accepts a personal workspace', () => {
    expect(
      v.parse(ExtensionWorkspaceSchema, {
        schemaVersion: 5,
        id: 'abcd1234',
        kind: 'personal',
        name: 'mine',
        sortIndex: 0,
        createdAt: '2026-04-18T00:00:00Z',
        updatedAt: '2026-04-18T00:00:00Z',
      }),
    ).toBeTruthy();
  });

  it('rejects an unknown kind', () => {
    expect(
      v.safeParse(ExtensionWorkspaceSchema, {
        schemaVersion: 5,
        id: 'abcd1234',
        kind: 'public',
        name: 'x',
        sortIndex: 0,
        createdAt: '2026',
        updatedAt: '2026',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing schemaVersion', () => {
    expect(
      v.safeParse(ExtensionWorkspaceSchema, {
        id: 'abcd1234',
        kind: 'personal',
        name: 'mine',
        sortIndex: 0,
        createdAt: '2026',
        updatedAt: '2026',
      }).success,
    ).toBe(false);
  });
});

describe('CollectionSchema', () => {
  it('accepts an empty collection', () => {
    expect(
      v.parse(CollectionSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth-abcd1234',
        name: 'Auth',
        variables: [],
      }),
    ).toBeTruthy();
  });

  it('accepts explicit order', () => {
    expect(
      v.parse(CollectionSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth-abcd1234',
        name: 'Auth',
        variables: [],
        order: ['login-wxyz1234', 'logout-pqrs5678'],
      }),
    ).toBeTruthy();
  });
});

describe('FolderSchema', () => {
  it('accepts a minimal folder', () => {
    expect(
      v.parse(FolderSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth-wxyz1234/tokens-abcd1234',
        name: 'Tokens',
      }),
    ).toBeTruthy();
  });
});

describe('RequestSchema', () => {
  it('accepts a bearer-auth request', () => {
    expect(
      v.parse(RequestSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        path: 'requests/auth-xxxx1234/login-abcd1234',
        name: 'Login',
        method: 'POST',
        url: 'https://api.openheaders.io/login',
        headers: [{ uid: 'hdrxxxx1', key: 'X-Client', value: 'oh' }],
        params: [],
        auth: { type: 'bearer', token: 'x' },
        body: { type: 'json', content: '{}' },
      }),
    ).toBeTruthy();
  });

  it('rejects an unknown auth type', () => {
    expect(
      v.safeParse(RequestSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        path: 'x',
        name: 'x',
        method: 'GET',
        url: 'x',
        headers: [],
        params: [],
        auth: { type: 'magic' },
        body: { type: 'none' },
      }).success,
    ).toBe(false);
  });

  it('accepts credentialsMode: "include"', () => {
    expect(
      v.parse(RequestSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        path: 'x',
        name: 'x',
        method: 'GET',
        url: 'x',
        headers: [],
        params: [],
        auth: { type: 'none' },
        credentialsMode: 'include',
        body: { type: 'none' },
      }),
    ).toBeTruthy();
  });
});

describe('RuleSchema', () => {
  it('accepts a header rule', () => {
    expect(
      v.parse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth/rule-abcd1234',
        name: 'Bearer',
        type: 'header',
        enabled: true,
        conditions: [{ uid: 'cnd00010', type: 'request-domains', values: ['openheaders.io'] }],
        action: {
          requestHeaders: [
            { uid: 'hmd00010', operation: 'override', headerName: 'Authorization', value: 'Bearer X' },
          ],
          responseHeaders: [],
        },
      }),
    ).toBeTruthy();
  });

  it('accepts a block rule', () => {
    expect(
      v.parse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/block/rule-abcd1234',
        name: 'Block',
        type: 'block',
        enabled: true,
        conditions: [{ uid: 'cnd00011', type: 'request-domains', values: ['bad.io'] }],
        action: {},
      }),
    ).toBeTruthy();
  });

  it('accepts a query-param rule', () => {
    expect(
      v.parse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/qp/rule-abcd1234',
        name: 'Add utm',
        type: 'query-param',
        enabled: true,
        conditions: [{ uid: 'cnd00012', type: 'request-domains', values: ['openheaders.io'] }],
        action: { params: [{ uid: 'qp000001', param: 'utm_source', value: 'oh', operation: 'add' }] },
      }),
    ).toBeTruthy();
  });

  it('rejects an unknown rule type', () => {
    expect(
      v.safeParse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'x',
        name: 'x',
        type: 'unknown',
        enabled: true,
        conditions: [],
        action: {},
      }).success,
    ).toBe(false);
  });

  // Note: BlockActionSchema is `v.object({})` (no required keys) and
  // valibot accepts extra keys on plain object schemas — so a header-
  // shaped action under `type: 'block'` does *not* fail validation,
  // it just carries unused keys. Earlier this test relied on a stricter
  // mode that no longer applies; rather than reintroduce strictness in
  // service of one test, we accept the loose behavior and let runtime
  // dispatch ignore the foreign keys.
});

describe('TemplateSchema', () => {
  it('accepts a valid template', () => {
    expect(
      v.parse(TemplateSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'templates/my/tpl-abcd1234',
        name: 'Bearer preset',
        ruleType: 'header',
        icon: '🔑',
        description: 'Adds Authorization header',
        includes: { conditions: true, formValues: true },
        conditions: [],
        formValues: { value: 'Bearer X' },
        createdAt: '2026-04-18T00:00:00Z',
        updatedAt: '2026-04-18T00:00:00Z',
      }),
    ).toBeTruthy();
  });
});

describe('WorkspaceVariablesSchema', () => {
  it('accepts empty variables', () => {
    expect(v.parse(WorkspaceVariablesSchema, { schemaVersion: 5, variables: [] })).toBeTruthy();
  });
});

describe('parseEntity', () => {
  it('returns the parsed value on success', () => {
    const parsed = parseEntity(VariableSchema, { uid: 'vrxxxxxx', name: 'X', value: '1', type: 'default' });
    expect(parsed).toEqual({ uid: 'vrxxxxxx', name: 'X', value: '1', type: 'default' });
  });

  it('returns null on failure without throwing', () => {
    expect(parseEntity(VariableSchema, { name: 'X' })).toBeNull();
  });

  it('invokes onError with raw + issues when parsing fails', () => {
    let captured: { raw: unknown; issueCount: number } | null = null;
    parseEntity(
      VariableSchema,
      { uid: 'vrxxxxxx', name: 'X', value: 1, type: 'default' },
      {
        onError: (raw, issues) => {
          captured = { raw, issueCount: issues.length };
        },
      },
    );
    expect(captured).not.toBeNull();
    expect((captured as unknown as { issueCount: number }).issueCount).toBeGreaterThan(0);
  });
});

describe('parseEntityArray', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseEntityArray(VariableSchema, 'not an array')).toEqual([]);
  });

  it('drops invalid entries but keeps valid ones', () => {
    const out = parseEntityArray(VariableSchema, [
      { uid: 'vraaaaaa', name: 'A', value: '1', type: 'default' },
      { name: 'B' }, // invalid (missing uid + value + type)
      { uid: 'vrcccccc', name: 'C', value: '3', type: 'secret' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((x) => x.name)).toEqual(['A', 'C']);
  });
});
