/**
 * Coverage for the SW-side Workspace Tab Registry.
 *
 * Two layers:
 *   1. `nextAvailableOrdinal` — pure allocator, tested without
 *      chrome stubs.
 *   2. `setupWorkspaceTabRegistry` — full lifecycle, tested by
 *      capturing the `chrome.tabs.on{Created,Updated,Replaced,
 *      Removed}` listeners the module installs and driving them
 *      directly. Broadcast emission is asserted against a mocked
 *      `@utils/bridge` export.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBroadcast, mockRecordLog } = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
  mockRecordLog: vi.fn(),
}));

vi.mock('@utils/bridge', () => ({
  broadcast: mockBroadcast,
  call: vi.fn(),
  subscribe: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: mockRecordLog,
  hydrateObservabilityLog: vi.fn(async () => undefined),
  getObservabilityLog: vi.fn(() => []),
  clearObservabilityLog: vi.fn(),
}));

type CreatedListener = (tab: chrome.tabs.Tab) => void;
type UpdatedListener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void;
type ReplacedListener = (addedTabId: number, removedTabId: number) => void;
type RemovedListener = (tabId: number) => void;

interface CapturedListeners {
  onCreated: CreatedListener[];
  onUpdated: UpdatedListener[];
  onReplaced: ReplacedListener[];
  onRemoved: RemovedListener[];
}

function installChromeWithListenerCapture(existingTabs: chrome.tabs.Tab[] = []): {
  listeners: CapturedListeners;
  queryMock: ReturnType<typeof vi.fn>;
} {
  const listeners: CapturedListeners = {
    onCreated: [],
    onUpdated: [],
    onReplaced: [],
    onRemoved: [],
  };
  const query = vi.fn<(...args: unknown[]) => Promise<chrome.tabs.Tab[]>>();
  query.mockResolvedValue(existingTabs);

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
      onCreated: {
        addListener: vi.fn((fn: CreatedListener) => {
          listeners.onCreated.push(fn);
        }),
      },
      onUpdated: {
        addListener: vi.fn((fn: UpdatedListener) => {
          listeners.onUpdated.push(fn);
        }),
      },
      onReplaced: {
        addListener: vi.fn((fn: ReplacedListener) => {
          listeners.onReplaced.push(fn);
        }),
      },
      onRemoved: {
        addListener: vi.fn((fn: RemovedListener) => {
          listeners.onRemoved.push(fn);
        }),
      },
    },
  };
  return { listeners, queryMock: query };
}

function makeTab(partial: Partial<chrome.tabs.Tab> & { id: number }): chrome.tabs.Tab {
  return {
    index: 0,
    highlighted: false,
    active: false,
    pinned: false,
    windowId: 1,
    url: 'chrome-extension://test-id/workspace.html',
    incognito: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    selected: false,
    ...partial,
  } as chrome.tabs.Tab;
}

async function loadRegistry(): Promise<typeof import('@/background/modules/workspace-tab-registry')> {
  vi.resetModules();
  return import('@/background/modules/workspace-tab-registry');
}

async function flushBootstrap(): Promise<void> {
  // The registry's `bootstrapFromExistingTabs` resolves via `tabs.query`
  // (promise) — let the microtask queue drain so the bootstrap writes
  // before assertions read.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  mockBroadcast.mockReset();
  mockRecordLog.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── nextAvailableOrdinal — pure allocator ───────────────────────────

describe('nextAvailableOrdinal', () => {
  it('returns 1 for an empty in-use set (clean slate)', async () => {
    const { nextAvailableOrdinal } = await loadRegistry();
    expect(nextAvailableOrdinal(new Set())).toBe(1);
  });

  it('returns max(inUse) + 1 for a non-empty set', async () => {
    const { nextAvailableOrdinal } = await loadRegistry();
    expect(nextAvailableOrdinal(new Set([1, 2, 3]))).toBe(4);
    expect(nextAvailableOrdinal(new Set([5, 3, 1]))).toBe(6);
  });

  it('does NOT reuse a freed slot while others remain alive', async () => {
    // Conceptually: set was { 1, 2, 3 }, #1 closed → live { 2, 3 }.
    // Allocator must return 4 (not 1).
    const { nextAvailableOrdinal } = await loadRegistry();
    expect(nextAvailableOrdinal(new Set([2, 3]))).toBe(4);
  });

  it('handles a single-element set', async () => {
    const { nextAvailableOrdinal } = await loadRegistry();
    expect(nextAvailableOrdinal(new Set([7]))).toBe(8);
  });
});

// ── setupWorkspaceTabRegistry — listener wiring ─────────────────────

describe('setupWorkspaceTabRegistry — onCreated', () => {
  it('assigns #1 to the first workspace tab', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab, workspaceTabCount } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 100 }));

    expect(ordinalForTab(100)).toBe(1);
    expect(workspaceTabCount()).toBe(1);
    expect(mockBroadcast).toHaveBeenCalledWith(
      'workspaceTabsChanged',
      expect.objectContaining({ ordinals: { 100: 1 }, count: 1 }),
    );
  });

  it('ignores tabs whose URL is not workspace.html', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, workspaceTabCount } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 100, url: 'https://example.com' }));

    expect(workspaceTabCount()).toBe(0);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('accepts pendingUrl when url is still blank', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    const tab = {
      ...makeTab({ id: 200, url: '' }),
      pendingUrl: 'chrome-extension://test-id/workspace.html#/docs/x',
    } as chrome.tabs.Tab;
    listeners.onCreated[0](tab);

    expect(ordinalForTab(200)).toBe(1);
  });

  it('assigns #1/#2/#3 in creation order', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 10 }));
    listeners.onCreated[0](makeTab({ id: 20 }));
    listeners.onCreated[0](makeTab({ id: 30 }));

    expect(ordinalForTab(10)).toBe(1);
    expect(ordinalForTab(20)).toBe(2);
    expect(ordinalForTab(30)).toBe(3);
  });

  it('ignores duplicate onCreated fires for the same tab', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab, workspaceTabCount } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 100 }));
    listeners.onCreated[0](makeTab({ id: 100 }));

    expect(ordinalForTab(100)).toBe(1);
    expect(workspaceTabCount()).toBe(1);
  });
});

describe('setupWorkspaceTabRegistry — stability within lifetime', () => {
  it('does NOT renumber surviving tabs when #1 closes', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 10 })); // #1
    listeners.onCreated[0](makeTab({ id: 20 })); // #2
    listeners.onCreated[0](makeTab({ id: 30 })); // #3

    listeners.onRemoved[0](10); // close #1

    // #2 and #3 keep their numbers.
    expect(ordinalForTab(20)).toBe(2);
    expect(ordinalForTab(30)).toBe(3);
    expect(ordinalForTab(10)).toBeNull();
  });

  it('assigns the next tab #4 when #1 closed but live set is non-empty', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 10 })); // #1
    listeners.onCreated[0](makeTab({ id: 20 })); // #2
    listeners.onCreated[0](makeTab({ id: 30 })); // #3
    listeners.onRemoved[0](10); // close #1 — live { 2, 3 }

    listeners.onCreated[0](makeTab({ id: 40 }));
    expect(ordinalForTab(40)).toBe(4);
  });

  it('resets to #1 after the live set drops to zero', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab, workspaceTabCount } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 10 })); // #1
    listeners.onCreated[0](makeTab({ id: 20 })); // #2
    listeners.onRemoved[0](10);
    listeners.onRemoved[0](20);

    expect(workspaceTabCount()).toBe(0);

    listeners.onCreated[0](makeTab({ id: 30 }));
    expect(ordinalForTab(30)).toBe(1);
  });
});

describe('setupWorkspaceTabRegistry — onUpdated', () => {
  it('assigns an ordinal when an existing tab navigates INTO workspace.html', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    // Never tracked before — tab was some other URL, user pastes workspace URL.
    listeners.onUpdated[0](
      42,
      { url: 'chrome-extension://test-id/workspace.html#/' },
      makeTab({ id: 42, url: 'chrome-extension://test-id/workspace.html#/' }),
    );
    expect(ordinalForTab(42)).toBe(1);
  });

  it('releases the ordinal when a workspace tab navigates AWAY', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab, workspaceTabCount } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 42 }));
    expect(ordinalForTab(42)).toBe(1);

    listeners.onUpdated[0](
      42,
      { url: 'https://openheaders.io/docs' },
      makeTab({ id: 42, url: 'https://openheaders.io/docs' }),
    );
    expect(ordinalForTab(42)).toBeNull();
    expect(workspaceTabCount()).toBe(0);
  });

  it('ignores onUpdated events that do NOT carry a url change', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 42 }));
    mockBroadcast.mockClear();
    listeners.onUpdated[0](42, { status: 'complete' }, makeTab({ id: 42 }));

    expect(ordinalForTab(42)).toBe(1);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});

describe('setupWorkspaceTabRegistry — onReplaced (tab-discard)', () => {
  it('transfers the ordinal to the new tab id', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 10 }));
    expect(ordinalForTab(10)).toBe(1);

    listeners.onReplaced[0](99, 10);

    expect(ordinalForTab(10)).toBeNull();
    expect(ordinalForTab(99)).toBe(1);
  });

  it('does nothing if the removed tab id was not tracked', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry, ordinalForTab, workspaceTabCount } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onReplaced[0](99, 10);
    expect(ordinalForTab(99)).toBeNull();
    expect(workspaceTabCount()).toBe(0);
  });
});

describe('setupWorkspaceTabRegistry — bootstrap-on-wake', () => {
  it('repopulates from existing workspace tabs in tabId order', async () => {
    installChromeWithListenerCapture([makeTab({ id: 30 }), makeTab({ id: 10 }), makeTab({ id: 20 })]);
    const { setupWorkspaceTabRegistry, ordinalForTab } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    // Sorted by tabId, lowest first — deterministic tie-break.
    expect(ordinalForTab(10)).toBe(1);
    expect(ordinalForTab(20)).toBe(2);
    expect(ordinalForTab(30)).toBe(3);
  });

  it('is idempotent — second setup call does NOT re-wire', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry } = await loadRegistry();
    setupWorkspaceTabRegistry();
    setupWorkspaceTabRegistry();

    // Each listener was added exactly once.
    expect(listeners.onCreated).toHaveLength(1);
    expect(listeners.onUpdated).toHaveLength(1);
    expect(listeners.onReplaced).toHaveLength(1);
    expect(listeners.onRemoved).toHaveLength(1);
  });
});

describe('setupWorkspaceTabRegistry — observability', () => {
  it('records a structured entry on every assignment', async () => {
    const { listeners } = installChromeWithListenerCapture();
    const { setupWorkspaceTabRegistry } = await loadRegistry();
    setupWorkspaceTabRegistry();
    await flushBootstrap();

    listeners.onCreated[0](makeTab({ id: 10 }));
    listeners.onRemoved[0](10);

    const entries = mockRecordLog.mock.calls.map((c) => c[0]);
    const ops = entries.map((e: { op: string }) => e.op);
    expect(ops).toContain('tab-registry/assigned');
    expect(ops).toContain('tab-registry/released');
    for (const entry of entries) {
      expect(entry).toMatchObject({ subsystem: 'workspace' });
    }
  });
});
