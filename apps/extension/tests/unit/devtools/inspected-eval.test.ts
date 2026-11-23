import { afterEach, describe, expect, it, vi } from 'vitest';
import { evalInInspectedWindow, readEvalAnswer } from '@/devtools/inspected-eval';
import { chrome as chromeMock } from '../../__mocks__/chrome';

describe('readEvalAnswer', () => {
  it('passes the two-argument answer through', () => {
    const result = { pageOrigin: 'https://openheaders.io' };
    expect(readEvalAnswer(result, undefined)).toEqual([result, undefined]);
  });

  it('keeps the exception info of a two-argument failure', () => {
    const info = { isException: true, value: 'boom' };
    expect(readEvalAnswer(undefined, info)).toEqual([null, info]);
  });

  it('unwraps the single-array answer', () => {
    const result = { pageOrigin: 'https://openheaders.io' };
    expect(readEvalAnswer([result, undefined])).toEqual([result, undefined]);
  });

  it('unwraps the single-array failure', () => {
    const info = { isExceptionKey: true, valueKey: 'boom' };
    expect(readEvalAnswer([undefined, info])).toEqual([null, info]);
  });
});

describe('evalInInspectedWindow', () => {
  afterEach(() => {
    vi.stubGlobal('chrome', chromeMock);
  });

  function stubEval(answer: (cb: (...args: unknown[]) => void) => void, lastError?: { message: string }): void {
    vi.stubGlobal('chrome', {
      ...chromeMock,
      runtime: { ...chromeMock.runtime, lastError },
      devtools: { inspectedWindow: { eval: (_expr: string, cb: (...args: unknown[]) => void) => answer(cb) } },
    });
  }

  it('reads a host error and hands the callback a failed sample', () => {
    const hostError = { message: 'Web Inspector could not evaluate script.' };
    stubEval((cb) => cb(), hostError);
    const callback = vi.fn();
    evalInInspectedWindow('1', callback);
    expect(callback).toHaveBeenCalledWith(null, hostError);
  });

  it('hands the callback (result, exceptionInfo) from a two-argument host', () => {
    const result = { loadMs: 12 };
    stubEval((cb) => cb(result, undefined));
    const callback = vi.fn();
    evalInInspectedWindow('1', callback);
    expect(callback).toHaveBeenCalledWith(result, undefined);
  });

  it('hands the callback (result, exceptionInfo) from a single-array host', () => {
    const result = { loadMs: 12 };
    stubEval((cb) => cb([result, undefined]));
    const callback = vi.fn();
    evalInInspectedWindow('1', callback);
    expect(callback).toHaveBeenCalledWith(result, undefined);
  });
});
