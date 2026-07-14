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
  parseNedbLines,
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
  const targets = listDataScanTargets(options.platform ?? process.platform, defaultRoots(options));
  const results = await Promise.all(targets.map(readTarget));
  return {
    findings: results.flatMap((result) => result.findings),
    skipped: results.flatMap((result) => result.skipped),
  };
}

function defaultRoots(options: ScanToolDataOptions): InstallProbeRoots {
  return (
    options.roots ?? {
      home: os.homedir(),
      appData: process.env.APPDATA,
      localAppData: process.env.LOCALAPPDATA,
    }
  );
}

export interface ReadPostmanBackupResult {
  /** The backup file's text, or null when the read was refused/failed. */
  text: string | null;
  /** Present when `text` is null. */
  reason?: string;
}

/**
 * Read one Postman backup file for import routing. The path is
 * re-validated against the scan allowlist — it must sit directly in a
 * `postman-backup` target directory and its name must match the store
 * pattern — so a surface-supplied path can never open anything the
 * scan itself would not have read (plan §7).
 */
export async function readPostmanBackupFile(
  path: string,
  options: ScanToolDataOptions = {},
): Promise<ReadPostmanBackupResult> {
  const separator = path.includes('\\') ? '\\' : '/';
  const splitAt = path.lastIndexOf(separator);
  const dir = splitAt > 0 ? path.slice(0, splitAt) : '';
  const name = path.slice(splitAt + 1);
  const targets = listDataScanTargets(options.platform ?? process.platform, defaultRoots(options));
  const allowed = targets.some(
    (target) => target.store === 'postman-backup' && target.dir === dir && matchesDataScanFile(target.store, name),
  );
  if (!allowed) {
    return { text: null, reason: 'Not an allowlisted backup file.' };
  }
  try {
    return { text: await fs.readFile(path, 'utf8') };
  } catch (err) {
    return { text: null, reason: `Unreadable store file — ${err instanceof Error ? err.message : String(err)}` };
  }
}

export interface ReadInsomniaDataResult {
  /** The synthesized v4 export envelope's JSON text, or null when the read was refused/failed. */
  text: string | null;
  /** Present when `text` is null. */
  reason?: string;
}

/**
 * Read a scanned Insomnia data directory for import routing. The
 * directory is re-validated against the scan allowlist and the store
 * files re-enumerated host-side — a surface-supplied dir (or file list)
 * can never reach anything the scan itself would not have read (plan
 * §7). The NeDB docs from every matched store fold into one synthesized
 * v4 export envelope, so the answer routes through the same detection +
 * parser path an exported file takes. Unparseable lines drop exactly as
 * the scan drops them (interrupted journal appends).
 */
export async function readInsomniaData(
  dir: string,
  options: ScanToolDataOptions = {},
): Promise<ReadInsomniaDataResult> {
  const targets = listDataScanTargets(options.platform ?? process.platform, defaultRoots(options));
  const allowed = targets.some((target) => target.store === 'insomnia-nedb' && target.dir === dir);
  if (!allowed) {
    return { text: null, reason: 'Not an allowlisted data directory.' };
  }
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    return { text: null, reason: `Unreadable data directory — ${err instanceof Error ? err.message : String(err)}` };
  }
  const matched = names.filter((name) => matchesDataScanFile('insomnia-nedb', name)).sort();
  if (matched.length === 0) {
    return { text: null, reason: 'No data store files found — the tool may have moved or cleared its data.' };
  }
  const docs: unknown[] = [];
  for (const name of matched) {
    let text: string;
    try {
      text = await fs.readFile(joinDir(dir, name), 'utf8');
    } catch {
      continue;
    }
    docs.push(...parseNedbLines(text).docs);
  }
  if (docs.length === 0) {
    return { text: null, reason: 'No readable records found in the data stores.' };
  }
  return { text: JSON.stringify({ _type: 'export', __export_format: 4, resources: docs }) };
}
