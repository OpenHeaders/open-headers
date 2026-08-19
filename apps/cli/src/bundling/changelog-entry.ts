/**
 * Build-time resolution of the running version's canonical changelog
 * entry (`changelog/cli/<year>/<version>.md`, the changelog plan §4.3)
 * for the `__CLI_CHANGELOG__` define both bundle configs stamp — never
 * fetched at runtime (offline law). Betas amend the base version's
 * living entry file, so the `-beta.N` suffix is stripped before
 * resolving. Relative asset refs rewrite to absolute feed URLs: a
 * terminal renders no images, so they degrade to links. A version
 * without an entry resolves to the empty string (entry-existence law:
 * bumps from shared-internals rebuilds ship no notes).
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveChangelogEntry(pkgVersion: string): string {
  const version = pkgVersion.replace(/-beta\.\d+$/, '');
  const year = version.split('.')[0] ?? '';
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const entryPath = path.join(repoRoot, 'changelog', 'cli', year, `${version}.md`);
  if (!existsSync(entryPath)) return '';
  return readFileSync(entryPath, 'utf8')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replaceAll('](./assets/', '](https://updates.openheaders.com/changelog/assets/cli/')
    .trim();
}
