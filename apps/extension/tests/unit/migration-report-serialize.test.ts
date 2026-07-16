/**
 * serializeReport — the import report's copy/download payload.
 *
 * Pins the anonymization contract for public sharing: workspace names
 * become stable "Workspace N" aliases (including occurrences inside
 * drop/transform paths and reasons), transform from/to values redact to
 * their length, and the debugging signal (paths, reasons, counts,
 * tracking links) survives. Without the flag the payload is verbatim.
 */

import type { ImportReport, PostmanImportSummary } from '@openheaders/core/import';
import {
  serializeReport,
  type WorkspaceReportEntry,
} from '@openheaders/ui/workbench/components/import/MigrationReportModal';
import { describe, expect, it } from 'vitest';

const REPORT: ImportReport = {
  schemaVersion: 5,
  source: 'postman-pull',
  sourceHash: 'sha256:abc',
  importedAt: '2026-07-16T10:00:00.000Z',
  summary: { imported: 4, dropped: 1, transformed: 1 },
  drops: [
    {
      path: 'collections["Billing API"].item[2]',
      reason: 'Billing API uses a binary file upload',
      tracking: '#issue-123',
    },
  ],
  transforms: [
    {
      path: 'collections["Billing API"].item[0].request.url',
      from: 'https://internal.openheaders.io/billing',
      to: '{{baseUrl}}/billing',
      reason: 'Host extracted into a variable',
    },
  ],
};

const SUMMARY: PostmanImportSummary = {
  workspaces: [
    {
      workspaceId: 'ws-1',
      workspaceName: 'Billing API',
      collections: 3,
      environments: 1,
      requests: 12,
      examples: 0,
      globals: 0,
      drops: 1,
    },
  ],
  collections: 3,
  environments: 1,
  requests: 12,
  examples: 0,
  globals: 0,
  drops: 1,
};

const ENTRIES: WorkspaceReportEntry[] = [{ workspace: SUMMARY.workspaces[0], report: REPORT }];

describe('serializeReport', () => {
  it('emits the verbatim payload without anonymization', () => {
    const payload = JSON.parse(serializeReport(SUMMARY, ENTRIES, false));
    expect(payload.anonymized).toBe(false);
    expect(payload.summary.workspaces[0].workspaceName).toBe('Billing API');
    expect(payload.workspaces[0].workspaceName).toBe('Billing API');
    expect(payload.workspaces[0].report.transforms[0].from).toBe('https://internal.openheaders.io/billing');
  });

  it('aliases workspace names and redacts values when anonymizing', () => {
    const payload = JSON.parse(serializeReport(SUMMARY, ENTRIES, true));
    expect(payload.anonymized).toBe(true);
    expect(payload.summary.workspaces[0].workspaceName).toBe('Workspace 1');
    expect(payload.workspaces[0].workspaceName).toBe('Workspace 1');

    const report = payload.workspaces[0].report;
    // Name occurrences inside paths/reasons are scrubbed with the alias.
    expect(report.drops[0].path).toBe('collections["Workspace 1"].item[2]');
    expect(report.drops[0].reason).toBe('Workspace 1 uses a binary file upload');
    // The debugging signal survives.
    expect(report.drops[0].tracking).toBe('#issue-123');
    expect(report.transforms[0].reason).toBe('Host extracted into a variable');
    // Rewritten values redact to their length.
    expect(report.transforms[0].from).toBe(`[redacted ${REPORT.transforms[0].from.length} chars]`);
    expect(report.transforms[0].to).toBe(`[redacted ${REPORT.transforms[0].to.length} chars]`);
    // No raw name survives anywhere in the payload.
    expect(serializeReport(SUMMARY, ENTRIES, true)).not.toContain('Billing API');
  });
});
