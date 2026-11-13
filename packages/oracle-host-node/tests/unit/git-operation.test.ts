/**
 * The git operation a working tree is mid-way through (`operation`) —
 * one a person started outside the app — named for each of the five,
 * and git's own way out of it: a conflicted cherry-pick, revert, merge
 * and rebase and a bisect each read as what they are and abort back to
 * the commit and the files they started from; a several-commit sequence
 * between its steps is named from its todo; a repo at rest has nothing
 * to abort; an abort git refuses says so in git's words. Real git in a
 * scratch repo.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isStateChanging } from '../../src/git/audit-classify';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { abortGitOperation, gitOperationKind } from '../../src/git/operation';
import { ensureWorkspaceRepo, localHeadSha } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
  GIT_EDITOR: 'true',
};

let rootDir: string;
let run: GitRunner;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-git-operation-'));
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  await ensureWorkspaceRepo(run, rootDir);
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

const file = (): string => path.join(rootDir, 'value.txt');

async function git(...args: string[]): Promise<number> {
  return (await run([...repoArgs(rootDir), ...args], { cwd: rootDir })).code;
}

async function commit(text: string, message: string): Promise<string> {
  await fs.writeFile(file(), text, 'utf-8');
  await git('add', '-A');
  if ((await git('commit', '-m', message)) !== 0) throw new Error(`commit failed: ${message}`);
  const sha = await localHeadSha(run, rootDir);
  if (sha === null) throw new Error('no head');
  return sha;
}

/** The trunk and `feature` each change the one line; returns the trunk's tip, the feature's, and the trunk's name. */
async function diverged(): Promise<{ trunk: string; tip: string; feature: string }> {
  await commit('base\n', 'base');
  const trunk = (await run([...repoArgs(rootDir), 'symbolic-ref', '--short', 'HEAD'], { cwd: rootDir })).stdout.trim();
  await git('checkout', '-b', 'feature');
  const feature = await commit('feature\n', 'feature: its value');
  await git('checkout', trunk);
  const tip = await commit('trunk\n', 'trunk: its value');
  return { trunk, tip, feature };
}

async function expectBack(tip: string): Promise<void> {
  expect(await gitOperationKind(rootDir)).toBeNull();
  expect(await localHeadSha(run, rootDir)).toBe(tip);
  expect(await fs.readFile(file(), 'utf-8')).toBe('trunk\n');
}

describe('gitOperationKind / abortGitOperation', () => {
  it('a repo at rest names nothing and has nothing to abort', async () => {
    await diverged();
    expect(await gitOperationKind(rootDir)).toBeNull();
    expect(await abortGitOperation(run, rootDir)).toEqual({ ok: false, reason: 'nothing-in-progress' });
  });

  it('a conflicted cherry-pick is named and aborts back to where it started', async () => {
    const { tip, feature } = await diverged();
    expect(await git('cherry-pick', feature)).not.toBe(0);
    expect(await gitOperationKind(rootDir)).toBe('cherry-pick');
    expect(await abortGitOperation(run, rootDir)).toEqual({ ok: true, operation: 'cherry-pick' });
    await expectBack(tip);
  });

  it('a conflicted merge is named and aborts', async () => {
    const { tip } = await diverged();
    expect(await git('merge', 'feature')).not.toBe(0);
    expect(await gitOperationKind(rootDir)).toBe('merge');
    expect(await abortGitOperation(run, rootDir)).toEqual({ ok: true, operation: 'merge' });
    await expectBack(tip);
  });

  it('a conflicted revert is named and aborts', async () => {
    const { tip } = await diverged();
    await commit('trunk again\n', 'trunk: once more');
    const later = await localHeadSha(run, rootDir);
    expect(await git('revert', '--no-edit', tip)).not.toBe(0);
    expect(await gitOperationKind(rootDir)).toBe('revert');
    expect(await abortGitOperation(run, rootDir)).toEqual({ ok: true, operation: 'revert' });
    expect(await gitOperationKind(rootDir)).toBeNull();
    expect(await localHeadSha(run, rootDir)).toBe(later);
  });

  it('a stopped rebase is named and aborts back onto its branch', async () => {
    const { trunk, tip } = await diverged();
    expect(await git('rebase', 'feature')).not.toBe(0);
    expect(await gitOperationKind(rootDir)).toBe('rebase');
    expect(await abortGitOperation(run, rootDir)).toEqual({ ok: true, operation: 'rebase' });
    await expectBack(tip);
    expect((await run([...repoArgs(rootDir), 'symbolic-ref', '--short', 'HEAD'], { cwd: rootDir })).stdout.trim()).toBe(
      trunk,
    );
  });

  it('a bisect is named and ends back on its branch', async () => {
    const { tip } = await diverged();
    await commit('trunk\n\n', 'trunk: a blank line');
    const later = await localHeadSha(run, rootDir);
    expect(await git('bisect', 'start', 'HEAD', `${tip}~1`)).toBe(0);
    expect(await gitOperationKind(rootDir)).toBe('bisect');
    expect(await abortGitOperation(run, rootDir)).toEqual({ ok: true, operation: 'bisect' });
    expect(await gitOperationKind(rootDir)).toBeNull();
    expect(await localHeadSha(run, rootDir)).toBe(later);
  });

  it('between the steps of a sequence the todo names which it is', async () => {
    await diverged();
    const sequencer = path.join(rootDir, '.git', 'sequencer');
    await fs.mkdir(sequencer);
    await fs.writeFile(path.join(sequencer, 'todo'), `revert ${'a'.repeat(40)} trunk: its value\n`, 'utf-8');
    expect(await gitOperationKind(rootDir)).toBe('revert');
    await fs.writeFile(path.join(sequencer, 'todo'), `pick ${'a'.repeat(40)} feature: its value\n`, 'utf-8');
    expect(await gitOperationKind(rootDir)).toBe('cherry-pick');
  });

  it('an abort git refuses answers with git’s own words and leaves the operation standing', async () => {
    const { feature } = await diverged();
    expect(await git('cherry-pick', feature)).not.toBe(0);
    const lock = path.join(rootDir, '.git', 'index.lock');
    await fs.writeFile(lock, '', { flag: 'wx' });
    const refused = await abortGitOperation(run, rootDir);
    await fs.rm(lock);
    expect(refused).toMatchObject({ ok: false, reason: 'abort-failed', operation: 'cherry-pick' });
    expect(refused.ok === false && refused.reason === 'abort-failed' ? refused.detail : '').toMatch(/index\.lock/);
    expect(await gitOperationKind(rootDir)).toBe('cherry-pick');
  });

  it('every abort is a state-changing command — the Console shows it', () => {
    const repo = repoArgs('/repo');
    for (const command of [
      ['rebase', '--abort'],
      ['merge', '--abort'],
      ['cherry-pick', '--abort'],
      ['revert', '--abort'],
      ['bisect', 'reset'],
    ]) {
      expect(isStateChanging([...repo, ...command])).toBe(true);
    }
  });
});
