/**
 * Deferred-update host — holds a downloaded extension update while any
 * DevTools session (`devtools-har-source:<tabId>` port) is connected,
 * and applies it after a grace window once the last session closes.
 * The pending flag survives SW eviction via `chrome.storage.session`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startUpdateDeferral, UPDATE_RELOAD_GRACE_MS, type UpdateDeferralHost } from '@/background/update-deferral';

interface FakePort {
  name: string;
  sender: { url: string };
  disconnectListeners: Array<() => void>;
  onDisconnect: { addListener: (fn: () => void) => void };
  onMessage: { addListener: (fn: (msg: unknown) => void) => void };
  disconnect: () => void;
}

function fakePort(name: string): FakePort {
  const port: FakePort = {
    name,
    sender: { url: 'chrome-extension://test-id/panel.html' },
    disconnectListeners: [],
    onDisconnect: { addListener: (fn) => port.disconnectListeners.push(fn) },
    onMessage: { addListener: () => {} },
    disconnect: () => {
      for (const fn of port.disconnectListeners) fn();
    },
  };
  return port;
}

let connectListener: ((port: chrome.runtime.Port) => void) | null;
let updateListener: ((details: chrome.runtime.UpdateAvailableDetails) => void) | null;
let sessionFlags: Record<string, unknown>;
let host: UpdateDeferralHost | null;

beforeEach(() => {
  vi.useFakeTimers();
  connectListener = null;
  updateListener = null;
  sessionFlags = {};
  host = null;

  const onConnect = chrome.runtime.onConnect as unknown as { addListener: ReturnType<typeof vi.fn> };
  onConnect.addListener = vi.fn((fn: (port: chrome.runtime.Port) => void) => {
    connectListener = fn;
  });
  const onUpdateAvailable = chrome.runtime.onUpdateAvailable as unknown as { addListener: ReturnType<typeof vi.fn> };
  onUpdateAvailable.addListener = vi.fn((fn: (details: chrome.runtime.UpdateAvailableDetails) => void) => {
    updateListener = fn;
  });
  const session = chrome.storage.session as unknown as {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  session.get = vi.fn(async () => sessionFlags);
  session.set = vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(sessionFlags, items);
  });
});

afterEach(() => {
  host?.dispose();
  vi.useRealTimers();
});

function connect(port: FakePort): void {
  connectListener?.(port as unknown as chrome.runtime.Port);
}

function updateAvailable(): void {
  updateListener?.({ version: '2026.8.1' });
}

describe('startUpdateDeferral', () => {
  it('reloads after the grace window when no DevTools session is open', async () => {
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    updateAvailable();
    expect(reload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('holds the update while a DevTools session is connected', async () => {
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    const source = fakePort('devtools-har-source:5');
    connect(source);
    updateAvailable();

    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS * 3);
    expect(reload).not.toHaveBeenCalled();

    source.disconnect();
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a session connecting during the grace window cancels the reload', async () => {
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    updateAvailable();
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS / 2);

    const source = fakePort('devtools-har-source:7');
    connect(source);
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS * 3);
    expect(reload).not.toHaveBeenCalled();

    source.disconnect();
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits for the last of several sessions before reloading', async () => {
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    const a = fakePort('devtools-har-source:1');
    const b = fakePort('devtools-har-source:2');
    connect(a);
    connect(b);
    updateAvailable();

    a.disconnect();
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS * 3);
    expect(reload).not.toHaveBeenCalled();

    b.disconnect();
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores ports that are not a har-source port', async () => {
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    connect(fakePort('rule-fire:3'));
    updateAvailable();

    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('persists the pending flag and rearms from it on a fresh SW life', async () => {
    const firstReload = vi.fn();
    host = startUpdateDeferral({ reload: firstReload });
    const source = fakePort('devtools-har-source:5');
    connect(source);
    updateAvailable();
    expect(sessionFlags['update.pendingReload']).toBe(true);
    host.dispose();

    // New SW life: the flag is read back, no onUpdateAvailable re-fires.
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a redialed session during the boot grace holds the rearmed reload', async () => {
    sessionFlags['update.pendingReload'] = true;
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    // The devtools_page redials before the grace expires.
    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS / 2);
    const source = fakePort('devtools-har-source:5');
    connect(source);

    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS * 3);
    expect(reload).not.toHaveBeenCalled();
  });

  it('dispose cancels a scheduled reload', async () => {
    const reload = vi.fn();
    host = startUpdateDeferral({ reload });

    updateAvailable();
    host.dispose();
    host = null;

    await vi.advanceTimersByTimeAsync(UPDATE_RELOAD_GRACE_MS * 2);
    expect(reload).not.toHaveBeenCalled();
  });
});
