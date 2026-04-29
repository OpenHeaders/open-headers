/**
 * `parseWorkspaceExport` — every gate's accept + reject path.
 *
 * The validation pipeline is the import boundary's only line of
 * defence; this file is the regression net for it.
 */

import { describe, expect, it } from 'vitest';
import type { Environment, HeaderRule, OAuth2Auth, Request, WorkspaceVariables } from '../../src/types/v5/index';
import { buildWorkspaceExport, parseWorkspaceExport, serializeWorkspaceExport } from '../../src/workspace-export/index';

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

function buildAndSerialize(input = baseInput()): string {
  return serializeWorkspaceExport(buildWorkspaceExport(input));
}

// ── Happy path ─────────────────────────────────────────────────────

describe('parseWorkspaceExport — happy path', () => {
  it('round-trips an empty workspace export', () => {
    const yaml = buildAndSerialize();
    const parsed = parseWorkspaceExport(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.export.kind).toBe('workspace-export');
    expect(parsed.export.schemaVersion).toBe(5);
    expect(parsed.export.exportId).toBe('e8a1b2c3');
    expect(parsed.drops).toEqual([]);
  });

  it('round-trips an envelope with rules + requests + environments', () => {
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
      tokenEndpoint: 'https://api.openheaders.io/token',
      clientId: 'public',
      scopes: [],
    };
    const req: Request = {
      schemaVersion: 5,
      version: 1,
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
    const parsed = parseWorkspaceExport(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.export.entities.rules).toHaveLength(1);
    expect(parsed.export.entities.requests).toHaveLength(1);
    expect(parsed.export.entities.environments).toHaveLength(1);
  });

  it('accepts JSON in addition to YAML', () => {
    const yaml = buildAndSerialize();
    const exp = parseWorkspaceExport(yaml);
    if (!exp.ok) throw new Error('seed should parse');
    const json = JSON.stringify(exp.export);
    const parsed = parseWorkspaceExport(json);
    expect(parsed.ok).toBe(true);
  });
});

// ── Gate 1: size cap ───────────────────────────────────────────────

describe('parseWorkspaceExport — gate 1 (size cap)', () => {
  it('rejects input larger than the configured cap', () => {
    const huge = 'a'.repeat(1024);
    const parsed = parseWorkspaceExport(huge, { sizeCapBytes: 512 });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('size-cap');
  });

  it('uses byte length, not character count, against the cap', () => {
    // 4-byte UTF-8 emoji × 200 = 800 bytes; 200-char cap would pass.
    const emoji = '🚀'.repeat(200);
    const parsed = parseWorkspaceExport(emoji, { sizeCapBytes: 600 });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('size-cap');
  });
});

// ── Gate 2: format detection ───────────────────────────────────────

describe('parseWorkspaceExport — gate 2 (format)', () => {
  it('rejects non-JSON, non-YAML garbage', () => {
    // yaml is permissive — most random strings parse to scalars or
    // strings; we trip the "top-level must be an object" branch.
    const parsed = parseWorkspaceExport('::: not a real document :::');
    expect(parsed.ok).toBe(false);
  });

  it('rejects a top-level non-object (array)', () => {
    const parsed = parseWorkspaceExport('[1, 2, 3]');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('format');
  });
});

// ── Gate 3: discriminator ──────────────────────────────────────────

describe('parseWorkspaceExport — gate 3 (discriminator)', () => {
  it('rejects a kind that is not the literal workspace-export', () => {
    const parsed = parseWorkspaceExport(JSON.stringify({ kind: 'workspace_export', schemaVersion: 5 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('discriminator');
  });

  it('rejects a missing kind', () => {
    const parsed = parseWorkspaceExport(JSON.stringify({ schemaVersion: 5 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('discriminator');
  });

  it('rejects a stray rule.yaml that happens to parse as object', () => {
    const ruleYaml =
      'schemaVersion: 5\nversion: 1\nuid: r0000001\nname: Auth\ntype: header\nenabled: true\nconditions: []\naction:\n  requestHeaders: []\n  responseHeaders: []\n';
    const parsed = parseWorkspaceExport(ruleYaml);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('discriminator');
  });
});

// ── Gate 4: schemaVersion ──────────────────────────────────────────

describe('parseWorkspaceExport — gate 4 (schemaVersion)', () => {
  it('rejects schemaVersion: 4', () => {
    const parsed = parseWorkspaceExport(JSON.stringify({ kind: 'workspace-export', schemaVersion: 4 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('schema-version');
  });

  it('rejects schemaVersion: 6 (newer than current)', () => {
    const parsed = parseWorkspaceExport(JSON.stringify({ kind: 'workspace-export', schemaVersion: 6 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('schema-version');
  });
});

// ── Gate 4b: exportFormatVersion ──────────────────────────────────

describe('parseWorkspaceExport — gate 4b (exportFormatVersion)', () => {
  it('rejects an envelope with a newer exportFormatVersion than the importer supports', () => {
    const parsed = parseWorkspaceExport(
      JSON.stringify({ kind: 'workspace-export', schemaVersion: 5, exportFormatVersion: 999 }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('export-format-version');
  });
});

// ── Gate 5: envelope schema ────────────────────────────────────────

describe('parseWorkspaceExport — gate 5 (envelope schema)', () => {
  it('rejects an unknown source.app value', () => {
    const yaml = buildAndSerialize();
    // Replace `extension` with a non-picklist value.
    const tampered = yaml.replace('app: extension', 'app: malicious-tool');
    const parsed = parseWorkspaceExport(tampered);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('envelope-schema');
  });

  it('rejects an exportId that is not the canonical 8-char shape', () => {
    const yaml = buildAndSerialize().replace('exportId: e8a1b2c3', 'exportId: NOT-VALID');
    const parsed = parseWorkspaceExport(yaml);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('envelope-schema');
  });
});

// ── Gate 6: per-entity (fail-soft) ─────────────────────────────────

describe('parseWorkspaceExport — gate 6 (per-entity fail-soft)', () => {
  it('drops a malformed rule and keeps siblings', () => {
    const input = baseInput();
    const goodRule: HeaderRule = {
      schemaVersion: 5,
      uid: 'good0001',
      path: 'rules/good-good0001',
      name: 'Good',
      type: 'header',
      enabled: true,
      conditions: [],
      action: { requestHeaders: [], responseHeaders: [] },
    };
    input.entities.rules = [goodRule];
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(input));
    // Inject a malformed rule sibling by appending to the rules array
    // post-serialize. Easier than building a malformed entity through
    // the typed builder.
    const parsed1 = parseWorkspaceExport(yaml);
    if (!parsed1.ok) throw new Error('seed should parse');
    const tampered = JSON.stringify({
      ...parsed1.export,
      entities: {
        ...parsed1.export.entities,
        rules: [
          parsed1.export.entities.rules[0],
          { schemaVersion: 5, uid: 'bad00001', name: 'bad' /* missing type/action/etc. */ },
        ],
      },
    });
    const parsed2 = parseWorkspaceExport(tampered);
    expect(parsed2.ok).toBe(true);
    if (!parsed2.ok) return;
    expect(parsed2.export.entities.rules).toHaveLength(1);
    expect(parsed2.drops).toHaveLength(1);
    expect(parsed2.drops[0].path).toBe('entities.rules[1]');
    expect(parsed2.drops[0].reason).toBe('schema-invalid');
    expect(parsed2.drops[0].uid).toBe('bad00001');
    expect(parsed2.drops[0].name).toBe('bad');
  });

  it('drops a malformed workspaceVars and proceeds with a fresh empty', () => {
    const yaml = buildAndSerialize();
    const parsed1 = parseWorkspaceExport(yaml);
    if (!parsed1.ok) throw new Error('seed should parse');
    const tampered = JSON.stringify({
      ...parsed1.export,
      entities: {
        ...parsed1.export.entities,
        workspaceVars: { schemaVersion: 5 /* missing version + variables */ },
      },
    });
    const parsed2 = parseWorkspaceExport(tampered);
    expect(parsed2.ok).toBe(true);
    if (!parsed2.ok) return;
    expect(parsed2.drops.some((d) => d.path === 'entities.workspaceVars')).toBe(true);
    expect(parsed2.export.entities.workspaceVars.variables).toEqual([]);
  });
});

// ── Adversarial inputs ─────────────────────────────────────────────

describe('parseWorkspaceExport — adversarial', () => {
  it('rejects a YAML object whose discriminator value is `__proto__`', () => {
    const parsed = parseWorkspaceExport(JSON.stringify({ kind: '__proto__', schemaVersion: 5 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('discriminator');
  });

  it('rejects an envelope with kind: null', () => {
    const parsed = parseWorkspaceExport(JSON.stringify({ kind: null, schemaVersion: 5 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('discriminator');
  });

  it('round-trips identically across LF and CRLF clipboard line endings', () => {
    const yamlLf = buildAndSerialize();
    const yamlCrlf = yamlLf.replace(/\n/g, '\r\n');
    const parsedLf = parseWorkspaceExport(yamlLf);
    const parsedCrlf = parseWorkspaceExport(yamlCrlf);
    expect(parsedLf.ok && parsedCrlf.ok).toBe(true);
    if (!parsedLf.ok || !parsedCrlf.ok) return;
    expect(parsedCrlf.export).toEqual(parsedLf.export);
  });
});
