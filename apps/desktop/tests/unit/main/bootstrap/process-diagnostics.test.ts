import { app } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GPU_GONE_ESCAPE_THRESHOLD, installProcessDiagnostics } from '@/main/bootstrap/process-diagnostics';

vi.mock('@/main/bootstrap/hardware-acceleration', () => ({ offerHardwareAccelerationEscape: vi.fn() }));

type ChildGoneHandler = (event: unknown, details: { type: string; reason: string; exitCode: number }) => void;

/** Capture the `child-process-gone` handler without registering real process listeners in the test runner. */
function install() {
  let childGone: ChildGoneHandler | null = null;
  vi.spyOn(app, 'on').mockImplementation(((event: string, handler: ChildGoneHandler) => {
    if (event === 'child-process-gone') childGone = handler;
    return app;
  }) as typeof app.on);
  vi.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on);
  const offer = vi.fn(async () => {});
  installProcessDiagnostics({ offerAccelerationEscape: offer });
  if (childGone === null) throw new Error('child-process-gone handler not registered');
  return { childGone: childGone as ChildGoneHandler, offer };
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

  it('other child processes never count toward the escape', () => {
    const { childGone, offer } = install();
    childGone({}, { type: 'Utility', reason: 'crashed', exitCode: 1 });
    childGone({}, { type: 'Zygote', reason: 'crashed', exitCode: 1 });
    childGone({}, { type: 'Utility', reason: 'crashed', exitCode: 1 });
    expect(offer).not.toHaveBeenCalled();
  });
});
