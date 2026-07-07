/**
 * Standard-plane DOM storage reads — `chrome.scripting` injection into
 * the scope's frame. The isolated world shares the page origin's DOM
 * storage, so this reads exactly what the page sees; there is no
 * extension API for DOM storage and the CDP `DOMStorage` domain is not
 * dispatched for extension debugger clients (STORAGE_PANEL_PLAN.md §2.3),
 * so injection is the only transport in BOTH inspection modes.
 *
 * Payload discipline: entry count capped, each value clipped to a
 * preview length with the full length reported — a multi-megabyte value
 * must never ride the bridge whole. Lazy full-value fetch is a later
 * slice.
 */

import type { DomStorageAreaWire, DomStorageEntryWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';

/** Entry-count cap per read; overflow sets `truncated`. */
export const DOM_STORAGE_MAX_ENTRIES = 5000;
/** Per-value preview cap (chars); overflow sets `clipped` on the entry. */
export const DOM_STORAGE_VALUE_PREVIEW_MAX = 16 * 1024;

interface InjectedReadResult {
  entries: DomStorageEntryWire[];
  truncated: boolean;
}

/**
 * Runs INSIDE the target frame. Self-contained by necessity —
 * `chrome.scripting` serializes the function, so it can close over
 * nothing; caps arrive as args. Exported so tests can exercise the
 * clipping/truncation rules directly against a fake Storage.
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

export async function getDomStorageEntries(
  tabId: number,
  frameId: number,
  area: DomStorageAreaWire,
): Promise<{ entries: DomStorageEntryWire[] | null; truncated?: boolean }> {
  if (typeof tabId !== 'number' || typeof frameId !== 'number' || !chrome.scripting?.executeScript) {
    return { entries: null };
  }
  const safeArea: DomStorageAreaWire = area === 'session' ? 'session' : 'local';

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: readDomStorageInPage,
      args: [safeArea, DOM_STORAGE_MAX_ENTRIES, DOM_STORAGE_VALUE_PREVIEW_MAX],
    });
    const result = injection?.result as InjectedReadResult | null | undefined;
    if (!result || !Array.isArray(result.entries)) return { entries: null };
    return { entries: result.entries, ...(result.truncated ? { truncated: true } : {}) };
  } catch (e) {
    // Frame navigated away, tab closed, or page not injectable — the
    // panel renders "unavailable" and the next poll retries.
    logger.info('StorageRead', `executeScript ✗ tab ${tabId} frame ${frameId}: ${(e as Error).message}`);
    return { entries: null };
  }
}
