/**
 * The reading runner (`git-stream`): a git read handed over as it
 * arrives — whole and in order across chunks, held while a reader that
 * answers later is busy, ended by the caller's signal or the timeout,
 * and structured in failure (a missing binary, a refusing git) where a
 * reader's own fault is the caller's to hear. Real git in a scratch
 * repo whose log is longer than one chunk.
 */

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGitExec } from '../../src/git/git-exec';
import { createGitStream, type GitStreamRunner } from '../../src/git/git-stream';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const ISOLATED = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const COMMITS = 600;
const SUBJECT_PAD = 'a subject long enough that the whole log cannot arrive in one chunk '.repeat(4).trim();

let rootDir: string;
let logArgs: string[];
let whole: string;
const stream: GitStreamRunner = createGitStream();

beforeAll(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-git-stream-'));
  const run = createGitExec();
  await ensureWorkspaceRepo(run, rootDir);
  const branch = (
    await run([...repoArgs(rootDir), 'symbolic-ref', 'HEAD'], { cwd: rootDir, env: ISOLATED })
  ).stdout.trim();
  let script = '';
  for (let index = 1; index <= COMMITS; index += 1) {
    const message = `commit ${index} ${SUBJECT_PAD}\n`;
    script +=
      `commit ${branch}\nmark :${index}\n` +
      `author John Doe <john.doe@openheaders.io> ${1_700_000_000 + index * 60} +0000\n` +
      `committer John Doe <john.doe@openheaders.io> ${1_700_000_000 + index * 60} +0000\n` +
      `data ${Buffer.byteLength(message)}\n${message}\n` +
      (index > 1 ? `from :${index - 1}\n` : '') +
      '\n';
  }
  execFileSync('git', [...repoArgs(rootDir), 'fast-import', '--quiet'], {
    input: script,
    env: { ...process.env, ...ISOLATED },
  });
  logArgs = [...repoArgs(rootDir), 'log', '--format=%H %s'];
  whole = (await run(logArgs, { cwd: rootDir, env: ISOLATED })).stdout;
});

afterAll(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('the reading runner', () => {
  it('hands the whole output over, in order, across more than one chunk', async () => {
    const chunks: string[] = [];
    const result = await stream(logArgs, { cwd: rootDir, env: ISOLATED }, (chunk) => {
      chunks.push(chunk);
    });
    expect(result).toEqual({ code: 0, stderr: '', spawnFailed: false, timedOut: false, aborted: false });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(whole);
    expect(whole.split('\n').filter((line) => line.length > 0)).toHaveLength(COMMITS);
  });

  it('holds the stream while a reader that answers later is busy — one chunk at a time, none lost', async () => {
    const chunks: string[] = [];
    let busy = 0;
    let overlapped = false;
    const result = await stream(logArgs, { cwd: rootDir, env: ISOLATED }, async (chunk) => {
      busy += 1;
      if (busy > 1) overlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 5));
      chunks.push(chunk);
      busy -= 1;
    });
    expect(result.code).toBe(0);
    expect(overlapped).toBe(false);
    expect(chunks.join('')).toBe(whole);
  });

  it('ends the read on the caller’s signal — git is stopped and the rest never arrives', async () => {
    const page = new AbortController();
    let read = '';
    const result = await stream(logArgs, { cwd: rootDir, env: ISOLATED, signal: page.signal }, async (chunk) => {
      read += chunk;
      page.abort();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.aborted).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(read.length).toBeGreaterThan(0);
    expect(read.length).toBeLessThan(whole.length);
    expect(whole.startsWith(read)).toBe(true);
  });

  it('reads nothing under a signal that was aborted before it began', async () => {
    let called = false;
    const result = await stream(logArgs, { cwd: rootDir, env: ISOLATED, signal: AbortSignal.abort() }, () => {
      called = true;
    });
    expect(result.aborted).toBe(true);
    expect(called).toBe(false);
  });

  it('ends the read at its timeout and says so', async () => {
    let chunks = 0;
    // The reader still holds the first chunk when the timeout comes.
    const result = await stream(logArgs, { cwd: rootDir, env: ISOLATED, timeoutMs: 300 }, async () => {
      chunks += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(result.timedOut).toBe(true);
    expect(result.aborted).toBe(false);
    expect(chunks).toBe(1);
  });

  it('answers a git that refuses with its exit code and its reason', async () => {
    const result = await stream(
      [...repoArgs(rootDir), 'log', '--format=%H', 'refs/heads/no-such-branch'],
      { cwd: rootDir, env: ISOLATED },
      () => undefined,
    );
    expect(result.code).not.toBe(0);
    expect(result.spawnFailed).toBe(false);
    expect(result.stderr).toContain('no-such-branch');
  });

  it('answers a binary that is not there as a spawn failure, never a throw', async () => {
    const missing = createGitStream({ gitBinary: '/nonexistent/openheaders-git' });
    const result = await missing(logArgs, { cwd: rootDir, env: ISOLATED }, () => undefined);
    expect(result).toMatchObject({ code: -1, spawnFailed: true, timedOut: false, aborted: false });
  });

  it('hands a reader’s own fault to the caller — thrown or rejected — and stops git', async () => {
    await expect(
      stream(logArgs, { cwd: rootDir, env: ISOLATED }, () => {
        throw new Error('reader threw');
      }),
    ).rejects.toThrow('reader threw');
    await expect(
      stream(logArgs, { cwd: rootDir, env: ISOLATED }, async () => {
        throw new Error('reader rejected');
      }),
    ).rejects.toThrow('reader rejected');
  });
});
