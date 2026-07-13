/**
 * `createConsoleEval` — the console REPL evaluator (JS contexts Phase D).
 *
 * Coverage:
 *   - echo semantics: the `command` entry records before dispatch, the
 *     `result` entry after, both tagged with the target contextKey;
 *   - routing by session key: tab root (`page`), kept child session, and
 *     browser-scoped target (`target:<id>` → the target sender);
 *   - the locked `Runtime.evaluate` parameter set;
 *   - outcome rendering: clean value, thrown exception (error level),
 *     transport rejection, the 5s timeout, and a malformed context key —
 *     all become entries, never throws.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConsoleEval } from '@/background/correlator-host/console-eval';

const TAB = 5;

function makeRig(
  overrides: { sessionResult?: unknown; sessionError?: Error; targetResult?: unknown; hang?: boolean } = {},
) {
  const entries: Array<{ tabId: number; entry: ConsoleEntry }> = [];
  const sendOnSession = vi.fn((_tabId: number, _sessionId: string, _method: string) => {
    if (overrides.hang) return new Promise<unknown>(() => {});
    if (overrides.sessionError) return Promise.reject(overrides.sessionError);
    return Promise.resolve(overrides.sessionResult ?? { result: { type: 'undefined' } });
  });
  const sendOnTarget = vi.fn((_targetId: string, _method: string) =>
    Promise.resolve(overrides.targetResult ?? { result: { type: 'undefined' } }),
  );
  const executor = createConsoleEval({
    sendOnSession,
    sendOnTarget,
    recordEntry: (tabId, entry) => entries.push({ tabId, entry }),
    now: () => 1_700_000_000_000,
  });
  return { executor, entries, sendOnSession, sendOnTarget };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createConsoleEval', () => {
  it('records the command echo, evaluates on the root session, and records the value', async () => {
    const rig = makeRig({ sessionResult: { result: { type: 'number', value: 42, description: '42' } } });
    await rig.executor.evaluate(TAB, 'page::3', '41 + 1', true);

    expect(rig.sendOnSession).toHaveBeenCalledWith(TAB, 'page', 'Runtime.evaluate', {
      expression: '41 + 1',
      contextId: 3,
      replMode: true,
      includeCommandLineAPI: true,
      generatePreview: true,
      awaitPromise: true,
      userGesture: true,
      objectGroup: 'oh-console',
    });
    expect(rig.entries).toEqual([
      {
        tabId: TAB,
        entry: {
          source: 'command',
          level: 'log',
          args: [{ type: 'string', text: '41 + 1' }],
          timestamp: 1_700_000_000_000,
          contextKey: 'page::3',
        },
      },
      {
        tabId: TAB,
        entry: {
          source: 'result',
          level: 'log',
          args: [{ type: 'number', text: '42' }],
          timestamp: 1_700_000_000_000,
          contextKey: 'page::3',
        },
      },
    ]);
  });

  it('carries the "treat evaluation as user action" flag through to Runtime.evaluate', async () => {
    const rig = makeRig();
    await rig.executor.evaluate(TAB, 'page::3', '1', false);
    expect(rig.sendOnSession).toHaveBeenCalledWith(
      TAB,
      'page',
      'Runtime.evaluate',
      expect.objectContaining({ userGesture: false }),
    );
  });

  it('routes a kept-child context to its session and a target context to the target sender', async () => {
    const rig = makeRig();
    await rig.executor.evaluate(TAB, 'child-iframe-1::2', 'x', true);
    expect(rig.sendOnSession).toHaveBeenCalledWith(
      TAB,
      'child-iframe-1',
      'Runtime.evaluate',
      expect.objectContaining({ contextId: 2 }),
    );

    await rig.executor.evaluate(TAB, 'target:SW1::1', 'y', true);
    expect(rig.sendOnTarget).toHaveBeenCalledWith('SW1', 'Runtime.evaluate', expect.objectContaining({ contextId: 1 }));
    expect(rig.sendOnSession).toHaveBeenCalledTimes(1);
  });

  it('renders a thrown exception as an error-level result entry', async () => {
    const rig = makeRig({
      sessionResult: {
        result: { type: 'object', subtype: 'error' },
        exceptionDetails: {
          text: 'Uncaught',
          lineNumber: 0,
          columnNumber: 0,
          exception: { type: 'object', subtype: 'error', description: 'ReferenceError: nope is not defined' },
        },
      },
    });
    await rig.executor.evaluate(TAB, 'page::1', 'nope', true);
    const result = rig.entries[1].entry;
    expect(result.source).toBe('result');
    expect(result.level).toBe('error');
    expect(result.args[0].text).toBe('ReferenceError: nope is not defined');
  });

  it('turns a transport rejection into an error result entry, never throwing', async () => {
    const rig = makeRig({ sessionError: new Error('Detached while handling command') });
    await rig.executor.evaluate(TAB, 'page::1', '1', true);
    const result = rig.entries[1].entry;
    expect(result.level).toBe('error');
    expect(result.args[0].text).toBe('Evaluation failed: Detached while handling command');
  });

  it('enforces the 5s ceiling on a hung evaluation', async () => {
    vi.useFakeTimers();
    const rig = makeRig({ hang: true });
    const done = rig.executor.evaluate(TAB, 'page::1', 'while(true){}', true);
    await vi.advanceTimersByTimeAsync(5_100);
    await done;
    expect(rig.entries[1].entry.args[0].text).toBe('Evaluation failed: evaluation timed out');
  });

  it('rejects a malformed context key without dispatching', async () => {
    const rig = makeRig();
    await rig.executor.evaluate(TAB, 'garbage', '1', true);
    await rig.executor.evaluate(TAB, 'page::NaN', '1', true);
    expect(rig.sendOnSession).not.toHaveBeenCalled();
    expect(rig.entries.filter((e) => e.entry.source === 'result').map((e) => e.entry.args[0].text)).toEqual([
      'Evaluation failed: unknown context',
      'Evaluation failed: unknown context',
    ]);
  });
});

describe('createConsoleEval — eager-evaluation preview', () => {
  it('evaluates silently with the side-effect guard and short timeout, recording NOTHING', async () => {
    const rig = makeRig({ sessionResult: { result: { type: 'number', value: 2, description: '2' } } });
    const text = await rig.executor.evaluatePreview(TAB, 'page::3', '1 + 1');

    expect(text).toBe('2');
    expect(rig.sendOnSession).toHaveBeenCalledWith(TAB, 'page', 'Runtime.evaluate', {
      expression: '1 + 1',
      contextId: 3,
      replMode: true,
      includeCommandLineAPI: true,
      generatePreview: true,
      throwOnSideEffect: true,
      silent: true,
      disableBreaks: true,
      timeout: 500,
      objectGroup: 'oh-console',
    });
    expect(rig.entries).toHaveLength(0);
  });

  it('routes a target context through the target sender', async () => {
    const rig = makeRig({ targetResult: { result: { type: 'string', value: 'sw' } } });
    const text = await rig.executor.evaluatePreview(TAB, 'target:SW1::1', 'self.name');
    expect(text).toBe('sw');
    expect(rig.sendOnTarget).toHaveBeenCalledWith('SW1', 'Runtime.evaluate', expect.objectContaining({ contextId: 1 }));
  });

  it("the engine's side-effect refusal previews as nothing", async () => {
    const rig = makeRig({
      sessionResult: {
        exceptionDetails: {
          text: 'Uncaught',
          lineNumber: 0,
          columnNumber: 0,
          exception: {
            type: 'object',
            subtype: 'error',
            description: 'EvalError: Possible side-effect in debug-evaluate',
          },
        },
      },
    });
    expect(await rig.executor.evaluatePreview(TAB, 'page::1', 'location.reload()')).toBeNull();
    expect(rig.entries).toHaveLength(0);
  });

  it('a TypeError surfaces (first line), other throws stay quiet — browser parity', async () => {
    const typeError = makeRig({
      sessionResult: {
        exceptionDetails: {
          text: 'Uncaught',
          lineNumber: 0,
          columnNumber: 0,
          exception: {
            type: 'object',
            subtype: 'error',
            description: 'TypeError: undefined is not a function\n    at <anonymous>:1:1',
          },
        },
      },
    });
    expect(await typeError.executor.evaluatePreview(TAB, 'page::1', 'x()')).toBe(
      'Uncaught TypeError: undefined is not a function',
    );

    const referenceError = makeRig({
      sessionResult: {
        exceptionDetails: {
          text: 'Uncaught',
          lineNumber: 0,
          columnNumber: 0,
          exception: { type: 'object', subtype: 'error', description: 'ReferenceError: nope is not defined' },
        },
      },
    });
    expect(await referenceError.executor.evaluatePreview(TAB, 'page::1', 'nope')).toBeNull();
  });

  it('transport refusal, timeout, and a malformed key all preview as nothing, never throwing', async () => {
    const refused = makeRig({ sessionError: new Error('Detached while handling command') });
    expect(await refused.executor.evaluatePreview(TAB, 'page::1', '1')).toBeNull();
    expect(refused.entries).toHaveLength(0);

    vi.useFakeTimers();
    const hung = makeRig({ hang: true });
    const pending = hung.executor.evaluatePreview(TAB, 'page::1', '1');
    await vi.advanceTimersByTimeAsync(5_100);
    expect(await pending).toBeNull();
    vi.useRealTimers();

    const malformed = makeRig();
    expect(await malformed.executor.evaluatePreview(TAB, 'garbage', '1')).toBeNull();
    expect(malformed.sendOnSession).not.toHaveBeenCalled();
  });
});
