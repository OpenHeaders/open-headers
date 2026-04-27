/**
 * ImportReport schema + builder helpers.
 *
 * Shape test for the report — every importer will produce this
 * exact structure, so catching schema drift here prevents per-importer
 * reinvention later.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  createReport,
  createWorkspaceExportReport,
  FLAT_IMPORT_SOURCES,
  hashImportSource,
  IMPORT_SOURCES,
  ImportReportSchema,
  recordDrop,
  recordTransform,
  WorkspaceExportImportReportSchema,
} from '../../src/import/report';

describe('ImportReportSchema', () => {
  it('accepts a minimal empty report', () => {
    const report = {
      schemaVersion: 5,
      source: 'curl' as const,
      sourceHash: '',
      importedAt: '2026-04-19T00:00:00Z',
      summary: { imported: 1, dropped: 0, transformed: 0 },
      drops: [],
      transforms: [],
    };
    expect(v.parse(ImportReportSchema, report)).toEqual(report);
  });

  it('rejects an unknown source', () => {
    expect(
      v.safeParse(ImportReportSchema, {
        schemaVersion: 5,
        source: 'made-up',
        sourceHash: '',
        importedAt: '2026',
        summary: { imported: 0, dropped: 0, transformed: 0 },
        drops: [],
        transforms: [],
      }).success,
    ).toBe(false);
  });

  it('rejects negative summary counts', () => {
    expect(
      v.safeParse(ImportReportSchema, {
        schemaVersion: 5,
        source: 'curl',
        sourceHash: '',
        importedAt: '2026',
        summary: { imported: -1, dropped: 0, transformed: 0 },
        drops: [],
        transforms: [],
      }).success,
    ).toBe(false);
  });

  it('accepts every flat IMPORT_SOURCES value', () => {
    for (const source of FLAT_IMPORT_SOURCES) {
      const parsed = v.safeParse(ImportReportSchema, {
        schemaVersion: 5,
        source,
        sourceHash: '',
        importedAt: '2026',
        summary: { imported: 0, dropped: 0, transformed: 0 },
        drops: [],
        transforms: [],
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('accepts a workspace-export report with the required extra fields', () => {
    const report = {
      schemaVersion: 5,
      source: 'workspace-export' as const,
      sourceHash: '',
      importedAt: '2026',
      summary: { imported: 0, dropped: 0, transformed: 0 },
      drops: [],
      transforms: [],
      exportId: 'a1b2c3d4',
      perEntityStrategies: { 'rules:abcd1234': 'new-uid' as const },
      missingDeps: [{ type: 'env' as const, name: 'STAGING', referencedBy: ['rules:abcd1234'] }],
      targetMode: 'current' as const,
      sourceWorkspaceLabel: 'My Workspace',
      sourceAppVersion: '5.0.4',
    };
    expect(v.parse(WorkspaceExportImportReportSchema, report)).toEqual(report);
    expect(v.parse(ImportReportSchema, report)).toEqual(report);
  });

  it('rejects a workspace-export report missing the extra fields', () => {
    expect(
      v.safeParse(ImportReportSchema, {
        schemaVersion: 5,
        source: 'workspace-export',
        sourceHash: '',
        importedAt: '2026',
        summary: { imported: 0, dropped: 0, transformed: 0 },
        drops: [],
        transforms: [],
      }).success,
    ).toBe(false);
  });

  it('exposes workspace-export in the IMPORT_SOURCES picklist', () => {
    expect(IMPORT_SOURCES).toContain('workspace-export');
  });
});

describe('createWorkspaceExportReport', () => {
  it('builds a workspace-export arm with defaults populated', () => {
    const report = createWorkspaceExportReport({
      exportId: 'a1b2c3d4',
      targetMode: 'new',
      sourceWorkspaceLabel: 'Test Workspace',
      sourceAppVersion: '5.0.4',
    });
    expect(report.source).toBe('workspace-export');
    expect(report.exportId).toBe('a1b2c3d4');
    expect(report.perEntityStrategies).toEqual({});
    expect(report.missingDeps).toEqual([]);
    expect(report.targetMode).toBe('new');
    expect(v.parse(WorkspaceExportImportReportSchema, report)).toEqual(report);
  });
});

describe('createReport / recordDrop / recordTransform', () => {
  it('initializes summary from the imported count', () => {
    const report = createReport('curl', 3);
    expect(report.summary).toEqual({ imported: 3, dropped: 0, transformed: 0 });
  });

  it('increments dropped count + appends the entry', () => {
    const report = createReport('curl');
    recordDrop(report, { path: 'flag:-k', reason: 'no tls bypass in browsers' });
    expect(report.drops).toHaveLength(1);
    expect(report.summary.dropped).toBe(1);
  });

  it('increments transformed count + appends the entry', () => {
    const report = createReport('curl');
    recordTransform(report, {
      path: 'header[0]',
      from: 'Authorization: ***',
      to: 'auth.bearer',
      reason: 'promoted to first-class auth',
    });
    expect(report.transforms).toHaveLength(1);
    expect(report.summary.transformed).toBe(1);
  });
});

describe('hashImportSource', () => {
  it('produces the sha256:<hex> format', async () => {
    const hash = await hashImportSource('curl https://api.openheaders.io');
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is stable across calls with identical input', async () => {
    const a = await hashImportSource('curl -X POST https://api.openheaders.io/x');
    const b = await hashImportSource('curl -X POST https://api.openheaders.io/x');
    expect(a).toBe(b);
  });

  it('differs when a single character differs', async () => {
    const a = await hashImportSource('curl -X POST https://api.openheaders.io/x');
    const b = await hashImportSource('curl -X POST https://api.openheaders.io/y');
    expect(a).not.toBe(b);
  });
});
