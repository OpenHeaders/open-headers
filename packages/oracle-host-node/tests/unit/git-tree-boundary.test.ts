/**
 * The bound folder's boundary on a real (tmp) filesystem: what it
 * refuses by a path's text, what it refuses for what stands on the way,
 * and that nothing is done at a path it refused — a link is neither
 * followed, replaced nor removed. A link is a symbolic link here; on
 * Windows a junction answers the same question (`lstat`) and is not
 * made by these pins.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TreeBoundary, type TreePlaced, treeRefusalIssue, treeRefusalReason } from '../../src/git/tree-boundary';

let scratch: string;
let rootDir: string;
let outside: string;

const inTree = (relative: string): string => path.join(rootDir, ...relative.split('/'));
const namesIn = async (dir: string): Promise<string[]> => (await fs.readdir(dir)).sort();

/** The place of a path the boundary passes; fails the pin where it refuses. */
async function placeOf(boundary: TreeBoundary, relative: string) {
  const placed = await boundary.locate(relative);
  if (!placed.ok) throw new Error(`refused: ${JSON.stringify(placed.refusal)}`);
  return placed.place;
}

/** Stage and land `content` at a path the boundary passes. */
async function write(boundary: TreeBoundary, relative: string, content: string): Promise<void> {
  const staging = await boundary.stage(await placeOf(boundary, relative), content);
  if (!staging.ok) throw new Error(`refused: ${JSON.stringify(staging.refusal)}`);
  await staging.staged.land();
}

beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-boundary-'));
  rootDir = path.join(scratch, 'bound');
  outside = path.join(scratch, 'outside');
  await fs.mkdir(rootDir);
  await fs.mkdir(outside);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(scratch, { recursive: true, force: true });
});

describe('TreeBoundary — a path’s text', () => {
  it('passes a path of the tree and says where its file is', async () => {
    expect(await new TreeBoundary(rootDir).locate('specs/pets-ssssssss/spec.yaml')).toEqual({
      ok: true,
      place: { relative: 'specs/pets-ssssssss/spec.yaml', file: inTree('specs/pets-ssssssss/spec.yaml') },
    });
  });

  it('refuses a path no tree can hold, naming what of it cannot be — and asks the disk nothing', async () => {
    const lstat = vi.spyOn(fs, 'lstat');
    const boundary = new TreeBoundary(rootDir);
    expect(await boundary.locate('../outside/spec.yaml')).toEqual({
      ok: false,
      refusal: { kind: 'path', part: '".."' },
    });
    expect(await boundary.locate('.git/hooks/pre-commit')).toEqual({
      ok: false,
      refusal: { kind: 'path', part: '".git"' },
    });
    expect(lstat).not.toHaveBeenCalled();
  });
});

describe('TreeBoundary — the directories on the way', () => {
  const linkAt = (relative: string): Promise<void> => fs.symlink(outside, inTree(relative));
  const refusedAt = (dir: string, stands: 'link' | 'file'): TreePlaced => ({
    ok: false,
    refusal: { kind: 'way', dir, stands },
  });

  it('refuses a path through a link, at the folder’s own directory or deeper, naming the link’s directory', async () => {
    await linkAt('specs');
    await fs.mkdir(inTree('rules/api-cccccccc'), { recursive: true });
    await linkAt('rules/api-cccccccc/linked');
    const boundary = new TreeBoundary(rootDir);
    expect(await boundary.locate('specs/pets-ssssssss/spec.yaml')).toEqual(refusedAt('specs', 'link'));
    expect(await boundary.locate('rules/api-cccccccc/linked/deeper/rule.yaml')).toEqual(
      refusedAt('rules/api-cccccccc/linked', 'link'),
    );
    expect(await boundary.locate('rules/api-cccccccc/_collection.yaml')).toMatchObject({ ok: true });
  });

  it('refuses a path through a file that stands where a directory would', async () => {
    await fs.writeFile(inTree('specs'), 'somebody’s file\n', 'utf-8');
    expect(await new TreeBoundary(rootDir).locate('specs/pets-ssssssss/spec.yaml')).toEqual(refusedAt('specs', 'file'));
    expect(await fs.readFile(inTree('specs'), 'utf-8')).toBe('somebody’s file\n');
  });

  it('asks the disk once a pass for a directory, however many files lie beneath it', async () => {
    await fs.mkdir(inTree('rules/api-cccccccc'), { recursive: true });
    const lstat = vi.spyOn(fs, 'lstat');
    const boundary = new TreeBoundary(rootDir);
    for (const name of ['_collection.yaml', 'pre-request.js', 'post-response.js']) {
      expect(await boundary.locate(`rules/api-cccccccc/${name}`)).toMatchObject({ ok: true });
    }
    expect(lstat.mock.calls.map(([asked]) => asked)).toEqual([inTree('rules'), inTree('rules/api-cccccccc')]);
  });

  it('a directory that is not there is no refusal: it is made, one level at a time, when the file is written', async () => {
    const boundary = new TreeBoundary(rootDir);
    await write(boundary, 'specs/pets-ssssssss/spec.yaml', 'schemaVersion: 5\n');
    expect(await fs.readFile(inTree('specs/pets-ssssssss/spec.yaml'), 'utf-8')).toBe('schemaVersion: 5\n');
    expect(await namesIn(inTree('specs/pets-ssssssss'))).toEqual(['spec.yaml']);
  });

  it('a link that came to stand since the pass looked is met where the directory would be made: nothing is written through it', async () => {
    const boundary = new TreeBoundary(rootDir);
    const place = await placeOf(boundary, 'specs/pets-ssssssss/spec.yaml');
    await linkAt('specs');
    expect(await boundary.stage(place, 'schemaVersion: 5\n')).toEqual(refusedAt('specs', 'link'));
    expect(await namesIn(outside)).toEqual([]);
  });
});

describe('TreeBoundary — a file written and removed', () => {
  it('a staged file is beside its place until it lands, and gone where it is discarded', async () => {
    const boundary = new TreeBoundary(rootDir);
    await write(boundary, 'workspace.yaml', 'name: before\n');
    const staging = await boundary.stage(await placeOf(boundary, 'workspace.yaml'), 'name: after\n');
    if (!staging.ok) throw new Error('refused');
    expect(await fs.readFile(inTree('workspace.yaml'), 'utf-8')).toBe('name: before\n');
    expect(await namesIn(rootDir)).toHaveLength(2);
    await staging.staged.discard();
    expect(await namesIn(rootDir)).toEqual(['workspace.yaml']);
    expect(await fs.readFile(inTree('workspace.yaml'), 'utf-8')).toBe('name: before\n');
  });

  it('writes beside its place under a name nothing can know beforehand: a link left at the process’s own name carries nothing out', async () => {
    const victim = path.join(outside, 'victim.txt');
    await fs.writeFile(victim, 'as its owner left it\n', 'utf-8');
    await fs.symlink(victim, `${inTree('workspace.yaml')}.${process.pid}.tmp`);
    await write(new TreeBoundary(rootDir), 'workspace.yaml', 'THE ENGINE’S BYTES\n');
    expect(await fs.readFile(victim, 'utf-8')).toBe('as its owner left it\n');
    expect((await fs.lstat(inTree('workspace.yaml'))).isFile()).toBe(true);
  });

  it('removes a file and the directories it leaves empty, up to the folder — one that holds anything stands', async () => {
    const boundary = new TreeBoundary(rootDir);
    await write(boundary, 'rules/api-cccccccc/block-probes-aaaaaaaa/rule.yaml', 'a\n');
    await write(boundary, 'rules/api-cccccccc/_collection.yaml', 'c\n');
    await write(boundary, 'specs/pets-ssssssss/spec.yaml', 's\n');

    await boundary.remove(await placeOf(boundary, 'rules/api-cccccccc/block-probes-aaaaaaaa/rule.yaml'));
    expect(await namesIn(inTree('rules/api-cccccccc'))).toEqual(['_collection.yaml']);

    await boundary.remove(await placeOf(boundary, 'specs/pets-ssssssss/spec.yaml'));
    expect(await namesIn(rootDir)).toEqual(['rules']);
  });

  it('a directory a removal took is made again for a file written after it, in the same pass', async () => {
    const boundary = new TreeBoundary(rootDir);
    await write(boundary, 'specs/pets-ssssssss/spec.yaml', 's\n');
    await boundary.remove(await placeOf(boundary, 'specs/pets-ssssssss/spec.yaml'));
    await write(boundary, 'specs/pets-ssssssss/index.yaml', 'i\n');
    expect(await namesIn(inTree('specs/pets-ssssssss'))).toEqual(['index.yaml']);
  });
});

describe('treeRefusalIssue', () => {
  it('a place’s row is at the file whose name something that is no file stands at', () => {
    expect(treeRefusalIssue('.gitignore', { kind: 'place' })).toEqual({
      path: '.gitignore',
      message: 'is not a file — not written',
    });
  });

  it('a path’s row is at the file, by core’s sentence; a way’s is at the directory, by what stands there', () => {
    expect(treeRefusalIssue('../outside/spec.yaml', { kind: 'path', part: '".."' })).toEqual({
      path: '../outside/spec.yaml',
      message: '".." cannot be part of a path — not written',
    });
    expect(treeRefusalIssue('specs/pets-ssssssss/spec.yaml', { kind: 'way', dir: 'specs', stands: 'link' })).toEqual({
      path: 'specs/',
      message: 'is a link — not written',
    });
    expect(treeRefusalIssue('specs/pets-ssssssss/spec.yaml', { kind: 'way', dir: 'specs', stands: 'file' })).toEqual({
      path: 'specs/',
      message: 'is not a directory — not written',
    });
  });
});

describe('treeRefusalReason', () => {
  it('says a refusal in a sentence that names the path, for a pass that fails by it', () => {
    expect(treeRefusalReason('../outside/spec.yaml', { kind: 'path', part: '".."' })).toBe(
      '".." cannot be part of the path "../outside/spec.yaml"',
    );
    expect(treeRefusalReason('notes/readme.md', { kind: 'way', dir: 'notes', stands: 'link' })).toBe(
      '"notes/" is a link, on the way to "notes/readme.md"',
    );
    expect(treeRefusalReason('notes/readme.md', { kind: 'way', dir: 'notes', stands: 'file' })).toBe(
      '"notes/" is not a directory, on the way to "notes/readme.md"',
    );
    expect(treeRefusalReason('.gitignore', { kind: 'place' })).toBe('".gitignore" is not a file');
  });
});
