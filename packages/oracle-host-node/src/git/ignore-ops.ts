/**
 * Ignore-file plumbing — the Commit window's "Add to .gitignore" verbs:
 * append one file's anchored entry to the shared `.gitignore` at the
 * repo root, or to the local-only `.git/info/exclude`. Entries are
 * root-anchored (`/path/to/file`) so exactly the picked file is
 * ignored, never a same-named file elsewhere in the tree; an entry the
 * target already carries answers `added: false` instead of a duplicate
 * line. Pure filesystem against the plane's explicit repo addressing
 * (`--git-dir <root>/.git`, §7) — no git invocation, so nothing rides
 * the audit stream.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

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
