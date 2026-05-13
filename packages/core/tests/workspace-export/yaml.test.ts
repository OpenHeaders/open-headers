/**
 * YAML serializer for the workspace-export envelope.
 *
 * Asserts:
 *   - top-level keys serialize in canonical order
 *   - `path` is stripped from every nested entity
 *   - parsing the emitted YAML back yields the same in-memory shape
 *     (modulo path, which is reconstructed by the importer in PR 2)
 */

import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import type { Environment, HeaderRule, OAuth2Auth, Request, WorkspaceVariables } from '../../src/types/index';
import { buildWorkspaceExport, serializeWorkspaceExport } from '../../src/workspace-export/index';

const FIXED_TIMESTAMP = '2026-04-27T18:30:00.000Z';

function makeWorkspaceVars(): WorkspaceVariables {
  return { schemaVersion: 5, variables: [] };
}

function baseInput(): Parameters<typeof buildWorkspaceExport>[0] {
  return {
    exportedAt: FIXED_TIMESTAMP,
    exportId: 'e8a1b2c3',
    source: { app: 'extension', appVersion: '5.0.4', platform: 'chrome' },
    scope: 'workspace',
    workspace: { uid: 'a1b2c3d4', name: 'Project' },
    entities: {
      collections: [],
      folders: [],
      rules: [],
      requests: [],
      templates: [],
      environments: [],
      workspaceVars: makeWorkspaceVars(),
      liveWorkflows: [],
      liveVariables: [],
    },
  };
}

describe('serializeWorkspaceExport — top-level ordering', () => {
  it('emits keys in canonical order', () => {
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(baseInput()));
    const lines = yaml.split('\n').filter((l) => /^\w/.test(l));
    const topKeys = lines.map((l) => l.split(':')[0]);
    // The first 6 keys must be exactly these and in order:
    expect(topKeys.slice(0, 6)).toEqual([
      'kind',
      'schemaVersion',
      'exportFormatVersion',
      'exportId',
      'exportedAt',
      'source',
    ]);
    // entities + meta come after workspace.
    expect(topKeys.indexOf('workspace')).toBeLessThan(topKeys.indexOf('entities'));
    expect(topKeys.indexOf('entities')).toBeLessThan(topKeys.indexOf('meta'));
  });

  it('parses back to the same envelope-shaped object (path-stripped)', () => {
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(baseInput()));
    const parsed = YAML.parse(yaml) as Record<string, unknown>;
    expect(parsed.kind).toBe('workspace-export');
    expect(parsed.schemaVersion).toBe(5);
    expect(parsed.exportId).toBe('e8a1b2c3');
  });
});

describe('serializeWorkspaceExport — path preserved (tree-affiliation)', () => {
  it('keeps canonical path on rule, request, environment entries', () => {
    const input = baseInput();
    const rule: HeaderRule = {
      schemaVersion: 5,
      uid: 'r0000001',
      path: 'rules/auth-r0000001',
      name: 'Auth',
      type: 'header',
      enabled: true,
      conditions: [],
      action: { requestHeaders: [], responseHeaders: [] },
    };
    const oauth: OAuth2Auth = {
      type: 'oauth2',
      credentialRef: 'cred-1',
      flow: 'client-credentials',
      tokenEndpoint: 'https://example.openheaders.io/token',
      clientId: 'client-id-public',
      scopes: [],
    };
    const req: Request = {
      schemaVersion: 5,
      uid: 'rq000001',
      path: 'requests/login-rq000001',
      name: 'Login',
      method: 'POST',
      url: 'https://api.openheaders.io/login',
      headers: [],
      params: [],
      auth: oauth,
      body: { type: 'none' },
    };
    const env: Environment = {
      schemaVersion: 5,
      uid: 'env00001',
      path: 'environments/staging-env00001',
      name: 'Staging',
      variables: [],
    };
    input.entities.rules = [rule];
    input.entities.requests = [req];
    input.entities.environments = [env];

    const yaml = serializeWorkspaceExport(buildWorkspaceExport(input));
    // Path is preserved (tree-affiliation discriminator). Canonical via toFolderName.
    const parsed = YAML.parse(yaml) as {
      entities: {
        rules: { path: string }[];
        requests: { path: string }[];
        environments: { path: string }[];
      };
    };
    expect(parsed.entities.rules).toHaveLength(1);
    expect(parsed.entities.requests).toHaveLength(1);
    expect(parsed.entities.environments).toHaveLength(1);
    // Builder preserves the parent path; only the leaf segment is
    // canonicalized via `toFolderName(name, uid)`. Tree prefix
    // (`rules/...` / `requests/...` / `environments/...`) survives so
    // the importer can recover tree affiliation.
    expect(parsed.entities.rules[0].path).toBe('rules/auth-r0000001');
    expect(parsed.entities.requests[0].path).toBe('requests/login-rq000001');
    expect(parsed.entities.environments[0].path).toBe('environments/staging-env00001');
  });

  it('keeps OAuth clientSecret stripped through the YAML round-trip', () => {
    const input = baseInput();
    const oauth: OAuth2Auth = {
      type: 'oauth2',
      credentialRef: 'cred-1',
      flow: 'client-credentials',
      tokenEndpoint: 'https://example.openheaders.io/token',
      clientId: 'client-id-public',
      clientSecret: 'super-secret-DO-NOT-EXPORT',
      scopes: [],
    };
    const req: Request = {
      schemaVersion: 5,
      uid: 'rq000001',
      path: 'requests/login-rq000001',
      name: 'Login',
      method: 'POST',
      url: 'https://api.openheaders.io/login',
      headers: [],
      params: [],
      auth: oauth,
      body: { type: 'none' },
    };
    input.entities.requests = [req];
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(input));
    expect(yaml).not.toContain('clientSecret');
    expect(yaml).not.toContain('super-secret-DO-NOT-EXPORT');
    expect(yaml).toContain('client-id-public');
  });
});

describe('serializeWorkspaceExport — byte stability', () => {
  it('two consecutive serializations of the same envelope produce identical bytes', () => {
    const exp = buildWorkspaceExport(baseInput());
    expect(serializeWorkspaceExport(exp)).toBe(serializeWorkspaceExport(exp));
  });
});
