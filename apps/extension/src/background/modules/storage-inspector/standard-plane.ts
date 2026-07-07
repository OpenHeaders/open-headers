/**
 * Standard-plane DOM storage reads AND writes — `chrome.scripting`
 * injection into the scope's frame. The isolated world shares the page
 * origin's DOM storage, so this reads and writes exactly what the page
 * sees; there is no extension API for DOM storage and the CDP
 * `DOMStorage` domain is not dispatched for extension debugger clients
 * (STORAGE_PANEL_PLAN.md §2.3), so injection is the only transport in
 * BOTH inspection modes.
 *
 * Payload discipline: entry count capped, each value clipped to a
 * preview length with the full length reported — a multi-megabyte value
 * must never ride the bridge whole. Editing a clipped value goes through
 * the lazy full-value fetch, itself bounded by a sanity ceiling.
 */

import type { DomStorageAreaWire, DomStorageEntryWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';

/** Entry-count cap per read; overflow sets `truncated`. */
export const DOM_STORAGE_MAX_ENTRIES = 5000;
/** Per-value preview cap (chars); overflow sets `clipped` on the entry. */
export const DOM_STORAGE_VALUE_PREVIEW_MAX = 16 * 1024;
/** Full-value fetch ceiling (chars); past it the value is uneditable. */
export const DOM_STORAGE_FULL_VALUE_MAX = 5 * 1024 * 1024;

interface InjectedReadResult {
  entries: DomStorageEntryWire[];
  truncated: boolean;
}

/**
 * The injected funcs run INSIDE the target frame. Self-contained by
 * necessity — `chrome.scripting` serializes each function, so it can
 * close over nothing; caps arrive as args. Exported so tests can
 * exercise the clipping/truncation/failure rules directly against a
 * fake Storage.
 */
export function readDomStorageInPage(area: 'local' | 'session', maxEntries: number, valuePreviewMax: number) {
  const storage = area === 'local' ? window.localStorage : window.sessionStorage;
  const entries: Array<{ key: string; value: string; valueLength: number; clipped?: boolean }> = [];
  let truncated = false;
  const total = storage.length;
  for (let i = 0; i < total; i++) {
    if (entries.length >= maxEntries) {
      truncated = true;
      break;
    }
    const key = storage.key(i);
    if (key === null) continue;
    const value = storage.getItem(key) ?? '';
    entries.push({
      key,
      value: value.length > valuePreviewMax ? value.slice(0, valuePreviewMax) : value,
      valueLength: value.length,
      ...(value.length > valuePreviewMax ? { clipped: true } : {}),
    });
  }
  return { entries, truncated };
}

export function readDomStorageValueInPage(
  area: 'local' | 'session',
  key: string,
  maxLength: number,
): { value: string | null; tooLarge?: boolean } {
  const storage = area === 'local' ? window.localStorage : window.sessionStorage;
  const value = storage.getItem(key);
  if (value === null) return { value: null };
  if (value.length > maxLength) return { value: null, tooLarge: true };
  return { value };
}

export function writeDomStorageInPage(area: 'local' | 'session', key: string, value: string) {
  const storage = area === 'local' ? window.localStorage : window.sessionStorage;
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch {
    // Quota exceeded — the only setItem failure mode.
    return { ok: false };
  }
}

export function removeDomStorageInPage(area: 'local' | 'session', key: string) {
  const storage = area === 'local' ? window.localStorage : window.sessionStorage;
  storage.removeItem(key);
  return { ok: true };
}

export function clearDomStorageInPage(area: 'local' | 'session') {
  const storage = area === 'local' ? window.localStorage : window.sessionStorage;
  storage.clear();
  return { ok: true };
}

/**
 * The one injection path every op rides (the IDB plane's too —
 * `standard-plane-idb.ts` imports it): serialize `func` into the
 * scope's frame and hand back its return value, `null` on any failure
 * (frame navigated away, tab closed, page not injectable) — the panel
 * renders "unavailable" / a failure note and the next poll retries.
 */
export async function runInFrame<Args extends unknown[], R>(
  tabId: number,
  frameId: number,
  func: (...args: Args) => R,
  args: Args,
): Promise<R | null> {
  if (typeof tabId !== 'number' || typeof frameId !== 'number' || !chrome.scripting?.executeScript) {
    return null;
  }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func,
      args,
    });
    return (injection?.result as R | null | undefined) ?? null;
  } catch (e) {
    logger.info('StorageInject', `executeScript ✗ tab ${tabId} frame ${frameId}: ${(e as Error).message}`);
    return null;
  }
}

function coerceArea(area: DomStorageAreaWire): 'local' | 'session' {
  return area === 'session' ? 'session' : 'local';
}

export async function getDomStorageEntries(
  tabId: number,
  frameId: number,
  area: DomStorageAreaWire,
): Promise<{ entries: DomStorageEntryWire[] | null; truncated?: boolean }> {
  const result = await runInFrame(tabId, frameId, readDomStorageInPage, [
    coerceArea(area),
    DOM_STORAGE_MAX_ENTRIES,
    DOM_STORAGE_VALUE_PREVIEW_MAX,
  ]);
  if (!result || !Array.isArray((result as InjectedReadResult).entries)) return { entries: null };
  return { entries: result.entries, ...(result.truncated ? { truncated: true } : {}) };
}

export async function getDomStorageValue(
  tabId: number,
  frameId: number,
  area: DomStorageAreaWire,
  key: string,
): Promise<{ value: string | null; tooLarge?: boolean }> {
  if (typeof key !== 'string') return { value: null };
  const result = await runInFrame(tabId, frameId, readDomStorageValueInPage, [
    coerceArea(area),
    key,
    DOM_STORAGE_FULL_VALUE_MAX,
  ]);
  if (!result) return { value: null };
  return { value: result.value, ...(result.tooLarge ? { tooLarge: true } : {}) };
}

export async function setDomStorageItem(
  tabId: number,
  frameId: number,
  area: DomStorageAreaWire,
  key: string,
  value: string,
): Promise<{ ok: boolean }> {
  if (typeof key !== 'string' || typeof value !== 'string') return { ok: false };
  const result = await runInFrame(tabId, frameId, writeDomStorageInPage, [coerceArea(area), key, value]);
  return { ok: result?.ok === true };
}

export async function removeDomStorageItem(
  tabId: number,
  frameId: number,
  area: DomStorageAreaWire,
  key: string,
): Promise<{ ok: boolean }> {
  if (typeof key !== 'string') return { ok: false };
  const result = await runInFrame(tabId, frameId, removeDomStorageInPage, [coerceArea(area), key]);
  return { ok: result?.ok === true };
}

export async function clearDomStorage(
  tabId: number,
  frameId: number,
  area: DomStorageAreaWire,
): Promise<{ ok: boolean }> {
  const result = await runInFrame(tabId, frameId, clearDomStorageInPage, [coerceArea(area)]);
  return { ok: result?.ok === true };
}
