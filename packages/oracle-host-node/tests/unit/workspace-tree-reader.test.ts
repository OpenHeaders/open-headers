/**
 * The host reader on a real (tmp) filesystem: the one guarded read of a
 * file (`tree-file.ts`), the names of a folder with no file opened
 * (`tree-listing.ts`), and the listing a reading of the tree is made of
 * (`reader.ts`) — names first, the documents alone read, and what
 * stands unread told apart from what is gone.
 *
 * A file another program holds or one the system denies is stood in
 * for by the system's code at the open, so those pins run on every
 * platform; the ones that take a mode away are POSIX's.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TREE_FILE_MAX_BYTES } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listWorkspaceTree } from '../../src/workspace-tree/reader';
import { readTreeFile, readWrittenFile } from '../../src/workspace-tree/tree-file';
import { listTreeNames } from '../../src/workspace-tree/tree-listing';

const posixOnly = it.runIf(process.platform !== 'win32');

const WORKSPACE_YAML = 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Workspace\n';
const COLLECTION_YAML = 'schemaVersion: 5\nuid: colapi00\nname: Api\nvariables: []\n';
const RULE_YAML = 'schemaVersion: 5\nuid: aaaaaaaa\nname: Block probes\ntype: block\nenabled: true\n';
const COLLECTION_FILE = 'rules/api-colapi00/_collection.yaml';
const RULE_FILE = 'rules/api-colapi00/block-probes-aaaaaaaa/rule.yaml';

let tmpDir: string;

const at = (relative: string): string => path.join(tmpDir, ...relative.split('/'));

async function write(relative: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(at(relative)), { recursive: true });
  await fs.writeFile(at(relative), text, 'utf-8');
}

/** `fs.open` answering the system's `code` for the paths `refused` picks; every open is kept on the spy. */
function refuseOpen(code: string, refused: (filePath: string) => boolean) {
  const open = fs.open.bind(fs);
  return vi
    .spyOn(fs, 'open')
    .mockImplementation((...args: Parameters<typeof fs.open>) =>
      refused(String(args[0])) ? Promise.reject(Object.assign(new Error(code), { code })) : open(...args),
    );
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-reader-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readTreeFile', () => {
  it('answers a file’s text', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    expect(await readTreeFile(at('workspace.yaml'))).toEqual({ kind: 'text', content: WORKSPACE_YAML });
  });

  it('answers absent for a file that is not there, and for a path through a file', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    expect(await readTreeFile(at('gone.yaml'))).toEqual({ kind: 'absent' });
    expect(await readTreeFile(at('workspace.yaml/inside.yaml'))).toEqual({ kind: 'absent' });
  });

  it('reads a file of the limit’s size and not one a byte over it', async () => {
    await write('at-the-limit.json', '');
    await fs.truncate(at('at-the-limit.json'), TREE_FILE_MAX_BYTES);
    await write('over-the-limit.json', '');
    await fs.truncate(at('over-the-limit.json'), TREE_FILE_MAX_BYTES + 1);

    const atTheLimit = await readTreeFile(at('at-the-limit.json'));
    expect(atTheLimit.kind === 'text' && atTheLimit.content.length).toBe(TREE_FILE_MAX_BYTES);
    expect(await readTreeFile(at('over-the-limit.json'))).toEqual({ kind: 'unread', cause: 'too-large' });
  });

  it('answers unread with the system’s code for a file that will not open — held by another program, or denied', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    const busy = refuseOpen('EBUSY', () => true);
    expect(await readTreeFile(at('workspace.yaml'))).toEqual({ kind: 'unread', cause: 'unreadable', code: 'EBUSY' });
    busy.mockRestore();
    refuseOpen('EPERM', () => true);
    expect(await readTreeFile(at('workspace.yaml'))).toEqual({ kind: 'unread', cause: 'unreadable', code: 'EPERM' });
  });

  posixOnly('answers unread for a file whose mode lets nobody read it', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    await fs.chmod(at('workspace.yaml'), 0o000);
    expect(await readTreeFile(at('workspace.yaml'))).toEqual({ kind: 'unread', cause: 'unreadable', code: 'EACCES' });
  });

  it('answers unread for a directory standing where a file is asked for', async () => {
    await fs.mkdir(at('workspace.yaml'));
    expect(await readTreeFile(at('workspace.yaml'))).toMatchObject({ kind: 'unread', cause: 'unreadable' });
  });
});

describe('readWrittenFile', () => {
  it('reads a file over the limit: the engine’s own write is as large as the engine made it', async () => {
    await write('body.json', '');
    await fs.truncate(at('body.json'), TREE_FILE_MAX_BYTES + 1);
    const read = await readWrittenFile(at('body.json'));
    expect(read.kind === 'text' && read.content.length).toBe(TREE_FILE_MAX_BYTES + 1);
  });

  it('tells a file that stands unread from one that is not there', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    refuseOpen('EPERM', (filePath) => filePath.endsWith('workspace.yaml'));
    expect(await readWrittenFile(at('workspace.yaml'))).toEqual({ kind: 'unread', cause: 'unreadable', code: 'EPERM' });
    expect(await readWrittenFile(at('gone.yaml'))).toEqual({ kind: 'absent' });
  });
});

describe('listTreeNames', () => {
  it('names every file and opens none; `.oh` and `.git` are skipped at the root alone', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    await write('README.md', '# mine\n');
    await write('assets/clips/demo.bin', 'bytes');
    await write('.oh/lock', '{}');
    await write('.git/HEAD', 'ref: refs/heads/main\n');
    await write('vendor/.git/HEAD', 'ref: refs/heads/main\n');
    const opened = refuseOpen('EIO', () => false);

    const names = await listTreeNames(tmpDir);
    expect(names.files.sort()).toEqual(['README.md', 'assets/clips/demo.bin', 'vendor/.git/HEAD', 'workspace.yaml']);
    expect(names.unlisted).toEqual([]);
    expect(opened).not.toHaveBeenCalled();
  });

  it('a folder that is not there has no names, and is not one that would not list', async () => {
    expect(await listTreeNames(path.join(tmpDir, 'gone'))).toEqual({ files: [], unlisted: [] });
  });

  posixOnly('a link is neither followed nor named, to a directory or to a file', async () => {
    await write(RULE_FILE, RULE_YAML);
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-reader-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'rule.yaml'), RULE_YAML, 'utf-8');
      await fs.symlink(outside, at('rules/api-colapi00/linked'));
      await fs.symlink(at(RULE_FILE), at('rules/api-colapi00/linked-rule.yaml'));
      expect((await listTreeNames(tmpDir)).files).toEqual([RULE_FILE]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  posixOnly('a directory that will not list is named, and the rest of the folder is listed', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    await write(RULE_FILE, RULE_YAML);
    await fs.chmod(at('rules/api-colapi00'), 0o000);
    try {
      expect(await listTreeNames(tmpDir)).toEqual({
        files: ['workspace.yaml'],
        unlisted: [{ path: 'rules/api-colapi00', cause: 'unlisted', code: 'EACCES' }],
      });
    } finally {
      await fs.chmod(at('rules/api-colapi00'), 0o755);
    }
  });
});

describe('listWorkspaceTree', () => {
  async function writeTree(): Promise<void> {
    await write('workspace.yaml', WORKSPACE_YAML);
    await write(COLLECTION_FILE, COLLECTION_YAML);
    await write(RULE_FILE, RULE_YAML);
    await write('rules/api-colapi00/block-probes-aaaaaaaa/notes.md', 'why\n');
    await write('README.md', '# mine\n');
    await write('assets/clips/demo.bin', 'bytes');
    await write('.gitignore', '.oh/\n');
  }

  it('reads the documents’ files alone, sorted — a file of the user’s own stands and is never opened', async () => {
    await writeTree();
    const opened = refuseOpen('EIO', () => false);

    const listing = await listWorkspaceTree(tmpDir);
    expect(listing.files.map((file) => file.path)).toEqual([
      COLLECTION_FILE,
      'rules/api-colapi00/block-probes-aaaaaaaa/notes.md',
      RULE_FILE,
      'workspace.yaml',
    ]);
    expect(listing.unread).toEqual([]);
    const own = ['README.md', 'assets/clips/demo.bin', '.gitignore'];
    const openedPaths = opened.mock.calls.map(([filePath]) =>
      path.relative(tmpDir, String(filePath)).split(path.sep).join('/'),
    );
    expect(openedPaths).toHaveLength(4);
    expect(openedPaths.filter((filePath) => own.includes(filePath))).toEqual([]);
    expect([...own, RULE_FILE].map((filePath) => listing.stands(filePath))).toEqual([true, true, true, true]);
    expect(listing.stands('rules/api-colapi00/gone-bbbbbbbb/rule.yaml')).toBe(false);
  });

  it('the files and the paths unread are in path order, whatever order the folder lists them in', async () => {
    await write('workspace.yaml', WORKSPACE_YAML);
    const names = ['aaaa', 'bbbb', 'cccc', 'dddd'];
    for (const name of names) {
      await write(`rules/${name}/_collection.yaml`, COLLECTION_YAML);
      await write(`rules/${name}/pre-request.js`, '// script\n');
    }
    refuseOpen('EBUSY', (filePath) => filePath.endsWith('pre-request.js'));
    // A filesystem lists a folder in an order of its own; this one's is turned around, so it is not the paths'.
    const readdir = fs.readdir.bind(fs);
    const listed: string[][] = [];
    vi.spyOn(fs, 'readdir').mockImplementation(async (...args: Parameters<typeof fs.readdir>) => {
      const entries = (await readdir(...args)).reverse();
      listed.push(entries.map((entry) => String(entry.name)));
      return entries;
    });

    const listing = await listWorkspaceTree(tmpDir);
    expect(listed.some((entries) => entries.join() !== [...entries].sort().join())).toBe(true);
    expect(listing.files.map((file) => file.path)).toEqual([
      ...names.map((name) => `rules/${name}/_collection.yaml`),
      'workspace.yaml',
    ]);
    expect(listing.unread.map((entry) => entry.path)).toEqual(names.map((name) => `rules/${name}/pre-request.js`));
  });

  it('a listed file gone at its read is not of the tree: not read, and not standing', async () => {
    await writeTree();
    refuseOpen('ENOENT', (filePath) => filePath.endsWith('rule.yaml'));

    const listing = await listWorkspaceTree(tmpDir);
    expect(listing.files.map((file) => file.path)).not.toContain(RULE_FILE);
    expect(listing.files.map((file) => file.path)).toContain('workspace.yaml');
    expect(listing.unread).toEqual([]);
    expect(listing.stands(RULE_FILE)).toBe(false);
  });

  it('a file that will not open, and one over the limit, stand unread with their cause, sorted', async () => {
    await writeTree();
    await write('rules/api-colapi00/block-probes-aaaaaaaa/capture.bin', '');
    await fs.truncate(at('rules/api-colapi00/block-probes-aaaaaaaa/capture.bin'), TREE_FILE_MAX_BYTES + 1);
    refuseOpen('EBUSY', (filePath) => filePath.endsWith('_collection.yaml'));

    const listing = await listWorkspaceTree(tmpDir);
    expect(listing.unread).toEqual([
      { path: COLLECTION_FILE, cause: 'unreadable', code: 'EBUSY' },
      { path: 'rules/api-colapi00/block-probes-aaaaaaaa/capture.bin', cause: 'too-large' },
    ]);
    expect(listing.files.map((file) => file.path)).not.toContain(COLLECTION_FILE);
    expect(listing.stands(COLLECTION_FILE)).toBe(true);
    expect(listing.stands('rules/api-colapi00/block-probes-aaaaaaaa/capture.bin')).toBe(true);
  });

  posixOnly('everything beneath a directory that will not list may stand, and nothing beside it', async () => {
    await writeTree();
    await fs.chmod(at('rules/api-colapi00'), 0o000);
    try {
      const listing = await listWorkspaceTree(tmpDir);
      expect(listing.unread).toEqual([{ path: 'rules/api-colapi00', cause: 'unlisted', code: 'EACCES' }]);
      expect(listing.files.map((file) => file.path)).toEqual(['workspace.yaml']);
      expect(listing.stands(RULE_FILE)).toBe(true);
      expect(listing.stands('rules/api-colapi00/never/was/rule.yaml')).toBe(true);
      expect(listing.stands('rules/other-colother/_collection.yaml')).toBe(false);
    } finally {
      await fs.chmod(at('rules/api-colapi00'), 0o755);
    }
  });
});
