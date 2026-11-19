/**
 * What no git command of ours takes out of the working tree — real tmp
 * repos against the system binary. The folder's `.gitignore` is a file a
 * peer's commit writes: with it holding the entries, gone, taking them
 * back on a later line, standing as a link, or overruled by one deeper
 * in the folder, the sidecar and the secret files are never staged,
 * stashed or cleaned away, and everything else still is. A link is a
 * symbolic link here.
 *
 * And a command over named paths: each shape of what is named still
 * lands — one new file in a new directory among them, which an exclude
 * beside it leaves unstaged — a name the rule names is not handed to
 * git, no command is run with none left, and what a named directory
 * brings that the rule names is put back as HEAD has it.
 *
 * And that the forms git is told it in name what core's rule names.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isNeverCommittedPath } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import {
  cleanUntracked,
  commitWorkspaceTree,
  countDirtyFiles,
  ensureWorkspaceRepo,
  intentToAddPaths,
  repoArgs,
  stashWorkspaceTree,
} from '../../src/git/repo';
import { listTreeEntries, snapshotWorkingTree } from '../../src/git/tree-ops';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

const ENTRIES = '.oh/\n*.secret.yaml\n';
const SIDECAR_FILE = '.oh/lock';
const VAULT_FILE = 'workspace-vars.secret.yaml';
const ENVIRONMENT_FILE = 'environments/dev-env00001.yaml';
const ENVIRONMENT_SECRET_FILE = 'environments/dev-env00001.secret.yaml';
const NEVER_COMMITTED = [SIDECAR_FILE, ENVIRONMENT_SECRET_FILE, VAULT_FILE];

let scratch: string;
let rootDir: string;
let outside: string;
let run: GitRunner;

const inTree = (relative: string): string => path.join(rootDir, ...relative.split('/'));
const isThere = (relative: string): Promise<boolean> =>
  fs.lstat(inTree(relative)).then(
    () => true,
    () => false,
  );

async function write(relative: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(inTree(relative)), { recursive: true });
  await fs.writeFile(inTree(relative), content, 'utf-8');
}

async function git(...args: string[]): Promise<string> {
  const result = await run([...repoArgs(rootDir), ...args], { cwd: rootDir, env: IDENTITY_ENV });
  if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

const commit = (message: string, paths?: readonly string[]) =>
  commitWorkspaceTree({ run, rootDir, message, identityEnv: IDENTITY_ENV, ...(paths !== undefined ? { paths } : {}) });

async function pathsOf(ref: string): Promise<string[]> {
  const entries = await listTreeEntries(run, rootDir, ref);
  if (entries === null) throw new Error(`unreadable tree: ${ref}`);
  return [...entries.keys()].sort();
}

/** A repo whose one commit holds the manifest alone, then the sidecar, a vault and an environment with its secret on disk. */
async function seedWithSecrets(): Promise<void> {
  await ensureWorkspaceRepo(run, rootDir);
  await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
  expect(await commit('seed')).toMatchObject({ ok: true, committed: true });
  await write(SIDECAR_FILE, '{}\n');
  await write(VAULT_FILE, 'schemaVersion: 5\nsecrets: []\n');
  await write(ENVIRONMENT_FILE, 'schemaVersion: 5\nuid: env00001\nname: dev\n');
  await write(ENVIRONMENT_SECRET_FILE, 'schemaVersion: 5\nvariables: []\n');
}

/** What the folder's ignore files are when a command runs. */
const IGNORE_STATES: ReadonlyArray<readonly [string, () => Promise<void>]> = [
  ['holds both entries', () => write('.gitignore', ENTRIES)],
  ['is not there', async () => undefined],
  ['takes the entries back on a later line', () => write('.gitignore', `${ENTRIES}!*.secret.yaml\n!.oh/\n`)],
  [
    'is a link to a file that holds the entries',
    async () => {
      await fs.writeFile(path.join(outside, 'ignore'), ENTRIES, 'utf-8');
      await fs.symlink(path.join(outside, 'ignore'), inTree('.gitignore'));
    },
  ],
  [
    'holds the entries and one deeper takes them back',
    async () => {
      await write('.gitignore', ENTRIES);
      await write('environments/.gitignore', '!*.secret.yaml\n');
    },
  ],
];

beforeEach(async () => {
  scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oh-never-committed-')));
  rootDir = path.join(scratch, 'bound');
  outside = path.join(scratch, 'outside');
  await fs.mkdir(rootDir);
  await fs.mkdir(outside);
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, { ...options, env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env } });
});

afterEach(async () => {
  await fs.rm(scratch, { recursive: true, force: true });
});

describe.each(IGNORE_STATES)('the sidecar and the secret files where the folder’s .gitignore %s', (_state, ignore) => {
  beforeEach(async () => {
    await seedWithSecrets();
    await ignore();
  });

  it('are in no reading of the working tree, and the environment beside its secret is', async () => {
    const tree = await snapshotWorkingTree(run, rootDir);
    if (tree === null) throw new Error('the working tree could not be read');
    const held = await pathsOf(tree);
    expect(held.filter((filePath) => NEVER_COMMITTED.includes(filePath))).toEqual([]);
    expect(held).toContain(ENVIRONMENT_FILE);
  });

  it('are in no commit of the whole tree, and the environment beside its secret is', async () => {
    expect(await commit('everything')).toMatchObject({ ok: true, committed: true });
    const held = await pathsOf('HEAD');
    expect(held.filter((filePath) => NEVER_COMMITTED.includes(filePath))).toEqual([]);
    expect(held).toContain(ENVIRONMENT_FILE);
  });

  it('stay on disk across a stash that takes the tracked edit and the untracked file', async () => {
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Edited\n');
    await write('notes.md', '# scratch\n');
    expect(await stashWorkspaceTree(run, rootDir, 'OpenHeaders: switch to feature')).toEqual({ ok: true });
    for (const filePath of NEVER_COMMITTED) expect(await isThere(filePath)).toBe(true);
    expect(await isThere('notes.md')).toBe(false);
    expect(await fs.readFile(inTree('workspace.yaml'), 'utf-8')).toContain('name: Probe\n');
    const stashed = await pathsOf('stash@{0}^3');
    expect(stashed.filter((filePath) => NEVER_COMMITTED.includes(filePath))).toEqual([]);
    expect(stashed).toContain('notes.md');
  });

  it('stay on disk across a clean that removes the untracked file', async () => {
    await write('notes.md', '# scratch\n');
    expect(await cleanUntracked(run, rootDir)).toEqual({ ok: true });
    for (const filePath of NEVER_COMMITTED) expect(await isThere(filePath)).toBe(true);
    expect(await isThere('notes.md')).toBe(false);
  });
});

describe('a file no commit holds, named to a command', () => {
  beforeEach(seedWithSecrets);

  it.each([
    ['one new file in a new directory', 'rules/block-r0000001/rule.yaml', 'rules/block-r0000001/rule.yaml'],
    ['one new file at the root', 'notes.md', 'notes.md'],
    ['a directory that holds a secret beside a file', 'environments', ENVIRONMENT_FILE],
  ])('a commit of %s takes it, and no file the rule names', async (_shape, checked, landed) => {
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await write('notes.md', '# scratch\n');
    expect(await commit('checked', [checked])).toMatchObject({ ok: true, committed: true });
    expect(await pathsOf('HEAD')).toEqual([landed, 'workspace.yaml'].sort());
  });

  it('Add to VCS of one new file in a new directory tracks it', async () => {
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    expect(await intentToAddPaths(run, rootDir, ['rules/block-r0000001/rule.yaml'])).toEqual({ ok: true });
    expect((await git('ls-files')).trim().split('\n').sort()).toEqual([
      'rules/block-r0000001/rule.yaml',
      'workspace.yaml',
    ]);
  });

  it('is not staged by a commit of checked files: the file checked beside it is committed alone', async () => {
    expect(await commit('checked', [VAULT_FILE, ENVIRONMENT_FILE])).toMatchObject({ ok: true, committed: true });
    expect(await pathsOf('HEAD')).toEqual([ENVIRONMENT_FILE, 'workspace.yaml']);
  });

  it('checked alone commits nothing', async () => {
    expect(await commit('checked', [VAULT_FILE])).toEqual({ ok: true, committed: false });
    expect(await pathsOf('HEAD')).toEqual(['workspace.yaml']);
  });

  it('is not tracked by Add to VCS: the file named beside it is, and named alone nothing is', async () => {
    expect(await intentToAddPaths(run, rootDir, [VAULT_FILE, SIDECAR_FILE])).toEqual({ ok: true });
    expect((await git('ls-files')).trim().split('\n')).toEqual(['workspace.yaml']);
    expect(await intentToAddPaths(run, rootDir, [VAULT_FILE, SIDECAR_FILE, ENVIRONMENT_FILE])).toEqual({ ok: true });
    expect((await git('ls-files')).trim().split('\n').sort()).toEqual([ENVIRONMENT_FILE, 'workspace.yaml']);
  });

  it('is no uncommitted work in the count — nor is a directory that holds nothing else', async () => {
    await fs.rm(inTree(ENVIRONMENT_FILE));
    const listed = await git('status', '--porcelain');
    for (const row of ['?? .oh/', '?? environments/', `?? ${VAULT_FILE}`]) expect(listed).toContain(row);
    expect(await countDirtyFiles(run, rootDir)).toBe(0);

    await write(ENVIRONMENT_FILE, 'schemaVersion: 5\nuid: env00001\nname: dev\n');
    expect(await countDirtyFiles(run, rootDir)).toBe(1);
    await write('notes.md', '# scratch\n');
    expect(await countDirtyFiles(run, rootDir)).toBe(2);
  });
});

describe('a secret file a commit already holds', () => {
  it('is left as HEAD has it by a commit of the whole tree: its edit and its removal are not recorded', async () => {
    await ensureWorkspaceRepo(run, rootDir);
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    await write(VAULT_FILE, 'schemaVersion: 5\nsecrets: []\n');
    await git('add', '--', 'workspace.yaml', VAULT_FILE);
    await git('commit', '-q', '-m', 'a vault committed by hand');
    const held = await git('rev-parse', `HEAD:${VAULT_FILE}`);

    await write(VAULT_FILE, 'schemaVersion: 5\nsecrets:\n  - uid: scapitkn\n');
    expect(await commit('an edit')).toEqual({ ok: true, committed: false });
    await fs.rm(inTree(VAULT_FILE));
    expect(await commit('a removal')).toEqual({ ok: true, committed: false });
    expect(await git('rev-parse', `HEAD:${VAULT_FILE}`)).toBe(held);
  });

  it('is left as HEAD has it by a commit of the directory it is in: the file edited beside it is recorded', async () => {
    await ensureWorkspaceRepo(run, rootDir);
    await write(ENVIRONMENT_FILE, 'schemaVersion: 5\nuid: env00001\nname: dev\n');
    await write(ENVIRONMENT_SECRET_FILE, 'schemaVersion: 5\nvariables: []\n');
    await git('add', '--', ENVIRONMENT_FILE, ENVIRONMENT_SECRET_FILE);
    await git('commit', '-q', '-m', 'a secret committed by hand');
    const held = await git('rev-parse', `HEAD:${ENVIRONMENT_SECRET_FILE}`);

    await write(ENVIRONMENT_FILE, 'schemaVersion: 5\nuid: env00001\nname: development\n');
    await write(ENVIRONMENT_SECRET_FILE, 'schemaVersion: 5\nvariables:\n  - uid: v0000001\n');
    expect(await commit('the directory', ['environments'])).toMatchObject({ ok: true, committed: true });
    expect(await git('rev-parse', `HEAD:${ENVIRONMENT_SECRET_FILE}`)).toBe(held);
    expect(await git('show', `HEAD:${ENVIRONMENT_FILE}`)).toContain('name: development');
  });
});

describe('a directory named to the first commit of a branch', () => {
  it('lands the files in it a commit holds, and no secret beside them', async () => {
    await ensureWorkspaceRepo(run, rootDir);
    await write(ENVIRONMENT_FILE, 'schemaVersion: 5\nuid: env00001\nname: dev\n');
    await write(ENVIRONMENT_SECRET_FILE, 'schemaVersion: 5\nvariables: []\n');
    expect(await commit('the directory', ['environments'])).toMatchObject({ ok: true, committed: true });
    expect(await pathsOf('HEAD')).toEqual([ENVIRONMENT_FILE]);
  });
});

describe('the forms git is told it in', () => {
  const SAMPLES = [
    'workspace.yaml',
    'workspace-vars.secret.yaml',
    '.oh/lock',
    '.oh/deep/er/file.json',
    'environments/dev-env00001.yaml',
    'environments/dev-env00001.secret.yaml',
    'environments/dev-env00001.secret.yaml.template',
    'environments/X.SECRET.YAML',
    'environments/.OH/lock',
    'notes/.oh',
    'notes/.ohx/lock',
    'held.secret.yaml/readme.md',
    'secret.yaml',
  ];
  const held = SAMPLES.filter((filePath) => !isNeverCommittedPath(filePath)).sort();

  beforeEach(async () => {
    await ensureWorkspaceRepo(run, rootDir);
    for (const filePath of SAMPLES) await write(filePath, `${filePath}\n`);
  });

  it('a reading of the working tree holds exactly the files core’s rule does not name — with no ignore file', async () => {
    const tree = await snapshotWorkingTree(run, rootDir);
    if (tree === null) throw new Error('the working tree could not be read');
    expect(await pathsOf(tree)).toEqual(held);
  });

  it('a clean leaves the files core’s rule names, and what a directory named as a secret file holds — with no ignore file', async () => {
    expect(await cleanUntracked(run, rootDir)).toEqual({ ok: true });
    const left: string[] = [];
    for (const filePath of SAMPLES) if (await isThere(filePath)) left.push(filePath);
    // An ignore entry names a directory too: clean keeps more than the rule asks, never less.
    expect(left.sort()).toEqual([...SAMPLES.filter(isNeverCommittedPath), 'held.secret.yaml/readme.md'].sort());
  });

  it('a clean leaves the same files where git folds no name, as on a case-sensitive filesystem', async () => {
    await git('config', 'core.ignorecase', 'false');
    expect(await cleanUntracked(run, rootDir)).toEqual({ ok: true });
    const left: string[] = [];
    for (const filePath of SAMPLES) if (await isThere(filePath)) left.push(filePath);
    expect(left.sort()).toEqual([...SAMPLES.filter(isNeverCommittedPath), 'held.secret.yaml/readme.md'].sort());
  });
});
