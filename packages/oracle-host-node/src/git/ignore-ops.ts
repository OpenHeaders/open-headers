/**
 * Ignore-file plumbing — the Commit window's ignore verbs and their
 * provenance read. Add appends one file's root-anchored entry
 * (`/path/to/file`) to the shared `.gitignore` at the repo root or the
 * local-only `.git/info/exclude` — exactly the picked file, never a
 * same-named file elsewhere; an entry the target already carries
 * answers `added: false`. Remove deletes exactly that anchored entry
 * and nothing else — a glob that covers other files is never touched
 * (the surface gates Stop Ignoring on `removable`). Provenance batches
 * `git check-ignore -v` to attribute each ignored row to the source
 * that matched it (root `.gitignore`, `exclude`, a nested
 * `.gitignore`, or the global excludesfile). The file writes are pure
 * filesystem against the plane's explicit repo addressing
 * (`--git-dir <root>/.git`, §7); `check-ignore` is a read and stays
 * off the audit stream.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { GitRunner } from './git-exec';

/** Which ignore file receives the entry — the shared one or the local-only one. */
export type IgnoreTarget = 'gitignore' | 'exclude';

export type AddIgnoreEntryResult = { ok: true; added: boolean; entry: string } | { ok: false; detail: string };

/** Absolute path of the target ignore file under the binding's root. */
function ignoreFilePath(rootDir: string, target: IgnoreTarget): string {
  return target === 'gitignore'
    ? path.join(rootDir, '.gitignore')
    : path.join(rootDir, '.git', 'info', 'exclude');
}

/**
 * Append `filePath`'s anchored entry to the target ignore file.
 * `filePath` is a repo-relative tree path (the porcelain row's path,
 * already validated by the caller); the written entry is `/<filePath>`.
 */
export async function addIgnoreEntry(
  rootDir: string,
  filePath: string,
  target: IgnoreTarget,
): Promise<AddIgnoreEntryResult> {
  const entry = `/${filePath}`;
  const targetFile = ignoreFilePath(rootDir, target);
  try {
    let existing = '';
    try {
      existing = await fs.readFile(targetFile, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const lines = existing.split('\n').map((line) => line.trim());
    if (lines.includes(entry) || lines.includes(filePath)) return { ok: true, added: false, entry };
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await fs.appendFile(targetFile, `${separator}${entry}\n`, 'utf-8');
    return { ok: true, added: true, entry };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export type RemoveIgnoreEntryResult = { ok: true; removed: boolean } | { ok: false; detail: string };

/**
 * Delete `filePath`'s exact entry (`/<filePath>` or the unanchored
 * literal) from the target ignore file. Only whole exact-entry lines
 * are dropped — comments, globs, and every other line stay verbatim.
 */
export async function removeIgnoreEntry(
  rootDir: string,
  filePath: string,
  target: IgnoreTarget,
): Promise<RemoveIgnoreEntryResult> {
  const targetFile = ignoreFilePath(rootDir, target);
  try {
    let existing: string;
    try {
      existing = await fs.readFile(targetFile, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, removed: false };
      throw err;
    }
    const lines = existing.split('\n');
    const kept = lines.filter((line) => {
      const trimmed = line.trim();
      return trimmed !== `/${filePath}` && trimmed !== filePath;
    });
    if (kept.length === lines.length) return { ok: true, removed: false };
    let next = kept.join('\n');
    if (next.length > 0 && !next.endsWith('\n')) next = `${next}\n`;
    await fs.writeFile(targetFile, next, 'utf-8');
    return { ok: true, removed: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

/** Which ignore source matched one ignored path — the Stop Ignoring gate rides `removable`. */
export interface IgnoreProvenance {
  kind: 'gitignore' | 'exclude' | 'nested' | 'global';
  /** Ignore-file path as git reports it (repo-relative; absolute for the global excludesfile). */
  source: string;
  /** The matching pattern line, verbatim. */
  pattern: string;
  /** True when the match is an exact single-file entry in the root `.gitignore` or `exclude`. */
  removable: boolean;
}

function classifyIgnoreSource(source: string): IgnoreProvenance['kind'] {
  if (source === '.gitignore') return 'gitignore';
  // git prints the exclude source via the (absolute) --git-dir we pass.
  if (source === '.git/info/exclude' || source.endsWith('/.git/info/exclude')) return 'exclude';
  if (!path.isAbsolute(source) && source.endsWith('/.gitignore')) return 'nested';
  return 'global';
}

/** Exact single-file entry: the pattern names precisely this path — no glob, no dir suffix. */
function isExactEntry(pattern: string, filePath: string): boolean {
  if (/[*?[\]\\!]/.test(pattern) || pattern.endsWith('/')) return false;
  const stripped = pattern.startsWith('/') ? pattern.slice(1) : pattern;
  return stripped === filePath;
}

/** `check-ignore -v` arg-vector batches — well under every platform's arg-length cap. */
const CHECK_IGNORE_BATCH = 200;

/** One `check-ignore -v` line: `<source>:<linenum>:<pattern>` before the TAB (`-z` needs `--stdin`, which the runner has no seam for). */
const CHECK_IGNORE_LINE = /^(.*?):(\d+):(.*)$/;

/**
 * Attribute each ignored path to the ignore source that matched it.
 * Paths git does not attribute (or a failing spawn) are simply absent
 * from the answer — provenance is a display affordance, never a gate
 * on showing the row.
 */
export async function checkIgnoreProvenance(
  run: GitRunner,
  rootDir: string,
  paths: readonly string[],
): Promise<Map<string, IgnoreProvenance>> {
  const out = new Map<string, IgnoreProvenance>();
  for (let start = 0; start < paths.length; start += CHECK_IGNORE_BATCH) {
    const batch = paths.slice(start, start + CHECK_IGNORE_BATCH);
    const result = await run(
      ['--git-dir', path.join(rootDir, '.git'), '--work-tree', rootDir, 'check-ignore', '-v', '--', ...batch],
      { cwd: rootDir },
    );
    // Exit 1 = nothing in this batch is ignored; anything above = error.
    if (result.code !== 0 && result.code !== 1) continue;
    for (const line of result.stdout.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab === -1) continue;
      const matchedPath = line.slice(tab + 1);
      const head = CHECK_IGNORE_LINE.exec(line.slice(0, tab));
      if (head === null || matchedPath.length === 0) continue;
      const [, source, , pattern] = head;
      const kind = classifyIgnoreSource(source);
      out.set(matchedPath, {
        kind,
        source,
        pattern,
        removable: (kind === 'gitignore' || kind === 'exclude') && isExactEntry(pattern, matchedPath),
      });
    }
  }
  return out;
}
