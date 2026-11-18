/**
 * The sidecar's own name (`sidecar.ts`), on a real (tmp) filesystem: the
 * sidecar is a real directory before every read and write. A link at
 * `.oh` — a commit can leave one — is taken away by its name: nothing is
 * read from where it points, nothing is written there, and the sidecar
 * is made anew. A file there is taken away the same. What is none of
 * the three is not: a read answers nothing and a write fails saying so.
 * And the sidecar's own ignore file, a regular file holding `*`, on real
 * git.
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git';
import {
  acquireTreeLock,
  ensureSidecarIgnore,
  readMaterializedIndex,
  readQuarantineIndex,
  readTreeUnknownFields,
  releaseTreeLock,
  writeMaterializedIndex,
  writeQuarantineIndex,
  writeTreeUnknownFields,
} from '../../src/workspace-tree/sidecar';

const posixOnly = it.runIf(process.platform !== 'win32');
const mkfifo = async (file: string): Promise<void> => {
  await promisify(execFile)('mkfifo', [file]);
};

const NOT_A_DIRECTORY = '".oh" is not a directory';
const PEER_BASELINE = { 'README.md': 'a'.repeat(64) };

let scratch: string;
let rootDir: string;
let outside: string;

const sidecar = (...names: string[]): string => path.join(rootDir, '.oh', ...names);
const namesIn = async (dir: string): Promise<string[]> => (await fs.readdir(dir)).sort();
const isADirectory = async (file: string): Promise<boolean> => (await fs.lstat(file)).isDirectory();

/** `.oh` a link to a directory outside that holds a peer's baseline, lock and rows. */
async function linkTheSidecarOutside(): Promise<void> {
  await fs.writeFile(path.join(outside, 'materialized-index.json'), JSON.stringify(PEER_BASELINE), 'utf-8');
  await fs.writeFile(path.join(outside, 'quarantined-files.json'), JSON.stringify(PEER_BASELINE), 'utf-8');
  await fs.writeFile(path.join(outside, 'unknown-fields.json'), JSON.stringify({ aaaaaaaa: { extra: 1 } }), 'utf-8');
  await fs.symlink(outside, path.join(rootDir, '.oh'));
}
const OUTSIDE_AS_LEFT = ['materialized-index.json', 'quarantined-files.json', 'unknown-fields.json'];

beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-sidecar-'));
  rootDir = path.join(scratch, 'bound');
  outside = path.join(scratch, 'outside');
  await fs.mkdir(rootDir);
  await fs.mkdir(outside);
});

afterEach(async () => {
  await fs.rm(scratch, { recursive: true, force: true });
});

describe('the sidecar — a link at its name', () => {
  it('nothing is read through it: the baseline, the quarantine record and the unknown rows read as none, and the link is gone', async () => {
    await linkTheSidecarOutside();
    expect(await readMaterializedIndex(rootDir)).toEqual({});
    expect(await fs.lstat(path.join(rootDir, '.oh')).catch(() => null)).toBeNull();

    await linkTheSidecarOutside();
    expect(await readQuarantineIndex(rootDir)).toEqual({});
    await linkTheSidecarOutside();
    expect(await readTreeUnknownFields(rootDir)).toEqual({});
    expect(await namesIn(outside)).toEqual(OUTSIDE_AS_LEFT);
  });

  it('nothing is written through it: each write makes the sidecar anew, a directory, and lands in it', async () => {
    const writes: [string, () => Promise<void>][] = [
      ['materialized-index.json', () => writeMaterializedIndex(rootDir, { 'workspace.yaml': 'b'.repeat(64) })],
      ['quarantined-files.json', () => writeQuarantineIndex(rootDir, { 'rules/a.yaml': 'c'.repeat(64) })],
      ['unknown-fields.json', () => writeTreeUnknownFields(rootDir, {})],
    ];
    for (const [file, write] of writes) {
      await linkTheSidecarOutside();
      await write();
      expect(await isADirectory(sidecar())).toBe(true);
      expect(await namesIn(sidecar())).toEqual([file]);
      await fs.rm(sidecar(), { recursive: true });
    }
    expect(await namesIn(outside)).toEqual(OUTSIDE_AS_LEFT);
    expect(JSON.parse(await fs.readFile(path.join(outside, 'materialized-index.json'), 'utf-8'))).toEqual(
      PEER_BASELINE,
    );
  });

  it('the lock is taken in the sidecar made anew, and a lock where the link pointed holds nobody off', async () => {
    await fs.writeFile(
      path.join(outside, 'lock'),
      JSON.stringify({ pid: process.pid, hostId: 'somebody-else', acquiredAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8',
    );
    await fs.symlink(outside, path.join(rootDir, '.oh'));

    expect(await acquireTreeLock(rootDir, 'desktop-1')).toEqual({ ok: true });
    expect(await namesIn(sidecar())).toEqual(['lock']);
    expect(JSON.parse(await fs.readFile(path.join(outside, 'lock'), 'utf-8'))).toMatchObject({
      hostId: 'somebody-else',
    });
  });
});

describe('the sidecar — a file at its name', () => {
  const fileAtTheName = (): Promise<void> => fs.writeFile(path.join(rootDir, '.oh'), 'a commit’s\n', 'utf-8');

  it('is taken away like a link: a read answers nothing, makes no sidecar, and the file is gone', async () => {
    await fileAtTheName();
    expect(await readMaterializedIndex(rootDir)).toEqual({});
    expect(await namesIn(rootDir)).toEqual([]);

    await fileAtTheName();
    expect(await readTreeUnknownFields(rootDir)).toEqual({});
    await fileAtTheName();
    await expect(releaseTreeLock(rootDir, 'desktop-1')).resolves.toBeUndefined();
    expect(await namesIn(rootDir)).toEqual([]);
  });

  it('each write makes the sidecar anew in its place, a directory, and lands in it', async () => {
    const writes: [string, () => Promise<unknown>][] = [
      ['materialized-index.json', () => writeMaterializedIndex(rootDir, { 'workspace.yaml': 'b'.repeat(64) })],
      ['lock', () => acquireTreeLock(rootDir, 'desktop-1')],
      ['.gitignore', () => ensureSidecarIgnore(rootDir)],
    ];
    for (const [file, write] of writes) {
      await fileAtTheName();
      await write();
      expect(await isADirectory(sidecar())).toBe(true);
      expect(await namesIn(sidecar())).toEqual([file]);
      await fs.rm(sidecar(), { recursive: true });
    }
  });
});

describe('the sidecar — what is neither a directory, a link nor a file at its name', () => {
  // A named pipe: nothing reads or writes it here. Windows keeps no such thing in a folder.
  posixOnly('is not taken away: a read answers nothing, a write fails saying what stands there', async () => {
    await mkfifo(path.join(rootDir, '.oh'));
    expect(await readMaterializedIndex(rootDir)).toEqual({});
    await expect(releaseTreeLock(rootDir, 'desktop-1')).resolves.toBeUndefined();
    await expect(writeMaterializedIndex(rootDir, {})).rejects.toThrow(NOT_A_DIRECTORY);
    await expect(acquireTreeLock(rootDir, 'desktop-1')).rejects.toThrow(NOT_A_DIRECTORY);
    await expect(ensureSidecarIgnore(rootDir)).rejects.toThrow(NOT_A_DIRECTORY);
    expect((await fs.lstat(path.join(rootDir, '.oh'))).isFIFO()).toBe(true);
  });
});

describe('the sidecar — nothing at its name', () => {
  it('a read makes nothing: no sidecar, and no folder where the bound folder is gone', async () => {
    expect(await readMaterializedIndex(rootDir)).toEqual({});
    expect(await namesIn(rootDir)).toEqual([]);

    const gone = path.join(scratch, 'gone');
    expect(await readMaterializedIndex(gone)).toEqual({});
    await releaseTreeLock(gone, 'desktop-1');
    expect(await namesIn(scratch)).toEqual(['bound', 'outside']);
  });
});

describe('the sidecar’s own ignore file', () => {
  /** Isolated from the developer's global and system git config. */
  const git: GitRunner = (args, options) =>
    createGitExec()(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env },
    });
  /** What `git add -A` would stage, as plain git in a terminal lists it. */
  async function untracked(): Promise<string[]> {
    const listed = await git(['status', '--porcelain', '--untracked-files=all'], { cwd: rootDir });
    return listed.stdout
      .split('\n')
      .filter((line) => line.length > 0)
      .sort();
  }

  it('is authored holding `*`, kept as it is from then on, and written again where it holds anything else', async () => {
    await ensureSidecarIgnore(rootDir);
    expect(await fs.readFile(sidecar('.gitignore'), 'utf-8')).toBe('*\n');
    const authored = (await fs.stat(sidecar('.gitignore'))).mtimeMs;

    await ensureSidecarIgnore(rootDir);
    expect((await fs.stat(sidecar('.gitignore'))).mtimeMs).toBe(authored);

    await fs.writeFile(sidecar('.gitignore'), '!lock\n', 'utf-8');
    await ensureSidecarIgnore(rootDir);
    expect(await fs.readFile(sidecar('.gitignore'), 'utf-8')).toBe('*\n');
    expect(await namesIn(sidecar())).toEqual(['.gitignore']);
  });

  it('a link at its name is replaced, never written through', async () => {
    await fs.mkdir(sidecar());
    await fs.writeFile(path.join(outside, 'victim.txt'), 'as its owner left it\n', 'utf-8');
    await fs.symlink(path.join(outside, 'victim.txt'), sidecar('.gitignore'));

    await ensureSidecarIgnore(rootDir);
    expect((await fs.lstat(sidecar('.gitignore'))).isFile()).toBe(true);
    expect(await fs.readFile(sidecar('.gitignore'), 'utf-8')).toBe('*\n');
    expect(await fs.readFile(path.join(outside, 'victim.txt'), 'utf-8')).toBe('as its owner left it\n');
  });

  it('keeps the sidecar out of git’s own listing with no root .gitignore, and with one that takes the entry back', async () => {
    await git(['init', '-q'], { cwd: rootDir });
    await acquireTreeLock(rootDir, 'desktop-1');
    await writeMaterializedIndex(rootDir, {});
    expect(await untracked()).toEqual(['?? .oh/lock', '?? .oh/materialized-index.json']);

    await ensureSidecarIgnore(rootDir);
    expect(await untracked()).toEqual([]);

    await fs.writeFile(path.join(rootDir, '.gitignore'), '.oh/\n!.oh/\n!.oh/*\n!.oh/lock\n', 'utf-8');
    expect(await untracked()).toEqual(['?? .gitignore']);
  });
});
