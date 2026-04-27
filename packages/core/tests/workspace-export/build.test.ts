/**
 * Workspace-export builder coverage.
 *
 * Asserts the builder produces a valibot-valid envelope, applies the
 * always-on strip rules (OAuth `clientSecret`, OAuth tokens never
 * present), reconstructs canonical paths, and refuses unimplemented
 * vault include modes.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type {
  Collection,
  Environment,
  Folder,
  HeaderRule,
  LiveVariable,
  LiveWorkflow,
  OAuth2Auth,
  Request,
  Template,
  WorkspaceVariables,
} from '../../src/types/v5/index';
import {
  buildWorkspaceExport,
  CURRENT_EXPORT_FORMAT_VERSION,
  WorkspaceExportSchema,
} from '../../src/workspace-export/index';

const FIXED_TIMESTAMP = '2026-04-27T18:30:00.000Z';
const WORKSPACE_UID = 'a1b2c3d4';
const EXPORT_ID = 'e8a1b2c3';

// ── Factories (schema-valid by construction) ───────────────────────

function makeWorkspaceVars(overrides: Partial<WorkspaceVariables> = {}): WorkspaceVariables {
  return { schemaVersion: 5, version: 1, variables: [], ...overrides };
}

function makeHeaderRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'r0000001',
    path: 'will-be-canonicalized',
    name: 'Auth',
    type: 'header',
    enabled: true,
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'rq000001',
    path: 'requests/login-rq000001',
    name: 'Login',
    method: 'POST',
    url: 'https://api.openheaders.io/login',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

function makeOAuthRequest(overrides: Partial<OAuth2Auth> = {}): Request {
  const oauth: OAuth2Auth = {
    type: 'oauth2',
    credentialRef: 'cred-1',
    flow: 'client-credentials',
    tokenEndpoint: 'https://example.openheaders.io/token',
    clientId: 'client-id-public',
    clientSecret: 'super-sensitive-DO-NOT-EXPORT',
    scopes: ['read'],
    ...overrides,
  };
  return makeRequest({ auth: oauth });
}

function makeEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'env00001',
    path: 'whatever',
    name: 'Staging',
    variables: [],
    ...overrides,
  };
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'col00001',
    path: 'old-path',
    name: 'API Calls',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'fld00001',
    path: 'old-path',
    name: 'Auth',
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'tpl00001',
    path: 'tpl-path',
    name: 'Bearer',
    ruleType: 'header',
    icon: 'shield',
    description: '',
    includes: { conditions: true, formValues: true },
    conditions: [],
    formValues: {},
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

function makeLiveWorkflow(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'wf000001',
    path: 'lw-path',
    name: 'Refresh token',
    enabled: true,
    steps: [],
    refresh: { kind: 'manual' },
    ...overrides,
  };
}

function makeLiveVariable(overrides: Partial<LiveVariable> = {}): LiveVariable {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'lv000001',
    path: 'lv-path',
    name: 'TOKEN',
    enabled: true,
    workflowUid: 'wf000001',
    stepId: 's1',
    captureName: 'token',
    ...overrides,
  };
}

function emptyEntities(): Parameters<typeof buildWorkspaceExport>[0]['entities'] {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    workspaceVars: makeWorkspaceVars(),
    liveWorkflows: [],
    liveVariables: [],
  };
}

function baseInput(): Parameters<typeof buildWorkspaceExport>[0] {
  return {
    exportedAt: FIXED_TIMESTAMP,
    exportId: EXPORT_ID,
    source: { app: 'extension', appVersion: '5.0.4', platform: 'chrome', workspaceLabel: 'My API Project' },
    scope: 'workspace',
    workspace: {
      uid: WORKSPACE_UID,
      name: 'My API Project',
      description: 'staging stack',
      color: 'blue',
      icon: 'shield',
    },
    entities: emptyEntities(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('buildWorkspaceExport — envelope shape', () => {
  it('produces a schema-valid envelope from minimal input', () => {
    const exp = buildWorkspaceExport(baseInput());
    const parsed = v.safeParse(WorkspaceExportSchema, exp);
    if (!parsed.success) {
      // surface valibot issues for debugging
      throw new Error(`schema rejected: ${JSON.stringify(parsed.issues, null, 2)}`);
    }
    expect(parsed.success).toBe(true);
    expect(exp.kind).toBe('workspace-export');
    expect(exp.schemaVersion).toBe(5);
    expect(exp.exportFormatVersion).toBe(CURRENT_EXPORT_FORMAT_VERSION);
    expect(exp.exportId).toBe(EXPORT_ID);
    expect(exp.exportedAt).toBe(FIXED_TIMESTAMP);
    expect(exp.scope).toBe('workspace');
  });

  it('defaults vault redaction to omitted; ephemeral redactions are always omitted', () => {
    const exp = buildWorkspaceExport(baseInput());
    expect(exp.meta.redactions).toEqual({
      vault: 'omitted',
      liveCache: 'omitted',
      oauthTokens: 'omitted',
      totpCooldowns: 'omitted',
    });
  });

  it('reports counts derived from the entity arrays', () => {
    const input = baseInput();
    input.entities.rules = [makeHeaderRule()];
    input.entities.requests = [makeRequest()];
    input.entities.environments = [makeEnvironment()];
    input.entities.templates = [makeTemplate()];
    input.entities.liveWorkflows = [makeLiveWorkflow()];
    input.entities.liveVariables = [makeLiveVariable()];
    const exp = buildWorkspaceExport(input);
    expect(exp.meta.counts.rules).toBe(1);
    expect(exp.meta.counts.requests).toBe(1);
    expect(exp.meta.counts.environments).toBe(1);
    expect(exp.meta.counts.templates).toBe(1);
    expect(exp.meta.counts.liveWorkflows).toBe(1);
    expect(exp.meta.counts.liveVariables).toBe(1);
    expect(exp.meta.counts.secrets).toBe(0);
  });
});

describe('buildWorkspaceExport — strip rules', () => {
  it('removes OAuth2 clientSecret from request.auth', () => {
    const input = baseInput();
    input.entities.requests = [makeOAuthRequest()];

    const exp = buildWorkspaceExport(input);
    const builtAuth = exp.entities.requests[0].auth;
    expect(builtAuth.type).toBe('oauth2');
    if (builtAuth.type !== 'oauth2') throw new Error('unreachable');
    expect(builtAuth.clientId).toBe('client-id-public');
    expect('clientSecret' in builtAuth).toBe(false);
  });

  it('canonicalizes path via toFolderName(name, uid) regardless of input', () => {
    const input = baseInput();
    input.entities.environments = [makeEnvironment({ path: 'totally-wrong-path', name: 'Staging' })];
    const exp = buildWorkspaceExport(input);
    expect(exp.entities.environments[0].path).toBe('staging-env00001');
  });

  it('passes through collections, folders, templates with canonicalized paths', () => {
    const input = baseInput();
    input.entities.collections = [makeCollection({ path: 'old-path', name: 'API Calls' })];
    input.entities.folders = [makeFolder({ path: 'old-path', name: 'Auth' })];
    input.entities.templates = [makeTemplate({ path: 'old-path', name: 'Bearer' })];
    const exp = buildWorkspaceExport(input);
    expect(exp.entities.collections[0].path).toBe('api-calls-col00001');
    expect(exp.entities.folders[0].path).toBe('auth-fld00001');
    expect(exp.entities.templates[0].path).toBe('bearer-tpl00001');
  });

  it('preserves live workflows and live variables verbatim', () => {
    const input = baseInput();
    input.entities.liveWorkflows = [makeLiveWorkflow()];
    input.entities.liveVariables = [makeLiveVariable()];
    const exp = buildWorkspaceExport(input);
    expect(exp.entities.liveWorkflows).toHaveLength(1);
    expect(exp.entities.liveVariables).toHaveLength(1);
    expect(exp.entities.liveWorkflows[0].uid).toBe('wf000001');
    expect(exp.entities.liveVariables[0].workflowUid).toBe('wf000001');
  });
});

describe('buildWorkspaceExport — vault include modes', () => {
  it('defaults to omitted (no vault, secrets count = 0)', () => {
    const exp = buildWorkspaceExport(baseInput());
    expect(exp.entities.vault).toBeUndefined();
    expect(exp.secrets).toBeUndefined();
    expect(exp.meta.counts.secrets).toBe(0);
  });

  it('refuses encrypted mode in PR 1 (lands in PR 4)', () => {
    expect(() => buildWorkspaceExport(baseInput(), { vaultMode: 'encrypted' })).toThrow(/PR 4/);
  });

  it('refuses plaintext mode in PR 1 (lands in PR 4)', () => {
    expect(() => buildWorkspaceExport(baseInput(), { vaultMode: 'plaintext' })).toThrow(/PR 4/);
  });
});

describe('buildWorkspaceExport — fresh exportId when not pinned', () => {
  it('generates a fresh 8-char uid when none supplied', () => {
    const input = { ...baseInput(), exportId: undefined };
    const exp = buildWorkspaceExport(input);
    expect(exp.exportId).toMatch(/^[a-z0-9]{8}$/);
  });

  it('produces different exportIds across consecutive calls', () => {
    const a = buildWorkspaceExport({ ...baseInput(), exportId: undefined });
    const b = buildWorkspaceExport({ ...baseInput(), exportId: undefined });
    expect(a.exportId).not.toBe(b.exportId);
  });
});

describe('buildWorkspaceExport — non-ASCII names round-trip', () => {
  it('toFolderName handles emoji + RTL + mixed scripts', () => {
    const input = baseInput();
    input.entities.environments = [makeEnvironment({ uid: 'env00002', name: '🚀 الإنتاج Production' })];
    const exp = buildWorkspaceExport(input);
    // Slug strips non-ASCII; falls back to uid-only when the slug is empty,
    // or appends `-uid` when something survives.
    expect(exp.entities.environments[0].path).toMatch(/env00002$/);
  });
});
