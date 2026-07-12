/**
 * Data-scan runner — the fs half of migration ladder rung 2
 * (MIGRATION_PLAN.md §3.2). Core owns the target allowlist, the
 * file-name policy, and the interpretation; this module lists each
 * allowlisted directory (names only, no recursion), reads exactly the
 * files core's pattern matched, and hands the contents back.
 *
 * Read-only and consent-gated by the caller (plan §5.1): never invoked
 * on a timer or in the background — a missing/unreadable directory
 * simply contributes nothing, and per-file read errors surface as
 * skips with reasons.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import {
  type DataScanSkip,
  type DataScanTarget,
  type InstallProbeRoots,
  interpretDataScanFiles,
  listDataScanTargets,
  matchesDataScanFile,
  type ScannedFile,
  type ToolDataFinding,
} from '@openheaders/core/import';

export interface DataScanResult {
  findings: ToolDataFinding[];
  skipped: DataScanSkip[];
}

function joinDir(dir: string, name: string): string {
  const separator = dir.includes('\\') ? '\\' : '/';
  return `${dir}${separator}${name}`;
}

async function readTarget(target: DataScanTarget): Promise<DataScanResult> {
  let names: string[];
  try {
    names = await fs.readdir(target.dir);
  } catch {
    return { findings: [], skipped: [] };
  }

  const matched = names.filter((entry) => matchesDataScanFile(target.store, entry)).sort();
  const files: ScannedFile[] = [];
  const skipped: DataScanSkip[] = [];
  const reads = await Promise.all(
    matched.map(async (name): Promise<ScannedFile | DataScanSkip> => {
      const path = joinDir(target.dir, name);
      try {
        const [stat, text] = await Promise.all([fs.stat(path), fs.readFile(path, 'utf8')]);
        return { path, mtimeMs: stat.mtimeMs, text };
      } catch (err) {
        return { path, reason: `Unreadable store file — ${err instanceof Error ? err.message : String(err)}` };
      }
    }),
  );
  for (const read of reads) {
    if ('reason' in read) skipped.push(read);
    else files.push(read);
  }

  const interpreted = interpretDataScanFiles(target, files);
  return { findings: interpreted.findings, skipped: [...skipped, ...interpreted.skipped] };
}

export interface ScanToolDataOptions {
  /** Defaults to `process.platform`. */
  platform?: string;
  /** Defaults to `os.homedir()` + the win32 app-data env vars. */
  roots?: InstallProbeRoots;
}

/**
 * Migration rung 2 end-to-end: allowlisted store directories → findings
 * inventory ("N collections · M environments · K header presets").
 */
export async function scanToolData(options: ScanToolDataOptions = {}): Promise<DataScanResult> {
  const roots: InstallProbeRoots = options.roots ?? {
    home: os.homedir(),
    appData: process.env.APPDATA,
    localAppData: process.env.LOCALAPPDATA,
  };
  const targets = listDataScanTargets(options.platform ?? process.platform, roots);
  const results = await Promise.all(targets.map(readTarget));
  return {
    findings: results.flatMap((result) => result.findings),
    skipped: results.flatMap((result) => result.skipped),
  };
}
