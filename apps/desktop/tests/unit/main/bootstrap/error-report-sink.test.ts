/**
 * The main process's error-report sink (the error reports plan §3.3):
 * ring-0 observations buffer until the channel installs its sink and
 * drain into it in order; a throwing sink never turns one failure into
 * two; `describeThrown` reads any thrown value like the UI funnel does.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetErrorReportSinkForTests,
  describeThrown,
  ERROR_REPORT_PENDING_CAP,
  recordErrorReport,
  setErrorReportSink,
} from '@/main/bootstrap/error-report-sink';

afterEach(() => {
  __resetErrorReportSinkForTests();
});

describe('error-report-sink', () => {
  it('buffers observations recorded before the sink exists and drains them in order on install', () => {
    recordErrorReport({ kind: 'abnormal-exit', process: 'main' });
    recordErrorReport({ kind: 'renderer-gone', process: 'renderer', reason: 'crashed', exitCode: 1, reopenCount: 0 });
    const sink = vi.fn();
    setErrorReportSink(sink);
    expect(sink.mock.calls.map((call) => call[0].kind)).toEqual(['abnormal-exit', 'renderer-gone']);
    recordErrorReport({ kind: 'unresponsive', process: 'renderer', reopenCount: 0 });
    expect(sink).toHaveBeenCalledTimes(3);
  });

  it('the buffer is bounded — a boot never holds more than a handful', () => {
    for (let i = 0; i < ERROR_REPORT_PENDING_CAP + 5; i += 1) {
      recordErrorReport({ kind: 'abnormal-exit', process: 'main' });
    }
    const sink = vi.fn();
    setErrorReportSink(sink);
    expect(sink).toHaveBeenCalledTimes(ERROR_REPORT_PENDING_CAP);
  });

  it('a throwing sink is contained, and removing the sink buffers again', () => {
    setErrorReportSink(() => {
      throw new Error('sink broke');
    });
    expect(() => recordErrorReport({ kind: 'abnormal-exit', process: 'main' })).not.toThrow();
    setErrorReportSink(null);
    recordErrorReport({ kind: 'abnormal-exit', process: 'main' });
    const sink = vi.fn();
    setErrorReportSink(sink);
    expect(sink).toHaveBeenCalledOnce();
  });

  it('describes Errors, error-shaped objects and primitives', () => {
    const error = new RangeError('too far');
    expect(describeThrown(error)).toEqual({ name: 'RangeError', message: 'too far', stack: error.stack ?? null });
    expect(describeThrown({ name: 'Custom', message: 'm' })).toEqual({ name: 'Custom', message: 'm', stack: null });
    expect(describeThrown('plain')).toEqual({ name: 'Error', message: 'plain', stack: null });
    expect(describeThrown(undefined)).toEqual({ name: 'Error', message: 'undefined', stack: null });
  });
});
