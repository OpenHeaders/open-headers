/**
 * The better-sqlite3 stash key. A package carries the stash of the
 * machine that built it, so the key names the platform and the arch
 * beside the ABI: a desktop cross-built for another arch must miss its
 * runner's stash and load the default binary the packager rebuilt.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sqliteStashFileName } from '../../src/sync/sqlite-database';

describe('sqliteStashFileName', () => {
  it('names the platform, the arch and the ABI', () => {
    expect(sqliteStashFileName('darwin', 'arm64', '149')).toBe('better_sqlite3-darwin-arm64-abi149.node');
  });

  it('gives two arches of one platform and ABI different names', () => {
    expect(sqliteStashFileName('darwin', 'x64', '149')).not.toBe(sqliteStashFileName('darwin', 'arm64', '149'));
    expect(sqliteStashFileName('win32', 'arm64', '149')).not.toBe(sqliteStashFileName('win32', 'x64', '149'));
    expect(sqliteStashFileName('linux', 'arm64', '149')).not.toBe(sqliteStashFileName('linux', 'x64', '149'));
  });

  it('is the shape the desktop postinstall writes', () => {
    const postinstall = readFileSync(
      path.resolve(__dirname, '../../../../apps/desktop/scripts/rebuild-native.mjs'),
      'utf8',
    );
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the script's own template literal, read as text
    expect(postinstall).toContain('`better_sqlite3-${process.platform}-${process.arch}-abi${abi}.node`');
  });
});
