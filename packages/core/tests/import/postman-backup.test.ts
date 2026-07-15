/**
 * Postman backup importer coverage.
 *
 * Fixtures are hand-authored against the envelope schema verified on a
 * live install (MIGRATION_PLAN.md §2.2): `{version: 1, collections,
 * environments, headerPresets, globals}`. Sections mirror the parser:
 * envelope validation, per-section delegation, legacy-v1 handling,
 * header presets, aggregate report + redaction.
 */

import { describe, expect, it } from 'vitest';
import { PostmanBackupParseError, parsePostmanBackup } from '../../src/import/postman-backup';
import { stripUids } from './_kv-utils';

// ── Helpers ─────────────────────────────────────────────────────────

function backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    collections: [],
    environments: [],
    headerPresets: [],
    globals: [],
    ...overrides,
  });
}

function v21Collection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    info: {
      name: 'Backed-up Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [{ name: 'Ping', request: { method: 'GET', url: 'https://api.openheaders.io/ping' } }],
    ...overrides,
  };
}

// ── Envelope validation ────────────────────────────────────────────

describe('parsePostmanBackup — envelope', () => {
  it('throws PostmanBackupParseError on invalid JSON', () => {
    expect(() => parsePostmanBackup('not json')).toThrow(PostmanBackupParseError);
  });

  it('throws on non-object root', () => {
    expect(() => parsePostmanBackup('[1,2]')).toThrow(PostmanBackupParseError);
    expect(() => parsePostmanBackup('"nope"')).toThrow(PostmanBackupParseError);
  });

  it('throws a structured error on an unknown version', () => {
    expect(() => parsePostmanBackup(backup({ version: 2 }))).toThrow(PostmanBackupParseError);
    expect(() => parsePostmanBackup(backup({ version: 2 }))).toThrow(/version 2/);
  });

  it('throws on a missing version', () => {
    expect(() => parsePostmanBackup(JSON.stringify({ collections: [] }))).toThrow(PostmanBackupParseError);
  });

  it('accepts an empty backup (cloud-signed-in users)', () => {
    const result = parsePostmanBackup(backup());
    expect(result.collections).toEqual([]);
    expect(result.environments).toEqual([]);
    expect(result.globals).toBeNull();
    expect(result.headerPresets).toEqual([]);
    expect(result.counts).toEqual({ collections: 0, environments: 0, globals: 0, headerPresets: 0 });
    expect(result.report.source).toBe('postman-backup');
    expect(result.report.summary).toEqual({ imported: 0, dropped: 0, transformed: 0 });
  });

  it('drops a non-array section with a report entry', () => {
    const result = parsePostmanBackup(backup({ collections: {} }));
    expect(result.collections).toEqual([]);
    expect(result.report.drops.some((d) => d.path === 'backup.collections')).toBe(true);
  });
});

// ── Collections delegation ─────────────────────────────────────────

describe('collections[]', () => {
  it('delegates v2.1 entries to the collection parser', () => {
    const result = parsePostmanBackup(backup({ collections: [v21Collection()] }));
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]?.collectionName).toBe('Backed-up Collection');
    expect(result.collections[0]?.requests).toHaveLength(1);
    expect(result.counts.collections).toBe(1);
    expect(result.report.summary.imported).toBe(1);
  });

  it('merges sub-parser drops into the aggregate report with prefixed paths', () => {
    const withOauth = v21Collection({
      item: [
        {
          name: 'Secure',
          request: { method: 'GET', url: 'https://api.openheaders.io/secure', auth: { type: 'oauth2' } },
        },
      ],
    });
    const result = parsePostmanBackup(backup({ collections: [withOauth] }));
    const drop = result.report.drops.find((d) => /OAuth 2\.0/.test(d.reason));
    expect(drop).toBeDefined();
    expect(drop?.path.startsWith('backup.collections[0].')).toBe(true);
    expect(result.report.summary.dropped).toBe(1);
  });

  it('drops a legacy v1-shaped collection whole with guidance', () => {
    const legacy = { id: 'abc', name: 'Old Collection', order: [], folders: [], requests: [] };
    const result = parsePostmanBackup(backup({ collections: [legacy] }));
    expect(result.collections).toEqual([]);
    const drop = result.report.drops.find((d) => d.path === 'backup.collections[0]');
    expect(drop?.reason).toMatch(/legacy v1 collection format/);
    expect(drop?.tracking).toBe('#todo-backup-v1-collections');
  });

  it('drops unrecognized collection shapes and non-objects', () => {
    const result = parsePostmanBackup(backup({ collections: [42, { random: true }] }));
    expect(result.collections).toEqual([]);
    expect(result.report.drops).toHaveLength(2);
  });

  it('keeps parsing later collections after a bad entry', () => {
    const result = parsePostmanBackup(backup({ collections: [{ random: true }, v21Collection()] }));
    expect(result.collections).toHaveLength(1);
    expect(result.report.drops.some((d) => d.path === 'backup.collections[0]')).toBe(true);
  });
});

// ── Environments + globals ─────────────────────────────────────────

describe('environments[] + globals[]', () => {
  it('delegates environments to the environment parser', () => {
    const result = parsePostmanBackup(
      backup({
        environments: [
          {
            id: 'env-1',
            name: 'Staging',
            values: [
              { key: 'host', value: 'staging.openheaders.io', enabled: true },
              { key: 'apiKey', value: 'abc123', type: 'secret', enabled: true },
            ],
          },
        ],
      }),
    );
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0]?.name).toBe('Staging');
    expect(result.environments[0]?.variables).toEqual([
      { name: 'host', value: 'staging.openheaders.io', type: 'default', description: undefined },
      { name: 'apiKey', value: 'abc123', type: 'secret', description: undefined },
    ]);
    expect(result.report.summary.imported).toBe(2);
  });

  it('drops an environment without a values array', () => {
    const result = parsePostmanBackup(backup({ environments: [{ name: 'Broken' }] }));
    expect(result.environments).toEqual([]);
    expect(result.report.drops.some((d) => d.path === 'backup.environments[0]')).toBe(true);
  });

  it('lands value-row globals as one environment named Globals', () => {
    const result = parsePostmanBackup(backup({ globals: [{ key: 'region', value: 'eu-west', enabled: true }] }));
    expect(result.globals?.name).toBe('Globals');
    expect(result.globals?.variables).toEqual([
      { name: 'region', value: 'eu-west', type: 'default', description: undefined },
    ]);
    expect(result.counts.globals).toBe(1);
  });

  it('lands scope-object globals under the scope name', () => {
    const result = parsePostmanBackup(
      backup({ globals: [{ name: 'My Globals', values: [{ key: 'region', value: 'eu-west', enabled: true }] }] }),
    );
    expect(result.globals?.name).toBe('My Globals');
    expect(result.globals?.variables).toHaveLength(1);
  });

  it('drops extra globals scopes beyond the first', () => {
    const result = parsePostmanBackup(
      backup({
        globals: [{ values: [{ key: 'a', value: '1' }] }, { values: [{ key: 'b', value: '2' }] }],
      }),
    );
    expect(result.globals?.variables).toHaveLength(1);
    expect(result.report.drops.some((d) => d.path === 'backup.globals[1]')).toBe(true);
  });

  it('drops unrecognized globals shapes', () => {
    const result = parsePostmanBackup(backup({ globals: ['what'] }));
    expect(result.globals).toBeNull();
    expect(result.report.drops.some((d) => d.path === 'backup.globals')).toBe(true);
  });
});

// ── Header presets ─────────────────────────────────────────────────

describe('headerPresets[]', () => {
  it('parses presets to named RequestHeader bundles', () => {
    const result = parsePostmanBackup(
      backup({
        headerPresets: [
          {
            id: 'preset-1',
            name: 'Tracing',
            headers: [
              { key: 'X-Trace-Id', value: '{{traceId}}' },
              { key: 'X-Debug', value: '1', disabled: true },
            ],
          },
        ],
      }),
    );
    expect(result.headerPresets).toHaveLength(1);
    expect(result.headerPresets[0]?.name).toBe('Tracing');
    expect(stripUids(result.headerPresets[0]!.headers)).toEqual([
      { key: 'X-Trace-Id', value: '{{traceId}}' },
      { key: 'X-Debug', value: '1', enabled: false },
    ]);
    expect(result.counts.headerPresets).toBe(1);
    expect(result.report.summary.imported).toBe(1);
  });

  it('treats enabled:false rows as disabled', () => {
    const result = parsePostmanBackup(
      backup({ headerPresets: [{ name: 'P', headers: [{ key: 'X-Off', value: 'v', enabled: false }] }] }),
    );
    expect(stripUids(result.headerPresets[0]!.headers)).toEqual([{ key: 'X-Off', value: 'v', enabled: false }]);
  });

  it('skips keyless rows and non-object rows without failing the preset', () => {
    const result = parsePostmanBackup(
      backup({ headerPresets: [{ name: 'P', headers: [{ value: 'no-key' }, 42, { key: 'Ok', value: 'v' }] }] }),
    );
    expect(stripUids(result.headerPresets[0]!.headers)).toEqual([{ key: 'Ok', value: 'v' }]);
  });

  it('defaults a missing preset name', () => {
    const result = parsePostmanBackup(backup({ headerPresets: [{ headers: [{ key: 'K', value: 'v' }] }] }));
    expect(result.headerPresets[0]?.name).toBe('Imported Preset');
  });

  it('drops a preset without a headers array', () => {
    const result = parsePostmanBackup(backup({ headerPresets: [{ name: 'Empty' }] }));
    expect(result.headerPresets).toEqual([]);
    expect(result.report.drops.some((d) => /"Empty"/.test(d.reason))).toBe(true);
  });
});

// ── Aggregate report + redaction ───────────────────────────────────

describe('aggregate report', () => {
  it('sums imported across sections', () => {
    const result = parsePostmanBackup(
      backup({
        collections: [v21Collection()],
        environments: [{ name: 'E', values: [{ key: 'a', value: '1' }] }],
        globals: [{ key: 'g', value: '2' }],
        headerPresets: [{ name: 'P', headers: [{ key: 'K', value: 'v' }] }],
      }),
    );
    // 1 request + 1 env variable + 1 global variable + 1 preset.
    expect(result.report.summary.imported).toBe(4);
    expect(result.counts).toEqual({ collections: 1, environments: 1, globals: 1, headerPresets: 1 });
  });

  it('never leaks secret values into report entries', () => {
    const secret = 'super-secret-token-abc123';
    const result = parsePostmanBackup(
      backup({
        environments: [
          {
            name: 'Prod',
            values: [
              { key: 'apiKey', value: secret, type: 'secret', enabled: true },
              { key: 'legacy', value: secret, type: 'secret', enabled: false },
            ],
          },
        ],
        headerPresets: [{ name: 'Auth', headers: [{ key: 'Authorization', value: `Bearer ${secret}` }] }],
      }),
    );
    // The disabled secret variable imports as a disabled row — no drop
    // entry, and no report entry ever carries the value.
    const prod = result.environments.find((e) => e.name === 'Prod');
    expect(prod?.variables.find((v) => v.name === 'legacy')).toMatchObject({ enabled: false, type: 'secret' });
    expect(JSON.stringify(result.report)).not.toContain(secret);
  });
});
