/**
 * Standard-plane storage quota read — `chrome.scripting` injection of a
 * `navigator.storage.estimate()` call into the scope's frame. Totals
 * only: the per-type breakdown is a CDP-tier upgrade (`quota.ts`
 * arbitrates). `navigator.storage` exists in SECURE CONTEXTS only, so a
 * non-secure scope reads `null` — the panel renders an explanatory
 * empty state, never an error.
 */

import type { StorageQuotaWire } from '@openheaders/core/bridge';
import { runInFrame } from './standard-plane';

/**
 * Runs INSIDE the target frame, serialized by `chrome.scripting` —
 * self-contained by necessity. Exported so tests can exercise the
 * availability guards directly against a stubbed `navigator.storage`.
 */
export async function readStorageEstimateInPage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    if (typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') return null;
    return { usage: estimate.usage, quota: estimate.quota };
  } catch {
    return null;
  }
}

export async function getStorageQuotaInjected(
  tabId: number,
  frameId: number,
): Promise<{ quota: StorageQuotaWire | null }> {
  const result = await runInFrame(tabId, frameId, readStorageEstimateInPage, []);
  if (!result || typeof result.usage !== 'number' || typeof result.quota !== 'number') return { quota: null };
  return { quota: { usage: result.usage, quota: result.quota } };
}
