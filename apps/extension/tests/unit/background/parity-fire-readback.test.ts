/**
 * Parity fire readback — the SW-global seam the playground e2e runner
 * reads popup-claimed fire counts through.
 *
 * Pins:
 *   - inert without the parity-hook flag (refuses, no tab query);
 *   - rejects a non-string / empty url;
 *   - errors when no tab matches the url pattern;
 *   - returns the real tab-telemetry snapshot (counters keyed by rule
 *     uid + the fire records) for the matched tab;
 *   - an untracked tab reads back as empty, not as an error — zero
 *     fires is a legitimate assertion target.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  installParityFireReadback,
  type ParityFiresResult,
} from '@/background/modules/rules/parity-fire-readback';
import { recordObservedFire, startTracking, __resetForTests } from '@/background/modules/tab-telemetry';

const PAGE_URL = 'http://127.0.0.1:3000/src/rules/header/index.html';

function setParityFlag(enabled: boolean): void {
  vi.mocked(chrome.storage.local.get).mockImplementation(
    () => Promise.resolve(enabled ? { __oh_parity_hook__: true } : {}) as never,
  );
}

function setOpenTabs(tabs: Array<{ id?: number; url?: string }>): void {
  vi.mocked(chrome.tabs.query).mockImplementation(() => Promise.resolve(tabs) as never);
}

async function getFires(url: unknown): Promise<ParityFiresResult> {
  installParityFireReadback();
  const fn = globalThis.__OH_PARITY_GET_FIRES__;
  if (!fn) throw new Error('global not installed');
  return fn(url);
}

beforeEach(() => {
  __resetForTests();
  setOpenTabs([]);
});

describe('parity fire readback — gating', () => {
  it('refuses when the parity-hook flag is not set', async () => {
    setParityFlag(false);
    const result = await getFires(PAGE_URL);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('parity hook') });
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('rejects a non-string url', async () => {
    setParityFlag(true);
    const result = await getFires(42);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('non-empty string') });
  });

  it('errors when no tab matches the url', async () => {
    setParityFlag(true);
    const result = await getFires(PAGE_URL);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('no tab matches') });
  });
});

describe('parity fire readback — snapshot', () => {
  beforeEach(() => {
    setParityFlag(true);
    setOpenTabs([
      { id: 7, url: PAGE_URL },
      { id: 9, url: 'http://openheaders.io/other' },
    ]);
  });

  it('returns real telemetry counters and fire records for the matched tab', async () => {
    startTracking(7, 'test:readback');
    recordObservedFire(7, 'ru000001', 'http://127.0.0.1:3000/echo?case=a', 'req-1', 1000, {
      pattern: 'http://127.0.0.1:3000/echo*',
      resourceType: 'xmlhttprequest',
      deferred: false,
    });
    recordObservedFire(7, 'ru000001', 'http://127.0.0.1:3000/echo?case=b', 'req-2', 1001, {
      pattern: 'http://127.0.0.1:3000/echo*',
      resourceType: 'xmlhttprequest',
      deferred: false,
    });
    recordObservedFire(7, 'ru000002', 'http://127.0.0.1:3000/echo?case=a', 'req-1', 1002, {
      pattern: 'http://127.0.0.1:3000/echo*',
      resourceType: 'xmlhttprequest',
      deferred: false,
    });

    const result = await getFires(PAGE_URL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tabId).toBe(7);
    expect(result.counters).toEqual({ ru000001: 2, ru000002: 1 });
    expect(result.fires).toHaveLength(3);
    expect(result.fires[0]).toMatchObject({ ruleUid: 'ru000001', evidence: 'matched', requestId: 'req-1' });
  });

  it('reads an untracked tab back as empty (zero fires is assertable)', async () => {
    const result = await getFires(PAGE_URL);
    expect(result).toMatchObject({ ok: true, tabId: 7, counters: {}, fires: [] });
  });
});
