/**
 * One git kept open on a repo (`git/object-batch`): commits asked by
 * hash and answered whole, in order, with no process per ask — started
 * by the first read, one read at a time, a read that runs out of time
 * or loses its git answered null and the next one starting git again,
 * and `close` ending it. Real git in a scratch repo.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGitObjectBatches, type GitObjectBatch, withObjectBatch } from '../../src/git/object-batch';
import { objects, openScratchRepo, type ScratchRepo, seedHistory } from './_log-history-repo';

/** The git processes reading this repo through a batch, by the operating system's own list. */
async function batchPids(rootDir: string): Promise<number[]> {
  const { execFile } = await import('node:child_process');
  const out = await new Promise<string>((resolve) =>
    execFile('ps', ['-axo', 'pid=,command='], (_error, stdout) => resolve(String(stdout))),
  );
  return out
    .split('\n')
    .filter((line) => line.includes('cat-file --batch') && line.includes(rootDir))
    .map((line) => Number.parseInt(line, 10));
}

const settled = async (check: () => Promise<boolean>): Promise<boolean> => {
  for (let tries = 0; tries < 100; tries += 1) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
};

describe.skipIf(process.platform === 'win32')('a git kept open on a repo', () => {
  let repo: ScratchRepo;
  let shas: string[];
  let batch: GitObjectBatch;

  beforeAll(async () => {
    repo = await openScratchRepo('oh-object-batch-');
    await seedHistory(repo);
    shas = await repo.shas('HEAD');
  });

  afterAll(async () => {
    batch?.close();
    await repo.remove();
  });

  it('starts no git before it is read, and one for every read after', async () => {
    batch = objects({ cwd: repo.rootDir });
    expect(await batchPids(repo.rootDir)).toEqual([]);
    expect(await batch.readCommits([])).toEqual([]);
    expect(await batchPids(repo.rootDir)).toEqual([]);

    await batch.readCommits(shas.slice(0, 2));
    const first = await batchPids(repo.rootDir);
    expect(first).toHaveLength(1);
    await batch.readCommits(shas);
    expect(await batchPids(repo.rootDir)).toEqual(first);
  });

  it('answers each commit’s own bytes, in the order asked', async () => {
    const asked = [shas[3], shas[0], shas[3]];
    const read = await batch.readCommits(asked);
    expect(read).toHaveLength(3);
    const text = (read ?? []).map((bytes) => bytes?.toString('utf8') ?? '');
    expect(text[0]).toContain('\n\nRename the request\n');
    expect(text[1]).toContain('\n\nRelease notes\n');
    expect(text[2]).toBe(text[0]);
    expect(text[0].startsWith('tree ')).toBe(true);
  });

  it('answers null for a hash the repo holds no commit under — none at all, or another kind of object', async () => {
    const tree = (await repo.git(['rev-parse', 'HEAD^{tree}'])).trim();
    const read = await batch.readCommits([shas[0], 'f'.repeat(40), tree, shas[1]]);
    expect(read?.map((bytes) => bytes !== null)).toEqual([true, false, false, true]);
  });

  it('answers reads asked together one at a time, each its own commits', async () => {
    const all = await Promise.all(shas.map((sha) => batch.readCommits([sha, sha])));
    const whole = await batch.readCommits(shas);
    expect(all.map((pair) => pair?.[1]?.toString('utf8'))).toEqual(whole?.map((bytes) => bytes?.toString('utf8')));
  });

  it('answers a blob’s own bytes by its hash — a large one whole, between small ones — and null for what is no blob', async () => {
    const texts = ['openapi: 3.1.0\n', 'x-note: John Doe keeps this line\n'.repeat(100_000), 'last\n'];
    const blobs: string[] = [];
    for (const [index, text] of texts.entries()) {
      await fs.writeFile(path.join(repo.rootDir, `blob-${index}.yaml`), text, 'utf-8');
      blobs.push((await repo.git(['hash-object', '-w', `blob-${index}.yaml`])).trim());
    }
    const read = await batch.readBlobs([blobs[0], blobs[1], shas[0], blobs[2], 'f'.repeat(40)]);
    expect(read?.map((bytes) => bytes?.toString('utf8') ?? null)).toEqual([texts[0], texts[1], null, texts[2], null]);
    expect(await batch.readCommits([blobs[0]])).toEqual([null]);
  });

  it('never asks git for a name that is no hash: it answers null, and every read after it is still its own', async () => {
    const read = await batch.readCommits([`${shas[0]}\n${shas[1]}`, 'HEAD', shas[3]]);
    expect(read?.map((bytes) => bytes !== null)).toEqual([false, false, true]);
    expect(read?.[2]?.toString('utf8')).toContain('\n\nRename the request\n');
    expect((await batch.readCommits([shas[0]]))?.[0]?.toString('utf8')).toContain('\n\nRelease notes\n');
    expect(await batch.readBlobs(['HEAD:workspace.yaml'])).toEqual([null]);
  });

  it('answers null when its git goes away, and starts git again for the next read', async () => {
    const [pid] = await batchPids(repo.rootDir);
    process.kill(pid);
    expect(await settled(async () => (await batchPids(repo.rootDir)).length === 0)).toBe(true);
    const read = await batch.readCommits(shas.slice(0, 3));
    expect(read?.every((bytes) => bytes !== null)).toBe(true);
    const again = await batchPids(repo.rootDir);
    expect(again).toHaveLength(1);
    expect(again[0]).not.toBe(pid);
  });

  it('ends its git on close, and answers null from then on', async () => {
    batch.close();
    expect(await settled(async () => (await batchPids(repo.rootDir)).length === 0)).toBe(true);
    expect(await batch.readCommits(shas.slice(0, 2))).toBeNull();
    expect(await batchPids(repo.rootDir)).toEqual([]);
  });

  it('answers a read in flight null when it is closed under it', async () => {
    const stalled = await stalledGit();
    try {
      const closing = createGitObjectBatches({ gitBinary: stalled.binary })({ cwd: repo.rootDir });
      const read = closing.readCommits(shas.slice(0, 2));
      const queued = closing.readCommits(shas.slice(2, 4));
      await new Promise((resolve) => setTimeout(resolve, 100));
      closing.close();
      expect(await read).toBeNull();
      expect(await queued).toBeNull();
    } finally {
      await stalled.remove();
    }
  });

  it('answers null for a read that runs out of time, and lets its git go', async () => {
    const stalled = await stalledGit();
    try {
      const slow = createGitObjectBatches({ gitBinary: stalled.binary, readTimeoutMs: 150 })({ cwd: repo.rootDir });
      const started = Date.now();
      expect(await slow.readCommits(shas.slice(0, 2))).toBeNull();
      expect(Date.now() - started).toBeGreaterThanOrEqual(140);
      expect(Date.now() - started).toBeLessThan(3_000);
      expect(await settled(async () => (await stalled.running()) === 0)).toBe(true);
      slow.close();
    } finally {
      await stalled.remove();
    }
  });

  it('a batch opened for one piece of work is closed when the work ends, however it ends', async () => {
    const held: GitObjectBatch[] = [];
    const answer = await withObjectBatch(objects, repo.rootDir, async (opened) => {
      held.push(opened);
      return (await opened.readCommits(shas.slice(0, 1)))?.length;
    });
    expect(answer).toBe(1);
    const failing = withObjectBatch(objects, repo.rootDir, async (opened) => {
      held.push(opened);
      await opened.readCommits(shas.slice(0, 1));
      throw new Error('the work failed');
    });
    await expect(failing).rejects.toThrow('the work failed');
    expect(await Promise.all(held.map((opened) => opened.readCommits(shas.slice(0, 1))))).toEqual([null, null]);
    expect(await settled(async () => (await batchPids(repo.rootDir)).length === 0)).toBe(true);
  });

  it('answers null where git cannot be started', async () => {
    const none = createGitObjectBatches({ gitBinary: path.join(repo.rootDir, 'no-such-git') })({ cwd: repo.rootDir });
    expect(await none.readCommits(shas.slice(0, 2))).toBeNull();
    expect(await none.readCommits(shas.slice(0, 2))).toBeNull();
    none.close();
  });

  it('answers null for what is no answer to a read, and starts over', async () => {
    const babbling = await scriptedGit('#!/bin/sh\nwhile read line; do echo "$line commit many"; done\n');
    try {
      const odd = createGitObjectBatches({ gitBinary: babbling.binary })({ cwd: repo.rootDir });
      expect(await odd.readCommits(shas.slice(0, 2))).toBeNull();
      expect(await settled(async () => (await babbling.running()) === 0)).toBe(true);
      odd.close();
    } finally {
      await babbling.remove();
    }
  });
});

interface ScriptedGit {
  binary: string;
  /** How many of it are running. */
  running(): Promise<number>;
  remove(): Promise<void>;
}

/** A stand-in for git: a script of its own name, so the ones running are counted by it. */
async function scriptedGit(script: string): Promise<ScriptedGit> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-object-batch-git-'));
  const binary = path.join(dir, 'scripted-git');
  await fs.writeFile(binary, script, { mode: 0o755 });
  return {
    binary,
    running: async () => {
      const { execFile } = await import('node:child_process');
      const out = await new Promise<string>((resolve) =>
        execFile('ps', ['-axo', 'command='], (_error, stdout) => resolve(String(stdout))),
      );
      return out.split('\n').filter((line) => line.includes(binary)).length;
    },
    remove: () => fs.rm(dir, { recursive: true, force: true }),
  };
}

/** A git that takes what it is asked and never answers. */
const stalledGit = (): Promise<ScriptedGit> => scriptedGit('#!/bin/sh\nwhile read line; do :; done\n');
