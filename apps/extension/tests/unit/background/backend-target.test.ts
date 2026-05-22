/**
 * `isLoopbackBackend` — the loopback classification driving the
 * active-workspace mirroring gate. Derived purely from `backend.mode` +
 * `backend.url`; the settings store is mocked so each case sets its own.
 */

import { describe, expect, it, vi } from 'vitest';

let settingsStore: Record<string, unknown> = {};

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn((key: string) => settingsStore[key]),
  subscribeKey: vi.fn(() => () => undefined),
}));

import { isLoopbackBackend } from '../../../src/background/backend-target';

describe('isLoopbackBackend', () => {
  it('treats in-browser mode as loopback regardless of url', () => {
    settingsStore = { 'backend.mode': 'in-browser', 'backend.url': 'wss://daemon.example.com' };
    expect(isLoopbackBackend()).toBe(true);
  });

  it('classifies loopback hosts as loopback', () => {
    for (const url of ['ws://127.0.0.1:59210', 'ws://localhost:59210', 'ws://[::1]:59210', 'ws://127.5.5.5:8137']) {
      settingsStore = { 'backend.mode': 'desktop-app', 'backend.url': url };
      expect(isLoopbackBackend(), url).toBe(true);
    }
  });

  it('classifies LAN / WAN hosts as non-loopback', () => {
    for (const url of ['ws://192.168.1.50:59210', 'ws://10.0.0.7:59210', 'wss://daemon.example.com']) {
      settingsStore = { 'backend.mode': 'desktop-app', 'backend.url': url };
      expect(isLoopbackBackend(), url).toBe(false);
    }
  });

  it('returns false for an absent or malformed url', () => {
    settingsStore = { 'backend.mode': 'desktop-app', 'backend.url': '' };
    expect(isLoopbackBackend()).toBe(false);
    settingsStore = { 'backend.mode': 'desktop-app', 'backend.url': 'not a url' };
    expect(isLoopbackBackend()).toBe(false);
  });
});
