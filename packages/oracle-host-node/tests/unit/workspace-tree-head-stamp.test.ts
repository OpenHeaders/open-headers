/**
 * The §6.3 HEAD stamp on real tmp repos (the git-sync plan §3.4,
 * S25 gap A): a branch stamps its name, a detached HEAD stamps
 * `@{<sha>}` — a key no ref name can take, so detached rows never join
 * the trunk — and two detached commits are two IDENTITIES, so the
 * pointer sync that gates the external-checkout sweep reports a
 * change between them (the null→null miss that kept the engine on the
 * old commit's state).
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { commitWorkspaceTree, ensureWorkspaceRepo, isSafeRefName, repoArgs } from '../../src/git/repo';
import { detachedHeadStamp } from '../../src/sync/sqlite-mutation-log';
import { headStampOf } from '../../src/workspace-tree/runtime/branches';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Probe Operator',
  GIT_AUTHOR_EMAIL: 'probe-operator@users.noreply.openheaders.io',
  GIT_COMMITTER_NAME: 'Probe Operator',
  GIT_COMMITTER_EMAIL: 'probe-operator@users.noreply.openheaders.io',
};

let tmpDir: string;
let run: GitRunner;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-head-stamp-'));
  const base = createGitExec();
  run = (args, options) =>
    base(args, { ...options, env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env } });
  await ensureWorkspaceRepo(run, tmpDir);
  await run([...repoArgs(tmpDir), 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const git = (...args: string[]) => run([...repoArgs(tmpDir), ...args], { cwd: tmpDir });

async function commit(rel: string, content: string, message: string): Promise<string> {
  const target = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
  const result = await commitWorkspaceTree({ run, rootDir: tmpDir, message, identityEnv: IDENTITY_ENV });
  if (!result.ok || !result.committed) throw new Error(`commit failed: ${message}`);
  return result.sha;
}

describe('headStampOf', () => {
  it('an unborn branch stamps its name', async () => {
    expect(await headStampOf(run, tmpDir)).toBe('main');
  });

  it('a branch stamps its name; a detached HEAD stamps @{<sha>}, and two detached commits differ', async () => {
    const first = await commit('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: One\n', 'one');
    const second = await commit('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Two\n', 'two');
    expect(await headStampOf(run, tmpDir)).toBe('main');

    await git('checkout', '--quiet', '--detach', second);
    const atSecond = await headStampOf(run, tmpDir);
    expect(atSecond).toBe(detachedHeadStamp(second));
    expect(atSecond.startsWith('@{')).toBe(true);

    // The S24 miss: name→name compared null to null here and skipped
    // the sweep; the identities differ and the tree differs with them.
    await git('checkout', '--quiet', '--detach', first);
    const atFirst = await headStampOf(run, tmpDir);
    expect(atFirst).toBe(detachedHeadStamp(first));
    expect(atFirst).not.toBe(atSecond);
    expect(await fs.readFile(path.join(tmpDir, 'workspace.yaml'), 'utf-8')).toContain('name: One');

    // The same detached commit twice is the same identity (an echo).
    expect(await headStampOf(run, tmpDir)).toBe(atFirst);

    await git('checkout', '--quiet', 'main');
    expect(await headStampOf(run, tmpDir)).toBe('main');
  });

  it('the detached stamp can never be a branch name — refused by git itself and by the plane', async () => {
    const sha = await commit('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: One\n', 'one');
    const stamp = detachedHeadStamp(sha);
    expect(isSafeRefName(stamp)).toBe(false);
    expect(isSafeRefName(sha)).toBe(true);
    expect((await git('check-ref-format', '--branch', stamp)).code).not.toBe(0);
    expect((await git('branch', stamp)).code).not.toBe(0);
  });
});
