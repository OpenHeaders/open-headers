/**
 * A read whose git never started (`git-stream`): a child that could not
 * be spawned has no pid, and a kill sent to it is sent by the platform
 * to the caller's OWN process group — the host itself. So a read that
 * ends before its git exists — its signal already aborted, its folder
 * gone — must signal nobody.
 *
 * The spawn is wrapped: every kill is recorded with the pid it was sent
 * to, and one aimed at no pid is held back, so a runner that sends one
 * turns this pin red instead of ending the test run.
 */

import type { SpawnOptions } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

const kills = vi.hoisted((): Array<number | undefined> => []);

vi.mock('node:child_process', async (original) => {
  const real = await original<typeof import('node:child_process')>();
  return {
    ...real,
    spawn: (command: string, args: readonly string[], options: SpawnOptions) => {
      const child = real.spawn(command, args, options);
      const kill = child.kill.bind(child);
      child.kill = (signal) => {
        kills.push(child.pid);
        return child.pid === undefined ? false : kill(signal);
      };
      return child;
    },
  };
});

const { createGitStream } = await import('../../src/git/git-stream');

const GONE = '/no/such/folder/oh-git-stream-unstarted';

describe('a read whose git never started', () => {
  it('signals nobody when its signal was aborted before it began', async () => {
    kills.length = 0;
    const result = await createGitStream()(['version'], { cwd: GONE, signal: AbortSignal.abort() }, () => undefined);
    expect(result.aborted).toBe(true);
    expect(kills).not.toContain(undefined);
  });

  it('signals nobody when its signal is aborted, or its time runs out, after git failed to start', async () => {
    kills.length = 0;
    const ending = new AbortController();
    const reading = createGitStream()(['version'], { cwd: GONE, signal: ending.signal, timeoutMs: 5 }, () => undefined);
    ending.abort();
    const result = await reading;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result.aborted).toBe(true);
    expect(kills).not.toContain(undefined);
  });

  it('still ends a git that did start', async () => {
    kills.length = 0;
    const ending = new AbortController();
    const reading = createGitStream()(['version'], { cwd: process.cwd(), signal: ending.signal }, () => undefined);
    ending.abort();
    expect((await reading).aborted).toBe(true);
    expect(kills).toHaveLength(1);
    expect(kills[0]).toEqual(expect.any(Number));
  });
});
