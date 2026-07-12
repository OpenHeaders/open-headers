/**
 * Backup-store interpretation: newest file per backup schema version
 * becomes the finding for that version; older siblings and unreadable
 * candidates are skips with reasons, never silent.
 */

import { parsePostmanBackup } from '../postman-backup';
import { isRecord } from './json';
import type { DataScanSkip, PostmanBackupFinding, ScannedFile } from './types';

function groupBySchemaVersion(files: readonly ScannedFile[], skipped: DataScanSkip[]): Map<string, ScannedFile[]> {
  const byVersion = new Map<string, ScannedFile[]>();
  for (const file of files) {
    let version: string;
    try {
      const parsed: unknown = JSON.parse(file.text);
      const raw = isRecord(parsed) ? parsed.version : null;
      version = typeof raw === 'number' || typeof raw === 'string' ? String(raw) : 'missing';
    } catch {
      skipped.push({ path: file.path, reason: 'Backup file is not valid JSON — skipped.' });
      continue;
    }
    const group = byVersion.get(version) ?? [];
    group.push(file);
    byVersion.set(version, group);
  }
  return byVersion;
}

export function interpretPostmanBackups(files: readonly ScannedFile[]): {
  findings: PostmanBackupFinding[];
  skipped: DataScanSkip[];
} {
  const findings: PostmanBackupFinding[] = [];
  const skipped: DataScanSkip[] = [];

  for (const [version, group] of groupBySchemaVersion(files, skipped)) {
    const sorted = [...group].sort((a, b) => b.mtimeMs - a.mtimeMs);
    const [newest, ...older] = sorted;
    for (const superseded of older) {
      skipped.push({
        path: superseded.path,
        reason: `Superseded by a newer schema-v${version} backup (${newest.path}).`,
      });
    }
    try {
      const parsed = parsePostmanBackup(newest.text);
      findings.push({
        tool: 'postman',
        store: 'postman-backup',
        path: newest.path,
        mtimeMs: newest.mtimeMs,
        counts: parsed.counts,
      });
    } catch (err) {
      skipped.push({ path: newest.path, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { findings, skipped };
}
