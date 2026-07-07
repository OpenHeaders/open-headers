/**
 * Storage-scope discovery for the DevTools panel's Storage tool window.
 *
 * A "scope" is a distinct http(s) origin in the inspected tab's frame
 * tree. Same-origin frames collapse to one scope: within a tab they
 * share both DOM storage areas (localStorage per origin, sessionStorage
 * per origin per top-level browsing context), so one injection target
 * per origin reads everything. The topmost frame carrying an origin —
 * main frame first, then lowest `frameId` — is kept as that target.
 *
 * Non-http(s) frames (about:blank, blob:, chrome-extension:, sandboxed
 * opaque origins) carry no inspectable DOM storage and are dropped.
 */

import type { StorageScopeWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';
import { stampStorageKeys } from './cdp-tier';

export async function listStorageScopes(tabId: number): Promise<{ scopes: StorageScopeWire[] | null }> {
  if (typeof tabId !== 'number' || !chrome.webNavigation?.getAllFrames) return { scopes: null };

  let frames: chrome.webNavigation.GetAllFrameResultDetails[] | null;
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId });
  } catch (e) {
    logger.info('StorageScopes', `getAllFrames threw: ${(e as Error).message}`);
    return { scopes: null };
  }
  if (!frames) return { scopes: null };

  const byOrigin = new Map<string, StorageScopeWire>();
  for (const frame of frames) {
    if (frame.errorOccurred) continue;
    let origin: string;
    try {
      const url = new URL(frame.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      origin = url.origin;
    } catch {
      continue;
    }
    const isMainFrame = frame.frameId === 0;
    const existing = byOrigin.get(origin);
    if (!existing || isMainFrame || (!existing.isMainFrame && frame.frameId < existing.frameId)) {
      byOrigin.set(origin, { frameId: frame.frameId, origin, url: frame.url, isMainFrame });
    }
  }

  const scopes = [...byOrigin.values()].sort((a, b) =>
    a.isMainFrame !== b.isMainFrame ? (a.isMainFrame ? -1 : 1) : a.origin.localeCompare(b.origin),
  );
  return { scopes: await stampStorageKeys(tabId, scopes) };
}
