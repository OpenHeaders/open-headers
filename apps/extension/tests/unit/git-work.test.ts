/**
 * `useGitWork` — a git verb at the host, said while it is out: the call
 * is named in the processes slot and counted from the press until the
 * host answers, a refusal that throws included; two calls out at once
 * are two entries, and the surface is at work until the last is back.
 */

import { __resetBackgroundTasksForTests, useBackgroundTasks } from '@openheaders/ui/shared/background-tasks';
import { useGitWork } from '@openheaders/ui/workbench/components/panels/git/use-git-work';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

interface Held<R> {
  call: () => Promise<R>;
  answer: (value: R) => void;
  fail: (error: Error) => void;
}

function held<R>(): Held<R> {
  let answer: (value: R) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const promise = new Promise<R>((resolve, reject) => {
    answer = resolve;
    fail = reject;
  });
  return { call: () => promise, answer, fail };
}

const titles = (tasks: ReturnType<typeof useBackgroundTasks>): string[] => tasks.map((task) => task.title);

describe('useGitWork', () => {
  beforeEach(() => {
    __resetBackgroundTasksForTests();
  });

  it('names the call and counts it until the host answers', async () => {
    const work = renderHook(() => useGitWork());
    const tasks = renderHook(() => useBackgroundTasks());
    expect(work.result.current.working).toBe(false);

    const pick = held<string>();
    let answered: Promise<string> = Promise.resolve('');
    act(() => {
      answered = work.result.current.atHost('Cherry-picking 1a2b3c4…', pick.call);
    });
    expect(work.result.current.working).toBe(true);
    expect(titles(tasks.result.current)).toEqual(['Cherry-picking 1a2b3c4…']);
    expect(tasks.result.current[0].percent).toBeNull();

    await act(async () => {
      pick.answer('done');
      await answered;
    });
    expect(await answered).toBe('done');
    expect(work.result.current.working).toBe(false);
    expect(tasks.result.current).toEqual([]);
  });

  it('takes the entry back when the call throws, and hands the error on', async () => {
    const work = renderHook(() => useGitWork());
    const tasks = renderHook(() => useBackgroundTasks());
    const patch = held<string>();
    let answered: Promise<string> = Promise.resolve('');
    act(() => {
      answered = work.result.current.atHost('Creating patch…', patch.call);
    });
    expect(work.result.current.working).toBe(true);

    await act(async () => {
      patch.fail(new Error('host gone'));
      await answered.catch(() => undefined);
    });
    await expect(answered).rejects.toThrow('host gone');
    expect(work.result.current.working).toBe(false);
    expect(tasks.result.current).toEqual([]);
  });

  it('keeps two calls apart and stays at work until the last is back', async () => {
    const work = renderHook(() => useGitWork());
    const tasks = renderHook(() => useBackgroundTasks());
    const fetch = held<number>();
    const push = held<number>();
    let fetched: Promise<number> = Promise.resolve(0);
    let pushed: Promise<number> = Promise.resolve(0);
    act(() => {
      fetched = work.result.current.atHost('Fetching…', fetch.call);
      pushed = work.result.current.atHost('Pushing…', push.call);
    });
    expect(titles(tasks.result.current)).toEqual(['Fetching…', 'Pushing…']);

    await act(async () => {
      fetch.answer(1);
      await fetched;
    });
    expect(work.result.current.working).toBe(true);
    expect(titles(tasks.result.current)).toEqual(['Pushing…']);

    await act(async () => {
      push.answer(2);
      await pushed;
    });
    expect(work.result.current.working).toBe(false);
    expect(tasks.result.current).toEqual([]);
  });
});
