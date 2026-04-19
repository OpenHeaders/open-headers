/**
 * Client-side helper for dispatching `WorkspaceIntent`s from any
 * non-SW surface (popup, sidepanel, devpanel, or the workspace itself
 * when reaching another workspace tab).
 *
 * Enforces the Appendix-C invariant that there is ONE way to reach the
 * workspace from another surface: through this module. No surface
 * should call `chrome.tabs.create('workspace.html#/...')` directly. A
 * grep guard in CI keeps that honest.
 */

import type { IntentCallerContext, IntentCallerSurface, WorkspaceIntent } from '@openheaders/core/workspace-intent';
import { call } from '@utils/bridge';
import { getBrowserAPI } from '@/types/browser';

export type { WorkspaceIntent };

/**
 * Dispatch an intent via the SW navigator. Returns the navigator's
 * result — callers usually don't need it, but it's there for flows that
 * want to know whether the warm path or cold path ran (e.g. to emit a
 * surface-level toast only when a new tab was created).
 *
 * The `surface` parameter is purely observability metadata for now; the
 * navigator threads it through its log entries so "which surface opened
 * this tab" is visible in exported diagnostic logs.
 */
export async function openWorkspace(
  intent: WorkspaceIntent,
  surface: IntentCallerSurface,
): Promise<{ ok: true; tabId: number; path: string } | { ok: false; reason: string }> {
  const callerContext: IntentCallerContext = { surface };
  const windowId = await resolveCallerWindowId();
  if (typeof windowId === 'number') callerContext.callerWindowId = windowId;

  const result = await call('openWorkspaceIntent', { intent, callerContext });
  if (result.ok) {
    return { ok: true, tabId: result.tabId, path: result.path };
  }
  return { ok: false, reason: result.reason };
}

/**
 * Resolve the caller's window id so the navigator can prefer a
 * same-window workspace tab. Uses `chrome.windows.getCurrent` where
 * available; returns undefined otherwise (popup on Firefox, DevTools
 * panel contexts where the hosting window isn't directly queryable —
 * the navigator's fallback path handles this).
 */
async function resolveCallerWindowId(): Promise<number | undefined> {
  const api = getBrowserAPI() as unknown as {
    windows?: {
      // biome-ignore lint/suspicious/noConfusingVoidType: Chrome API returns void in callback-style; runtime branches on Promise.
      getCurrent?: (opts?: { populate?: boolean }) => Promise<chrome.windows.Window> | void;
    };
  };
  const getCurrent = api.windows?.getCurrent;
  if (!getCurrent) return undefined;
  try {
    const win = await getCurrent();
    return typeof win?.id === 'number' ? win.id : undefined;
  } catch {
    return undefined;
  }
}
