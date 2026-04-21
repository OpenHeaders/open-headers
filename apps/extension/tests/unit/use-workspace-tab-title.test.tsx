/**
 * Coverage for the `useWorkspaceTabTitle` hook + `composeTitle` helper.
 *
 * Two layers:
 *   1. `composeTitle` — pure function, tested without rendering.
 *   2. `useWorkspaceTabTitle` — rendered via `@testing-library/react`,
 *      with a mocked `@utils/bridge` so we control the RPC reply
 *      and the broadcast stream that drives count updates.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BroadcastHandler = (payload: { ordinals: Record<number, number>; count: number }) => void;

const { mockCall, mockSubscribe } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mockSubscribe: vi.fn(),
}));

vi.mock('@utils/bridge', () => ({
  call: mockCall,
  subscribe: mockSubscribe,
  broadcast: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

import { composeTitle, useWorkspaceTabTitle } from '@/workbench/hooks/useWorkspaceTabTitle';

let broadcastHandler: BroadcastHandler | null = null;
let unsubscribeMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastHandler = null;
  unsubscribeMock = vi.fn();
  mockCall.mockReset();
  mockSubscribe.mockReset();
  mockSubscribe.mockImplementation((type: string, handler: BroadcastHandler) => {
    if (type === 'workspaceTabsChanged') {
      broadcastHandler = handler;
    }
    return unsubscribeMock;
  });
  // Default: RPC resolves with a single-tab state (no prefix).
  mockCall.mockResolvedValue({ ordinal: 1, count: 1 });
  document.title = 'Open Headers';
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── composeTitle — pure ─────────────────────────────────────────────

describe('composeTitle', () => {
  it('returns the base verbatim when count is 1', () => {
    expect(composeTitle({ ordinal: 1, count: 1 })).toBe('Open Headers');
    expect(composeTitle({ ordinal: 1, count: 1 }, 'my-rule — Open Headers')).toBe('my-rule — Open Headers');
  });

  it('returns the base verbatim when count is 0 (registry race)', () => {
    expect(composeTitle({ ordinal: null, count: 0 })).toBe('Open Headers');
  });

  it('prefixes #<ordinal> when count >= 2 and ordinal is known', () => {
    expect(composeTitle({ ordinal: 1, count: 2 })).toBe('#1 Open Headers');
    expect(composeTitle({ ordinal: 3, count: 5 }, 'debug — Open Headers')).toBe('#3 debug — Open Headers');
  });

  it('falls back to plain base when count >= 2 but ordinal unknown', () => {
    expect(composeTitle({ ordinal: null, count: 2 })).toBe('Open Headers');
  });
});

// ── useWorkspaceTabTitle — rendered ─────────────────────────────────

describe('useWorkspaceTabTitle — single-tab path', () => {
  it('leaves document.title at the default when count is 1', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 1, count: 1 });
    renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getWorkspaceTabOrdinal'));
    expect(document.title).toBe('Open Headers');
  });

  it('exposes ordinal=null when count is 1 (no prefix needed)', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 1, count: 1 });
    const { result } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(result.current.count).toBe(1));
    expect(result.current.ordinal).toBeNull();
  });
});

describe('useWorkspaceTabTitle — multi-tab path', () => {
  it('writes #<n> Open Headers on initial RPC when count >= 2', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 2, count: 3 });
    renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(document.title).toBe('#2 Open Headers'));
  });

  it('re-composes when a workspaceTabsChanged broadcast lands', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 1, count: 1 });
    const { result } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(result.current.count).toBe(1));

    expect(broadcastHandler).not.toBeNull();
    act(() => {
      broadcastHandler!({ ordinals: { 100: 1, 200: 2 }, count: 2 });
    });
    expect(document.title).toBe('#1 Open Headers');
    expect(result.current.count).toBe(2);
    expect(result.current.ordinal).toBe(1);
  });

  it('sheds the prefix when count drops back to 1', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 2, count: 2 });
    const { result } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(document.title).toBe('#2 Open Headers'));

    act(() => {
      broadcastHandler!({ ordinals: { 200: 2 }, count: 1 });
    });
    expect(document.title).toBe('Open Headers');
    expect(result.current.ordinal).toBeNull();
  });

  it('keeps the same ordinal across multiple broadcasts (stability)', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 3, count: 3 });
    const { result } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(document.title).toBe('#3 Open Headers'));

    act(() => {
      broadcastHandler!({ ordinals: { 10: 1, 30: 3 }, count: 2 });
    });
    expect(document.title).toBe('#3 Open Headers');
    expect(result.current.ordinal).toBe(3);
  });
});

describe('useWorkspaceTabTitle — route composition via setBase', () => {
  it('applies setBase through composeTitle with current count', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 2, count: 2 });
    const { result } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(document.title).toBe('#2 Open Headers'));

    act(() => {
      result.current.setBase('my-rule — Open Headers');
    });
    expect(document.title).toBe('#2 my-rule — Open Headers');
  });

  it('reverts to default base when setBase(null) is called', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 2, count: 2 });
    const { result } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(document.title).toBe('#2 Open Headers'));

    act(() => {
      result.current.setBase('rule — Open Headers');
    });
    expect(document.title).toBe('#2 rule — Open Headers');

    act(() => {
      result.current.setBase(null);
    });
    expect(document.title).toBe('#2 Open Headers');
  });
});

describe('useWorkspaceTabTitle — bridge failure tolerance', () => {
  it('leaves document.title at the HTML default when the RPC rejects', async () => {
    mockCall.mockRejectedValueOnce(new Error('sw asleep'));
    renderHook(() => useWorkspaceTabTitle());
    // Allow microtask queue to drain.
    await Promise.resolve();
    await Promise.resolve();
    expect(document.title).toBe('Open Headers');
  });

  it('unsubscribes on unmount', async () => {
    mockCall.mockResolvedValueOnce({ ordinal: 1, count: 1 });
    const { unmount } = renderHook(() => useWorkspaceTabTitle());
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
