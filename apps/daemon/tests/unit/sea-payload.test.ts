/**
 * SEA payload unpacking — manifest-driven extraction with checksums,
 * the crash-safe marker protocol, and idempotent skips. Exercised
 * through `extractPayloadKind` with an injected file reader; the
 * `node:sea` wiring above it is the packed binary's concern
 * (verified live by `scripts/pack-sea.mjs`).
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractPayloadKind, type PayloadFileEntry } from '../../src/sea/payload';

const tempDirs: string[] = [];

function makeBase(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-sea-payload-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const FILES: Record<string, string> = {
  'node_modules/better-sqlite3/package.json': '{"name":"better-sqlite3"}',
  'node_modules/better-sqlite3/lib/index.js': 'module.exports = 42;',
  'node_modules/bindings/bindings.js': 'exports.ok = true;',
};

function entryFor(relPath: string, content: string): PayloadFileEntry {
  const bytes = new TextEncoder().encode(content);
  return { path: relPath, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength };
}

function makeReader(files: Record<string, string> = FILES): { reads: string[]; readFile: (p: string) => Uint8Array } {
  const reads: string[] = [];
  return {
    reads,
    readFile: (relPath: string) => {
      reads.push(relPath);
      const content = files[relPath];
      if (content === undefined) throw new Error(`no such payload file: ${relPath}`);
      return new TextEncoder().encode(content);
    },
  };
}

const entries = Object.entries(FILES).map(([relPath, content]) => entryFor(relPath, content));

describe('extractPayloadKind', () => {
  it('materializes the tree, verifies checksums, and commits a marker', () => {
    const targetDir = path.join(makeBase(), 'native');
    const { readFile } = makeReader();
    const dir = extractPayloadKind({ entries, readFile, targetDir });

    expect(dir).toBe(targetDir);
    for (const [relPath, content] of Object.entries(FILES)) {
      expect(fs.readFileSync(path.join(targetDir, ...relPath.split('/')), 'utf8')).toBe(content);
    }
    expect(fs.existsSync(`${targetDir}.ok`)).toBe(true);
    expect(fs.existsSync(`${targetDir}.tmp-${process.pid}`)).toBe(false);
  });

  it('skips extraction entirely when the marker matches', () => {
    const targetDir = path.join(makeBase(), 'native');
    extractPayloadKind({ entries, readFile: makeReader().readFile, targetDir });

    const second = makeReader();
    extractPayloadKind({ entries, readFile: second.readFile, targetDir });
    expect(second.reads).toEqual([]);
  });

  it('re-extracts after a crash that left no marker', () => {
    const targetDir = path.join(makeBase(), 'native');
    extractPayloadKind({ entries, readFile: makeReader().readFile, targetDir });
    fs.rmSync(`${targetDir}.ok`);
    fs.rmSync(path.join(targetDir, 'node_modules/bindings/bindings.js'));

    const again = makeReader();
    extractPayloadKind({ entries, readFile: again.readFile, targetDir });
    expect(again.reads).toHaveLength(entries.length);
    expect(fs.existsSync(path.join(targetDir, 'node_modules/bindings/bindings.js'))).toBe(true);
  });

  it('re-extracts when the manifest changed since the marker', () => {
    const targetDir = path.join(makeBase(), 'native');
    extractPayloadKind({ entries, readFile: makeReader().readFile, targetDir });

    const changedFiles = { ...FILES, 'node_modules/better-sqlite3/lib/index.js': 'module.exports = 43;' };
    const changedEntries = Object.entries(changedFiles).map(([relPath, content]) => entryFor(relPath, content));
    const again = makeReader(changedFiles);
    extractPayloadKind({ entries: changedEntries, readFile: again.readFile, targetDir });
    expect(fs.readFileSync(path.join(targetDir, 'node_modules/better-sqlite3/lib/index.js'), 'utf8')).toBe(
      'module.exports = 43;',
    );
  });

  it('refuses bytes that do not match the manifest checksum', () => {
    const targetDir = path.join(makeBase(), 'native');
    const tampered = { ...FILES, 'node_modules/bindings/bindings.js': 'exports.ok = false;' };
    expect(() => extractPayloadKind({ entries, readFile: makeReader(tampered).readFile, targetDir })).toThrow(
      /checksum/,
    );
    expect(fs.existsSync(targetDir)).toBe(false);
    expect(fs.existsSync(`${targetDir}.ok`)).toBe(false);
  });

  it('refuses entries that escape the target tree', () => {
    const targetDir = path.join(makeBase(), 'native');
    const evil = [entryFor('../outside.js', 'nope')];
    expect(() =>
      extractPayloadKind({ entries: evil, readFile: () => new TextEncoder().encode('nope'), targetDir }),
    ).toThrow(/escapes/);
  });
});
