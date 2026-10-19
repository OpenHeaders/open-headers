import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sentinel from '@/main/bootstrap/session-sentinel';

const registerTeardown = vi.fn<(name: string, deadlineMs: number, run: () => void | Promise<void>) => void>();

vi.mock('@/main/bootstrap/lifecycle', () => ({
  registerTeardown: (name: string, deadlineMs: number, run: () => void | Promise<void>) =>
    registerTeardown(name, deadlineMs, run),
}));

const recordErrorReport = vi.fn();

vi.mock('@/main/bootstrap/error-report-sink', () => ({
  recordErrorReport: (input: unknown) => recordErrorReport(input),
}));

const LOCK = 'session.lock';

describe('session-sentinel', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'oh-sentinel-'));
    vi.spyOn(app, 'getPath').mockReturnValue(userDataDir);
    registerTeardown.mockReset();
    recordErrorReport.mockReset();
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('a clean profile reads as a clean previous session and writes the lock', async () => {
    sentinel.installSessionSentinel();
    expect(sentinel.wasPreviousSessionDirty()).toBe(false);
    expect(existsSync(join(userDataDir, 'state', LOCK))).toBe(true);
  });

  it('the teardown participant removes the lock', async () => {
    sentinel.installSessionSentinel();
    expect(registerTeardown).toHaveBeenCalledOnce();
    const [name, , run] = registerTeardown.mock.calls[0];
    expect(name).toBe('session-sentinel');
    await run();
    expect(existsSync(join(userDataDir, 'state', LOCK))).toBe(false);
  });

  it('a lock left behind reads as a dirty previous session', async () => {
    mkdirSync(join(userDataDir, 'state'), { recursive: true });
    writeFileSync(join(userDataDir, 'state', LOCK), '12345');
    sentinel.installSessionSentinel();
    expect(sentinel.wasPreviousSessionDirty()).toBe(true);
    // The new run owns the lock again.
    expect(existsSync(join(userDataDir, 'state', LOCK))).toBe(true);
    // The one report a dirty exit earns: no stack, no error, just the fact.
    expect(recordErrorReport).toHaveBeenCalledOnce();
    expect(recordErrorReport).toHaveBeenCalledWith({ kind: 'abnormal-exit', process: 'main' });
  });

  it('a clean previous session reports nothing', () => {
    sentinel.installSessionSentinel();
    expect(recordErrorReport).not.toHaveBeenCalled();
  });
});
