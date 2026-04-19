/**
 * Coverage for the SW-side Workspace Navigator.
 *
 * Two layers:
 *   1. `selectTargetTab` — pure selector, tested without chrome stubs.
 *   2. `openWorkspaceIntent` — full dispatch, tested by stubbing the
 *      `chrome.tabs.*` and `chrome.windows.update` surfaces that the
 *      navigator touches.
 */

import type { WorkspaceIntent } from '@openheaders/core/workspace-intent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecordLog } = vi.hoisted(() => ({
  mockRecordLog: vi.fn(),
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: mockRecordLog,
  hydrateObservabilityLog: vi.fn(async () => undefined),
  getObservabilityLog: vi.fn(() => []),
  clearObservabilityLog: vi.fn(),
}));

import { openWorkspaceIntent, selectTargetTab } from '@/background/modules/workspace-navigator';

// ── Shared tab fixtures ─────────────────────────────────────────────

function makeTab(partial: Partial<chrome.tabs.Tab> & { id: number; windowId: number }): chrome.tabs.Tab {
  return {
    index: 0,
    highlighted: false,
    active: false,
    pinned: false,
    url: 'chrome-extension://test-id/workspace.html',
    incognito: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    selected: false,
    ...partial,
  } as chrome.tabs.Tab;
}

// ── selectTargetTab — pure logic ────────────────────────────────────

describe('selectTargetTab', () => {
  it('returns null for an empty tab list', () => {
    expect(selectTargetTab([], { callerWindowId: 1 })).toBeNull();
  });

  it('returns null when caller window has no workspace tab', () => {
    const tabs = [makeTab({ id: 1, windowId: 2 }), makeTab({ id: 2, windowId: 3 })];
    expect(selectTargetTab(tabs, { callerWindowId: 99 })).toBeNull();
  });

  it('picks the only same-window tab', () => {
    const tabs = [makeTab({ id: 1, windowId: 5 })];
    expect(selectTargetTab(tabs, { callerWindowId: 5 })?.id).toBe(1);
  });

  it('prefers the active tab within the caller window', () => {
    const tabs = [
      makeTab({ id: 10, windowId: 5, lastAccessed: 100 }),
      makeTab({ id: 11, windowId: 5, lastAccessed: 50, active: true }),
    ];
    expect(selectTargetTab(tabs, { callerWindowId: 5 })?.id).toBe(11);
  });

  it('falls back to most-recently-accessed within same window', () => {
    const tabs = [
      makeTab({ id: 10, windowId: 5, lastAccessed: 100 }),
      makeTab({ id: 11, windowId: 5, lastAccessed: 200 }),
      makeTab({ id: 12, windowId: 5, lastAccessed: 150 }),
    ];
    expect(selectTargetTab(tabs, { callerWindowId: 5 })?.id).toBe(11);
  });

  it('breaks recency ties by lowest tab id', () => {
    const tabs = [
      makeTab({ id: 30, windowId: 5, lastAccessed: 100 }),
      makeTab({ id: 10, windowId: 5, lastAccessed: 100 }),
      makeTab({ id: 20, windowId: 5, lastAccessed: 100 }),
    ];
    expect(selectTargetTab(tabs, { callerWindowId: 5 })?.id).toBe(10);
  });

  it('ignores cross-window tabs even if they are more recent', () => {
    const tabs = [
      makeTab({ id: 10, windowId: 5, lastAccessed: 100 }),
      makeTab({ id: 20, windowId: 99, lastAccessed: 9999 }),
    ];
    expect(selectTargetTab(tabs, { callerWindowId: 5 })?.id).toBe(10);
  });

  it('picks by recency across all tabs when callerWindowId is missing', () => {
    const tabs = [
      makeTab({ id: 10, windowId: 5, lastAccessed: 100 }),
      makeTab({ id: 20, windowId: 99, lastAccessed: 500 }),
    ];
    expect(selectTargetTab(tabs, {})?.id).toBe(20);
  });
});

// ── openWorkspaceIntent — full dispatch paths ───────────────────────

const DOCS_INTENT: WorkspaceIntent = { kind: 'open-docs', section: 'doc-system-status' };
const WORKSPACE_URL = 'chrome-extension://test-id/workspace.html';

interface ChromeMocks {
  query: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  windowsUpdate: ReturnType<typeof vi.fn>;
}

function installChromeMocks(): ChromeMocks {
  const query = vi.fn<(...args: unknown[]) => Promise<chrome.tabs.Tab[]>>();
  const update = vi.fn<(...args: unknown[]) => Promise<chrome.tabs.Tab | undefined>>();
  const create = vi.fn<(...args: unknown[]) => Promise<chrome.tabs.Tab>>();
  const sendMessage = vi.fn<(...args: unknown[]) => Promise<unknown>>();
  const windowsUpdate = vi.fn<(...args: unknown[]) => Promise<chrome.windows.Window>>();

  // Replace only the methods the navigator touches. The shared chrome
  // mock sets up callback-style defaults; we override with promise-
  // returning versions so the navigator's promise path is what runs.
  const g = globalThis as unknown as { chrome: Record<string, unknown> };
  g.chrome = {
    ...g.chrome,
    runtime: {
      ...(g.chrome.runtime as object),
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      lastError: null,
    },
    tabs: {
      ...(g.chrome.tabs as object),
      query,
      update,
      create,
      sendMessage,
    },
    windows: {
      update: windowsUpdate,
    },
  };
  return { query, update, create, sendMessage, windowsUpdate };
}

beforeEach(() => {
  mockRecordLog.mockReset();
});

describe('openWorkspaceIntent — malformed payload', () => {
  it('rejects and logs when intent fails schema validation', async () => {
    installChromeMocks();
    const result = await openWorkspaceIntent({ kind: 'not-a-kind' }, {});
    expect(result).toEqual({ ok: false, reason: 'invalid-intent' });
    expect(mockRecordLog).toHaveBeenCalledWith(
      expect.objectContaining({ subsystem: 'workspace', op: 'navigator/reject' }),
    );
  });
});

describe('openWorkspaceIntent — cold path', () => {
  it('creates a new tab when no workspace tab exists', async () => {
    const { query, create } = installChromeMocks();
    query.mockResolvedValueOnce([]);
    create.mockResolvedValueOnce(makeTab({ id: 42, windowId: 7 }));

    const result = await openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });
    expect(result).toEqual({ ok: true, tabId: 42, windowId: 7, path: 'cold' });
    expect(create).toHaveBeenCalledWith({
      url: `${WORKSPACE_URL}#/docs/doc-system-status`,
      active: true,
    });
    expect(mockRecordLog).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'navigator/created', message: expect.stringContaining('cold') }),
    );
  });

  it('creates a new tab when existing tabs are all in other windows', async () => {
    const { query, create } = installChromeMocks();
    query.mockResolvedValueOnce([makeTab({ id: 10, windowId: 99 })]);
    create.mockResolvedValueOnce(makeTab({ id: 99, windowId: 7 }));

    const result = await openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe('cold');
    expect(create).toHaveBeenCalledOnce();
  });
});

describe('openWorkspaceIntent — warm path', () => {
  it('activates the same-window tab and delivers the intent', async () => {
    const { query, update, sendMessage, windowsUpdate, create } = installChromeMocks();
    query.mockResolvedValueOnce([makeTab({ id: 10, windowId: 7 })]);
    update.mockResolvedValue(undefined);
    windowsUpdate.mockResolvedValue({} as chrome.windows.Window);
    sendMessage.mockResolvedValueOnce(undefined);

    const result = await openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });

    expect(result).toEqual({ ok: true, tabId: 10, windowId: 7, path: 'warm' });
    expect(update).toHaveBeenCalledWith(10, { active: true });
    expect(windowsUpdate).toHaveBeenCalledWith(7, { focused: true });
    expect(sendMessage).toHaveBeenCalledWith(10, { type: 'workspace-intent', intent: DOCS_INTENT });
    expect(create).not.toHaveBeenCalled();
    expect(mockRecordLog).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'navigator/delivered', message: expect.stringContaining('warm') }),
    );
  });

  it('retries sendMessage once after a short delay before falling back', async () => {
    vi.useFakeTimers();
    try {
      const { query, update, sendMessage, windowsUpdate } = installChromeMocks();
      query.mockResolvedValueOnce([makeTab({ id: 10, windowId: 7 })]);
      update.mockResolvedValue(undefined);
      windowsUpdate.mockResolvedValue({} as chrome.windows.Window);
      sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist.')).mockResolvedValueOnce(undefined);

      const dispatchPromise = openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });

      // First attempt rejects immediately; advance past the retry delay.
      await vi.advanceTimersByTimeAsync(200);
      const result = await dispatchPromise;

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.path).toBe('warm');
      expect(sendMessage).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to URL navigation when both sendMessage attempts fail', async () => {
    vi.useFakeTimers();
    try {
      const { query, update, sendMessage, windowsUpdate } = installChromeMocks();
      query.mockResolvedValueOnce([makeTab({ id: 10, windowId: 7 })]);
      update.mockResolvedValue(undefined);
      windowsUpdate.mockResolvedValue({} as chrome.windows.Window);
      sendMessage
        .mockRejectedValueOnce(new Error('Receiving end does not exist.'))
        .mockRejectedValueOnce(new Error('Receiving end does not exist.'));

      const dispatchPromise = openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });
      await vi.advanceTimersByTimeAsync(200);
      const result = await dispatchPromise;

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.path).toBe('warm-fallback');
      // Two updates: the initial activate + the URL fallback.
      expect(update).toHaveBeenCalledWith(10, { active: true });
      expect(update).toHaveBeenCalledWith(10, {
        url: `${WORKSPACE_URL}#/docs/doc-system-status`,
      });
      expect(mockRecordLog).toHaveBeenCalledWith(expect.objectContaining({ op: 'navigator/fallback' }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('openWorkspaceIntent — failure logging', () => {
  it('logs and returns a structured failure when tabs.query throws', async () => {
    const { query } = installChromeMocks();
    query.mockRejectedValueOnce(new Error('query explode'));
    const result = await openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });
    expect(result).toEqual({ ok: false, reason: 'query-failed' });
    expect(mockRecordLog).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'navigator/query-failed', level: 'error' }),
    );
  });

  it('logs and returns a structured failure when tabs.create throws', async () => {
    const { query, create } = installChromeMocks();
    query.mockResolvedValueOnce([]);
    create.mockRejectedValueOnce(new Error('create explode'));
    const result = await openWorkspaceIntent(DOCS_INTENT, { callerWindowId: 7 });
    expect(result).toEqual({ ok: false, reason: 'create-failed' });
    expect(mockRecordLog).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'navigator/create-failed', level: 'error' }),
    );
  });
});
