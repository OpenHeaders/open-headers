import { app } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GPU_GONE_ESCAPE_THRESHOLD, installProcessDiagnostics } from '@/main/bootstrap/process-diagnostics';

vi.mock('@/main/bootstrap/hardware-acceleration', () => ({ offerHardwareAccelerationEscape: vi.fn() }));

type ChildGoneHandler = (event: unknown, details: { type: string; reason: string; exitCode: number }) => void;
type ProcessHandler = (value: unknown) => void;

/** Capture the `child-process-gone` handler without registering real process listeners in the test runner. */
function install() {
  let childGone: ChildGoneHandler | null = null;
  const processHandlers = new Map<string, ProcessHandler>();
  vi.spyOn(app, 'on').mockImplementation(((event: string, handler: ChildGoneHandler) => {
    if (event === 'child-process-gone') childGone = handler;
    return app;
  }) as typeof app.on);
  vi.spyOn(process, 'on').mockImplementation(((event: string, handler: ProcessHandler) => {
    processHandlers.set(event, handler);
    return process;
  }) as typeof process.on);
  const offer = vi.fn(async () => {});
  const report = vi.fn();
  installProcessDiagnostics({ offerAccelerationEscape: offer, report });
  if (childGone === null) throw new Error('child-process-gone handler not registered');
  return { childGone: childGone as ChildGoneHandler, offer, report, processHandlers };
}

describe('process-diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers the hardware-acceleration escape once the GPU process has died twice', () => {
    const { childGone, offer } = install();
    childGone({}, { type: 'GPU', reason: 'crashed', exitCode: 1 });
    expect(offer).not.toHaveBeenCalled();
    childGone({}, { type: 'GPU', reason: 'crashed', exitCode: 1 });
    expect(offer).toHaveBeenCalledOnce();
    expect(GPU_GONE_ESCAPE_THRESHOLD).toBe(2);
  });

  it('offers it exactly once per session', () => {
    const { childGone, offer } = install();
    for (let i = 0; i < 5; i += 1) childGone({}, { type: 'GPU', reason: 'killed', exitCode: 9 });
    expect(offer).toHaveBeenCalledOnce();
  });

  it('reports the GPU and utility processes gone with their reason and exit code; other types log only', () => {
    const { childGone, report } = install();
    childGone({}, { type: 'GPU', reason: 'crashed', exitCode: 5 });
    childGone({}, { type: 'Utility', reason: 'killed', exitCode: 9 });
    childGone({}, { type: 'Zygote', reason: 'crashed', exitCode: 1 });
    expect(report.mock.calls.map((call) => call[0])).toEqual([
      { kind: 'child-process-gone', process: 'gpu', reason: 'crashed', exitCode: 5 },
      { kind: 'child-process-gone', process: 'utility', reason: 'killed', exitCode: 9 },
    ]);
  });

  it("reports main's own uncaught exceptions and unhandled rejections, described", () => {
    const { processHandlers, report } = install();
    const thrown = new TypeError('x is not a function');
    processHandlers.get('uncaughtException')?.(thrown);
    processHandlers.get('unhandledRejection')?.('a string reason');
    expect(report.mock.calls.map((call) => call[0])).toEqual([
      {
        kind: 'uncaught-exception',
        process: 'main',
        error: { name: 'TypeError', message: 'x is not a function', stack: thrown.stack ?? null },
      },
      {
        kind: 'unhandled-rejection',
        process: 'main',
        error: { name: 'Error', message: 'a string reason', stack: null },
      },
    ]);
  });

  it('other child processes never count toward the escape', () => {
    const { childGone, offer } = install();
    childGone({}, { type: 'Utility', reason: 'crashed', exitCode: 1 });
    childGone({}, { type: 'Zygote', reason: 'crashed', exitCode: 1 });
    childGone({}, { type: 'Utility', reason: 'crashed', exitCode: 1 });
    expect(offer).not.toHaveBeenCalled();
  });
});
