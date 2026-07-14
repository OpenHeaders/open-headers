/**
 * Host script capability seam — the mode-keyed registry the desktop
 * shell installs its runtimes into (Safe sandboxed renderer, Developer
 * utilityProcess worker), and `resolveScriptRunner`, the gate every
 * node dispatch consults. Pins: no capability = null (the headless
 * daemon's scriptless posture), the host-context threading, the
 * never-throw runner contract, the host-local mode-slot read with its
 * safe defaults — and the mode branch itself: a developer slot rides
 * the Developer runtime only for a LOCAL INTERACTIVE dispatch, chain
 * and forwarded dispatches stay Safe without consulting the slot, and
 * a developer slot with no Developer runtime falls back to Safe.
 */

import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  storageGet: vi.fn(async (): Promise<Record<string, string> | undefined> => undefined),
}));

vi.mock('@openheaders/oracle/storage', () => ({
  hostStorage: { get: () => h.storageGet() },
  OH: { scriptExecutionModes: { key: 'oh.scriptExecutionModes', area: 'local' } },
}));

import {
  getHostScriptCapability,
  type HostScriptRunOptions,
  readScriptExecutionModeSlot,
  resolveScriptRunner,
  setHostScriptCapabilities,
} from '../../../src/daemon/script-capability';

function okResult(executionId = 'e1'): ScriptExecutionResult {
  return { executionId, succeeded: true, assertions: [], consoleLog: [], durationMs: 1 };
}

const input = {
  kind: 'pre-request' as const,
  source: 'oh.setHeader("X", "1");',
  request: {
    method: 'GET' as const,
    url: 'https://api.openheaders.io/x',
    headers: [],
    params: [],
    body: { type: 'none' as const },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.storageGet.mockResolvedValue(undefined);
});

afterEach(() => {
  setHostScriptCapabilities(null);
});

describe('capability registry', () => {
  it('starts empty and resolveScriptRunner returns null — the daemon posture', async () => {
    expect(getHostScriptCapability()).toBeNull();
    expect(getHostScriptCapability('developer')).toBeNull();
    expect(await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' })).toBeNull();
  });

  it('set/clear round-trips per mode', () => {
    const safe = { mode: 'safe' as const, runScript: vi.fn() };
    const developer = { mode: 'developer' as const, runScript: vi.fn() };
    setHostScriptCapabilities({ safe, developer });
    expect(getHostScriptCapability()).toBe(safe);
    expect(getHostScriptCapability('developer')).toBe(developer);
    setHostScriptCapabilities(null);
    expect(getHostScriptCapability()).toBeNull();
    expect(getHostScriptCapability('developer')).toBeNull();
  });

  it('rejects a Developer runtime without a Safe fallback', () => {
    const developer = { mode: 'developer' as const, runScript: vi.fn() };
    expect(() => setHostScriptCapabilities({ developer })).toThrow(/Safe runtime/);
  });
});

describe('resolveScriptRunner', () => {
  it('threads the dispatch host-context into every runScript call', async () => {
    const runScript = vi.fn(async (_opts: HostScriptRunOptions) => okResult());
    setHostScriptCapabilities({ safe: { mode: 'safe', runScript } });
    const chain = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'chain' });
    await chain?.runner(input);
    expect(runScript).toHaveBeenCalledWith(expect.objectContaining({ hostContext: 'chain', kind: 'pre-request' }));

    const interactive = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' });
    await interactive?.runner(input);
    expect(runScript).toHaveBeenLastCalledWith(expect.objectContaining({ hostContext: 'interactive' }));
  });

  it('reports the capability mode for snapshot attribution', async () => {
    setHostScriptCapabilities({ safe: { mode: 'safe', runScript: async () => okResult() } });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' });
    expect(resolved?.mode).toBe('safe');
  });

  it('never throws — a broker fault folds into a failed script result', async () => {
    setHostScriptCapabilities({
      safe: {
        mode: 'safe',
        runScript: async () => {
          throw new Error('sandbox spawn failed');
        },
      },
    });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'chain' });
    const result = await resolved?.runner(input);
    expect(result?.succeeded).toBe(false);
    expect(result?.error?.message).toBe('sandbox spawn failed');
    expect(result?.error?.name).toBe('ScriptRuntimeError');
  });

  it('consults the host-local mode slot for a local interactive dispatch', async () => {
    setHostScriptCapabilities({ safe: { mode: 'safe', runScript: async () => okResult() } });
    await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' });
    expect(h.storageGet).toHaveBeenCalled();
  });

  it('a peer-forwarded send never consults the slot — Safe unconditionally', async () => {
    const safeRun = vi.fn(async () => okResult());
    const devRun = vi.fn(async () => okResult());
    setHostScriptCapabilities({
      safe: { mode: 'safe', runScript: safeRun },
      developer: { mode: 'developer', runScript: devRun },
    });
    h.storageGet.mockResolvedValue({ ws1: 'developer' });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive', forwarded: true });
    expect(resolved?.mode).toBe('safe');
    expect(h.storageGet).not.toHaveBeenCalled();
    await resolved?.runner(input);
    expect(safeRun).toHaveBeenCalled();
    expect(devRun).not.toHaveBeenCalled();
  });

  it('a chain dispatch stays Safe regardless of the slot — and never reads it', async () => {
    const safeRun = vi.fn(async () => okResult());
    const devRun = vi.fn(async () => okResult());
    setHostScriptCapabilities({
      safe: { mode: 'safe', runScript: safeRun },
      developer: { mode: 'developer', runScript: devRun },
    });
    h.storageGet.mockResolvedValue({ ws1: 'developer' });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'chain' });
    expect(resolved?.mode).toBe('safe');
    expect(h.storageGet).not.toHaveBeenCalled();
    await resolved?.runner(input);
    expect(safeRun).toHaveBeenCalled();
    expect(devRun).not.toHaveBeenCalled();
  });

  it('a developer slot rides the Developer runtime for a local interactive dispatch', async () => {
    const safeRun = vi.fn(async () => okResult());
    const devRun = vi.fn(async () => okResult());
    setHostScriptCapabilities({
      safe: { mode: 'safe', runScript: safeRun },
      developer: { mode: 'developer', runScript: devRun },
    });
    h.storageGet.mockResolvedValue({ ws1: 'developer' });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' });
    expect(resolved?.mode).toBe('developer');
    await resolved?.runner(input);
    expect(devRun).toHaveBeenCalledWith(expect.objectContaining({ hostContext: 'interactive' }));
    expect(safeRun).not.toHaveBeenCalled();
  });

  it('a developer slot for ANOTHER workspace stays Safe', async () => {
    setHostScriptCapabilities({
      safe: { mode: 'safe', runScript: async () => okResult() },
      developer: { mode: 'developer', runScript: async () => okResult() },
    });
    h.storageGet.mockResolvedValue({ other: 'developer' });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' });
    expect(resolved?.mode).toBe('safe');
  });

  it('a developer slot with no Developer runtime falls back to Safe — recorded honestly', async () => {
    setHostScriptCapabilities({ safe: { mode: 'safe', runScript: async () => okResult() } });
    h.storageGet.mockResolvedValue({ ws1: 'developer' });
    const resolved = await resolveScriptRunner({ workspaceId: 'ws1', hostContext: 'interactive' });
    expect(resolved?.mode).toBe('safe');
  });
});

describe('readScriptExecutionModeSlot', () => {
  it('absent slot / entry reads as safe', async () => {
    expect(await readScriptExecutionModeSlot('ws1')).toBe('safe');
    h.storageGet.mockResolvedValue({ other: 'developer' });
    expect(await readScriptExecutionModeSlot('ws1')).toBe('safe');
  });

  it('a developer entry reads as developer', async () => {
    h.storageGet.mockResolvedValue({ ws1: 'developer' });
    expect(await readScriptExecutionModeSlot('ws1')).toBe('developer');
  });

  it('an unrecognized value and a storage fault both read as safe', async () => {
    h.storageGet.mockResolvedValue({ ws1: 'yolo' });
    expect(await readScriptExecutionModeSlot('ws1')).toBe('safe');
    h.storageGet.mockRejectedValue(new Error('no backend'));
    expect(await readScriptExecutionModeSlot('ws1')).toBe('safe');
  });
});
