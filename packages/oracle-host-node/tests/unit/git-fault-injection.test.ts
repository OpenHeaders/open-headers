/**
 * Fault-injection suite over the `GitRunner` seam (the git-sync plan §22.2 /
 * the sync-engine design §22.2): scripted runners — never spawned
 * processes — inject concurrent pushes, rewritten history, timeouts,
 * and credential failures, and every outcome must land in a typed
 * classification (no fault ever surfaces as a success, no
 * classification ever falls through to a throw). The seeded property
 * leg drives randomized fault sequences through the push verb and
 * checks the classification is total and truthful.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitExecResult, GitRunner } from '../../src/git/git-exec';
import { fetchWorkspaceRemote, pushWorkspaceBranch, resolveUpstream } from '../../src/git/repo';
import { pullWorkspaceTree } from '../../src/workspace-tree/pull';

const ok = (stdout = ''): GitExecResult => ({ code: 0, stdout, stderr: '', spawnFailed: false, timedOut: false });
const fail = (code: number, stderr: string, extra: Partial<GitExecResult> = {}): GitExecResult => ({
  code,
  stdout: '',
  stderr,
  spawnFailed: false,
  timedOut: false,
  ...extra,
});

type Rule = { match: (args: readonly string[]) => boolean; result: () => GitExecResult };

/** A GitRunner answered entirely from a script — the §22.2 mock seam. */
function scripted(rules: Rule[]): GitRunner {
  return async (args) => {
    for (const rule of rules) {
      if (rule.match(args)) return rule.result();
    }
    return ok();
  };
}

const has =
  (...tokens: string[]) =>
  (args: readonly string[]): boolean =>
    tokens.every((token) => args.includes(token));

/** Upstream plumbing answers for a branch tracking origin/main. */
function upstreamRules(remoteSha: string, ahead: number, behind: number): Rule[] {
  return [
    { match: has('rev-parse', '--abbrev-ref', '@{u}'), result: () => ok('origin/main\n') },
    { match: has('rev-parse', '@{u}'), result: () => ok(`${remoteSha}\n`) },
    { match: has('rev-list', '--left-right', '--count'), result: () => ok(`${ahead}\t${behind}\n`) },
    {
      match: has('rev-parse', '--verify', '--quiet', 'HEAD'),
      result: () => ok('aaaa000000000000000000000000000000000000\n'),
    },
  ];
}

let tmpDir: string;

beforeEach(async () => {
  // A plain directory with no `.git/` op markers — the filesystem side
  // of the pull pass's in-progress-op probe.
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-git-fault-'));
  await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('push fault classification', () => {
  const REMOTE = 'ffff000000000000000000000000000000000000';

  it('a concurrent push (non-fast-forward) classifies as rejected, then succeeds after the race is resolved', async () => {
    let remoteMoved = true;
    const run = scripted([
      ...upstreamRules(REMOTE, 1, 0),
      {
        match: has('push'),
        result: () =>
          remoteMoved
            ? fail(1, 'To origin\n ! [rejected] main -> main (fetch first)\nerror: failed to push some refs\n')
            : ok(),
      },
    ]);
    const first = await pushWorkspaceBranch(run, tmpDir);
    expect(first).toMatchObject({ ok: false, reason: 'rejected' });

    remoteMoved = false;
    const second = await pushWorkspaceBranch(run, tmpDir);
    expect(second).toMatchObject({ ok: true, pushed: true });
  });

  it('a permission refusal (protected branch / read-only remote) classifies as no-permission', async () => {
    const run = scripted([
      ...upstreamRules(REMOTE, 2, 0),
      {
        match: has('push'),
        result: () => fail(1, 'To origin\n ! [remote rejected] main -> main (protected branch hook declined)\n'),
      },
    ]);
    expect(await pushWorkspaceBranch(run, tmpDir)).toMatchObject({ ok: false, reason: 'no-permission' });
  });

  it('an authentication failure classifies as no-permission', async () => {
    const run = scripted([
      ...upstreamRules(REMOTE, 1, 0),
      {
        match: has('push'),
        result: () => fail(128, "fatal: Authentication failed for 'https://git.openheaders.io/team/ws.git/'\n"),
      },
    ]);
    expect(await pushWorkspaceBranch(run, tmpDir)).toMatchObject({ ok: false, reason: 'no-permission' });
  });

  it('a timeout classifies as push-failed, never as success', async () => {
    const run = scripted([
      ...upstreamRules(REMOTE, 1, 0),
      { match: has('push'), result: () => fail(-1, '', { timedOut: true }) },
    ]);
    expect(await pushWorkspaceBranch(run, tmpDir)).toMatchObject({ ok: false, reason: 'push-failed' });
  });

  it('an in-sync branch never touches the network', async () => {
    let pushCalls = 0;
    const run = scripted([
      ...upstreamRules(REMOTE, 0, 0),
      {
        match: has('push'),
        result: () => {
          pushCalls += 1;
          return ok();
        },
      },
    ]);
    expect(await pushWorkspaceBranch(run, tmpDir)).toEqual({ ok: true, pushed: false, remoteSha: REMOTE });
    expect(pushCalls).toBe(0);
  });
});

describe('fetch/pull fault surfaces', () => {
  it('a credential failure on fetch is a typed failure with the stderr surfaced', async () => {
    const run = scripted([
      {
        match: has('fetch'),
        result: () =>
          fail(128, "fatal: could not read Username for 'https://git.openheaders.io': terminal prompts disabled\n"),
      },
    ]);
    const result = await fetchWorkspaceRemote(run, tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('terminal prompts disabled');
  });

  it('a rewritten remote head refuses the pull as force-push before any tree is read', async () => {
    const WATERMARK = '1111000000000000000000000000000000000000';
    const REWRITTEN = '2222000000000000000000000000000000000000';
    let treeReads = 0;
    const run = scripted([
      { match: has('fetch'), result: () => ok() },
      ...upstreamRules(REWRITTEN, 0, 3),
      { match: has('merge-base', '--is-ancestor'), result: () => fail(1, '') },
      {
        match: has('ls-tree'),
        result: () => {
          treeReads += 1;
          return ok();
        },
      },
    ]);
    const result = await pullWorkspaceTree({
      run,
      rootDir: tmpDir,
      workspaceUid: 'wsaaaaaa',
      readSnapshot: async () => {
        throw new Error('snapshot must not be read on a refused pull');
      },
      nextCtx: () => {
        throw new Error('no batches on a refused pull');
      },
      liveSetEntries: () => [],
      apply: async () => {
        throw new Error('no batches on a refused pull');
      },
      flush: async () => undefined,
      identityEnv: {},
      bypassHooks: false,
      lastSyncedRemoteSha: WATERMARK,
    });
    expect(result).toMatchObject({ ok: false, reason: 'force-push', detail: REWRITTEN });
    expect(treeReads).toBe(0);
  });

  it('a pull with a fetch timeout is a typed fetch failure', async () => {
    const run = scripted([
      ...upstreamRules('3333000000000000000000000000000000000000', 0, 1),
      { match: has('fetch'), result: () => fail(-1, '', { timedOut: true }) },
    ]);
    const result = await pullWorkspaceTree({
      run,
      rootDir: tmpDir,
      workspaceUid: 'wsaaaaaa',
      readSnapshot: async () => {
        throw new Error('snapshot must not be read on a refused pull');
      },
      nextCtx: () => {
        throw new Error('no batches on a refused pull');
      },
      liveSetEntries: () => [],
      apply: async () => undefined,
      flush: async () => undefined,
      identityEnv: {},
      bypassHooks: false,
    });
    expect(result).toMatchObject({ ok: false, reason: 'fetch-failed' });
  });
});

describe('seeded fault-sequence property', () => {
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  type Fault = 'accept' | 'reject-nonff' | 'deny' | 'timeout' | 'network';

  const FAULT_RESULTS: Record<Fault, () => GitExecResult> = {
    accept: () => ok(),
    'reject-nonff': () => fail(1, ' ! [rejected] main -> main (non-fast-forward)\n'),
    deny: () => fail(1, ' ! [remote rejected] main -> main (permission denied)\n'),
    timeout: () => fail(-1, '', { timedOut: true }),
    network: () => fail(128, 'fatal: unable to access remote: could not resolve host\n'),
  };

  const EXPECTED: Record<Fault, { ok: boolean; reason?: string }> = {
    accept: { ok: true },
    'reject-nonff': { ok: false, reason: 'rejected' },
    deny: { ok: false, reason: 'no-permission' },
    timeout: { ok: false, reason: 'push-failed' },
    network: { ok: false, reason: 'push-failed' },
  };

  it('every randomized fault sequence classifies totally and truthfully (60 seeds × 8 attempts)', async () => {
    const faults: Fault[] = ['accept', 'reject-nonff', 'deny', 'timeout', 'network'];
    for (let seed = 1; seed <= 60; seed += 1) {
      const rand = mulberry32(seed);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const fault = faults[Math.floor(rand() * faults.length)];
        const ahead = 1 + Math.floor(rand() * 3);
        const run = scripted([
          ...upstreamRules('ffff000000000000000000000000000000000000', ahead, 0),
          { match: has('push'), result: FAULT_RESULTS[fault] },
        ]);
        const result = await pushWorkspaceBranch(run, tmpDir);
        const expected = EXPECTED[fault];
        expect(result.ok, `seed ${seed} attempt ${attempt} fault ${fault}`).toBe(expected.ok);
        if (!result.ok) {
          expect(result.reason, `seed ${seed} attempt ${attempt} fault ${fault}`).toBe(expected.reason);
          expect(result.detail.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('resolveUpstream degrades to null on scripted plumbing failures instead of throwing', async () => {
    const variants: GitRunner[] = [
      scripted([{ match: has('rev-parse', '--abbrev-ref', '@{u}'), result: () => fail(128, 'fatal: no upstream\n') }]),
      scripted([
        { match: has('rev-parse', '--abbrev-ref', '@{u}'), result: () => ok('origin/main\n') },
        { match: has('rev-parse', '@{u}'), result: () => fail(128, 'fatal: bad revision\n') },
      ]),
      scripted([
        { match: has('rev-parse', '--abbrev-ref', '@{u}'), result: () => ok('origin/main\n') },
        { match: has('rev-list', '--left-right', '--count'), result: () => ok('garbage\n') },
      ]),
    ];
    for (const run of variants) {
      expect(await resolveUpstream(run, tmpDir)).toBeNull();
    }
  });
});
