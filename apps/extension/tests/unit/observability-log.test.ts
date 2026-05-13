import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '@/shared/observability/types';

// Hoisted to run before the vi.mock factories (which are themselves
// hoisted above imports). Typing the mocks explicitly as `unknown`-
// resolving so mockResolvedValueOnce accepts arbitrary payloads.
const { mockGet, mockSet, mockBroadcast } = vi.hoisted(() => ({
  mockGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockSet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockBroadcast: vi.fn(),
}));

vi.mock('@utils/bridge', () => ({
  broadcast: mockBroadcast,
}));

vi.mock('@openheaders/oracle/storage', async () => {
  const real = await vi.importActual<typeof import('@openheaders/oracle/storage')>('@openheaders/oracle/storage');
  return {
    ...real,
    extensionStorage: {
      get: mockGet,
      set: mockSet,
      getMany: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
    },
  };
});

import {
  __resetForTests,
  clearObservabilityLog,
  getObservabilityLog,
  hydrateObservabilityLog,
  recordLog,
} from '@/background/modules/observability-log';

beforeEach(() => {
  __resetForTests();
  mockGet.mockReset().mockResolvedValue(undefined);
  mockSet.mockReset().mockResolvedValue(undefined);
  mockBroadcast.mockReset();
});

describe('observability-log', () => {
  it('records an entry with injected timestamp + extensionVersion', async () => {
    const before = Date.now();
    recordLog({
      subsystem: 'rule-engine',
      op: 'test',
      level: 'info',
      message: 'hello',
      context: {},
    });
    const entries = getObservabilityLog();
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(entries[0].context.extensionVersion).toBe('4.0.0');
  });

  it('preserves caller-supplied extensionVersion when present', () => {
    recordLog({
      subsystem: 'workspace',
      op: 'switch',
      level: 'info',
      message: 'm',
      context: { extensionVersion: 'override' },
    });
    expect(getObservabilityLog()[0].context.extensionVersion).toBe('override');
  });

  it('broadcasts observabilityLogUpdated on record', () => {
    recordLog({
      subsystem: 'extension',
      op: 't',
      level: 'info',
      message: 'm',
      context: {},
    });
    expect(mockBroadcast).toHaveBeenCalledWith('observabilityLogUpdated', { size: 1 });
  });

  it('hydrates the ring from a persisted snapshot on first call only', async () => {
    const snap: LogEntry[] = [
      { timestamp: 1, subsystem: 'workspace', op: 'init', level: 'info', message: 'past', context: {} },
    ];
    mockGet.mockResolvedValueOnce(snap);
    await hydrateObservabilityLog();
    expect(getObservabilityLog()).toHaveLength(1);
    expect(getObservabilityLog()[0].message).toBe('past');

    // Second hydrate call is a no-op — even if the storage returns
    // something different, the ring stays as-is.
    mockGet.mockResolvedValueOnce([
      { timestamp: 2, subsystem: 'workspace', op: 'x', level: 'info', message: 'new', context: {} },
    ]);
    await hydrateObservabilityLog();
    expect(getObservabilityLog()).toHaveLength(1);
    expect(getObservabilityLog()[0].message).toBe('past');
  });

  it('survives a failing storage read on hydrate', async () => {
    mockGet.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(hydrateObservabilityLog()).resolves.toBeUndefined();
    expect(getObservabilityLog()).toHaveLength(0);
  });

  it('clearObservabilityLog empties the ring and broadcasts', () => {
    recordLog({ subsystem: 'rule-engine', op: 't', level: 'info', message: 'm', context: {} });
    clearObservabilityLog();
    expect(getObservabilityLog()).toHaveLength(0);
    expect(mockBroadcast).toHaveBeenCalledWith('observabilityLogUpdated', { size: 0 });
  });

  it('debounces persistence (single flush per burst)', async () => {
    vi.useFakeTimers();
    try {
      recordLog({ subsystem: 'rule-engine', op: 't', level: 'info', message: '1', context: {} });
      recordLog({ subsystem: 'rule-engine', op: 't', level: 'info', message: '2', context: {} });
      recordLog({ subsystem: 'rule-engine', op: 't', level: 'info', message: '3', context: {} });
      expect(mockSet).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);
      expect(mockSet).toHaveBeenCalledTimes(1);
      const [, payload] = mockSet.mock.calls[0] as unknown as [unknown, LogEntry[]];
      expect(payload).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
