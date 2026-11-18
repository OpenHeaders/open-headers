/**
 * A file that is a regular file or nothing (`regular-file.ts`), on a real
 * (tmp) filesystem: what stands at a file's own name is told without
 * following a link, and a file is put there in a link's place — never
 * through it — or refused where what stands is neither. A link is a
 * symbolic link here; on Windows a junction answers the same question
 * (`lstat`) and goes by the same call (`unlink`), and is not made by
 * these pins — its refusal of a rename onto a link to a directory is
 * stood in for by the system's code at the rename.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { putRegularFile, readRegularFile } from '../../src/git/regular-file';
import { TreeBoundary } from '../../src/git/tree-boundary';

const FILE = '.gitignore';

let scratch: string;
let rootDir: string;
let outside: string;

const inTree = (relative: string): string => path.join(rootDir, ...relative.split('/'));
const namesIn = async (dir: string): Promise<string[]> => (await fs.readdir(dir)).sort();
const put = (relative: string, content: string) => putRegularFile(new TreeBoundary(rootDir), relative, content);

beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-regular-file-'));
  rootDir = path.join(scratch, 'bound');
  outside = path.join(scratch, 'outside');
  await fs.mkdir(rootDir);
  await fs.mkdir(outside);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(scratch, { recursive: true, force: true });
});

describe('readRegularFile', () => {
  it('answers a file’s text, and absent where nothing stands', async () => {
    expect(await readRegularFile(inTree(FILE))).toEqual({ kind: 'absent' });
    await fs.writeFile(inTree(FILE), 'mine\n', 'utf-8');
    expect(await readRegularFile(inTree(FILE))).toEqual({ kind: 'text', text: 'mine\n' });
  });

  it('answers a link as a link wherever it points — a file, a directory, nothing — and reads none of it', async () => {
    await fs.writeFile(path.join(outside, 'entries'), '.oh/\n*.secret.yaml\n', 'utf-8');
    const readFile = vi.spyOn(fs, 'readFile');
    for (const target of [path.join(outside, 'entries'), outside, path.join(outside, 'nothing')]) {
      await fs.symlink(target, inTree(FILE));
      expect(await readRegularFile(inTree(FILE))).toEqual({ kind: 'link' });
      await fs.unlink(inTree(FILE));
    }
    expect(readFile).not.toHaveBeenCalled();
  });

  it('answers a directory at the name as no file', async () => {
    await fs.mkdir(inTree(FILE));
    expect(await readRegularFile(inTree(FILE))).toEqual({ kind: 'not-a-file' });
  });

  it('answers a file that stands and will not read as unread, with the system’s code — never as absent', async () => {
    await fs.writeFile(inTree(FILE), 'mine\n', 'utf-8');
    vi.spyOn(fs, 'readFile').mockRejectedValue(Object.assign(new Error('EBUSY'), { code: 'EBUSY' }));
    expect(await readRegularFile(inTree(FILE))).toEqual({ kind: 'unread', code: 'EBUSY' });
  });
});

describe('putRegularFile', () => {
  it('writes a file where nothing stands and over a file that does, leaving nothing beside it', async () => {
    expect(await put(FILE, 'first\n')).toEqual({ ok: true });
    expect(await put(FILE, 'second\n')).toEqual({ ok: true });
    expect(await fs.readFile(inTree(FILE), 'utf-8')).toBe('second\n');
    expect(await namesIn(rootDir)).toEqual([FILE]);
  });

  it('puts a file in the place of a link to a file: what the link points to stands as it was', async () => {
    const victim = path.join(outside, 'victim.txt');
    await fs.writeFile(victim, 'as its owner left it\n', 'utf-8');
    await fs.symlink(victim, inTree(FILE));

    expect(await put(FILE, 'authored\n')).toEqual({ ok: true });
    expect((await fs.lstat(inTree(FILE))).isFile()).toBe(true);
    expect(await fs.readFile(inTree(FILE), 'utf-8')).toBe('authored\n');
    expect(await fs.readFile(victim, 'utf-8')).toBe('as its owner left it\n');
  });

  it('puts a file in the place of a link to nothing: nothing comes to stand where it pointed', async () => {
    await fs.symlink(path.join(outside, 'nothing'), inTree(FILE));
    expect(await put(FILE, 'authored\n')).toEqual({ ok: true });
    expect((await fs.lstat(inTree(FILE))).isFile()).toBe(true);
    expect(await namesIn(outside)).toEqual([]);
  });

  it('puts a file in the place of a link to a directory: the directory and what it holds stand', async () => {
    await fs.writeFile(path.join(outside, 'kept.txt'), 'somebody’s\n', 'utf-8');
    await fs.symlink(outside, inTree(FILE));
    expect(await put(FILE, 'authored\n')).toEqual({ ok: true });
    expect((await fs.lstat(inTree(FILE))).isFile()).toBe(true);
    expect(await namesIn(outside)).toEqual(['kept.txt']);
  });

  it('takes the link away before the rename — where a rename onto a link is refused (Windows, a link to a directory) the file still lands', async () => {
    await fs.symlink(outside, inTree(FILE));
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      const stands = await fs.lstat(to).catch(() => null);
      if (stands?.isSymbolicLink()) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
      return rename(from, to);
    });

    expect(await put(FILE, 'authored\n')).toEqual({ ok: true });
    expect(await fs.readFile(inTree(FILE), 'utf-8')).toBe('authored\n');
  });

  it('refuses a directory at the name: it stands with what it holds, and nothing is written', async () => {
    await fs.mkdir(inTree(FILE));
    await fs.writeFile(path.join(inTree(FILE), 'kept.txt'), 'somebody’s\n', 'utf-8');
    expect(await put(FILE, 'authored\n')).toEqual({ ok: false, refusal: { kind: 'place' } });
    expect(await namesIn(inTree(FILE))).toEqual(['kept.txt']);
    expect(await namesIn(rootDir)).toEqual([FILE]);
  });

  it('refuses what the boundary refuses: a path through a link is not written', async () => {
    await fs.symlink(outside, inTree('linked'));
    expect(await put(`linked/${FILE}`, 'authored\n')).toEqual({
      ok: false,
      refusal: { kind: 'way', dir: 'linked', stands: 'link' },
    });
    expect(await namesIn(outside)).toEqual([]);
  });
});
