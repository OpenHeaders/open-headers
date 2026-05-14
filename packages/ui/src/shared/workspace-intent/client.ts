/**
 * Client-side helper for dispatching `WorkspaceIntent`s from any
 * non-SW surface (popup, sidepanel, devpanel, or the workspace itself
 * when reaching another workspace tab).
 *
 * Enforces the Appendix-C invariant that there is ONE way to reach the
 * workspace from another surface: through this module. No surface opens
 * a workspace tab directly — the host's SW navigator owns that. A grep
 * guard in CI keeps that honest.
 *
 * Host-agnostic: the SW round-trips go through the `hostBridge` seam and
 * the caller's window context through `hostNavigation` — no `chrome.*`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { hostNavigation } from '@openheaders/core/navigation';
import type { IntentCallerContext, IntentCallerSurface, WorkspaceIntent } from '@openheaders/core/workspace-intent';

export type { WorkspaceIntent };

/**
 * Dispatch an intent via the SW navigator. Returns the navigator's
 * result — callers usually don't need it, but it's there for flows that
 * want to know whether the warm path or cold path ran (e.g. to emit a
 * surface-level toast only when a new tab was created).
 *
 * `surface` is observability metadata threaded through navigator log
 * entries so "which surface opened this tab" is visible in exported
 * logs. Optional `workspaceId` pins the editing-scope binding the
 * caller wants to land in: the navigator filters candidate workbench
 * tabs to those bound to this workspace, and cold-path tabs encode the
 * binding in the URL (`#/ws/<wsId>/<intent>`) so the workbench resolves
 * its scope synchronously on first render — no cold-mount race. When
 * omitted, the client resolves the caller's runtime-Active workspace
 * via `listWorkspaces` so popup/sidepanel/devpanel surfaces always land
 * in the workspace the user is currently looking at.
 */
export async function openWorkspace(
  intent: WorkspaceIntent,
  surface: IntentCallerSurface,
  options?: { workspaceId?: string },
): Promise<{ ok: true; tabId: number; path: string } | { ok: false; reason: string }> {
  const callerContext: IntentCallerContext = { surface };
  const [windowId, workspaceId] = await Promise.all([
    hostNavigation.currentWindowId(),
    options?.workspaceId !== undefined ? Promise.resolve(options.workspaceId) : resolveCallerWorkspaceId(),
  ]);
  if (typeof windowId === 'number') callerContext.callerWindowId = windowId;
  if (typeof workspaceId === 'string') callerContext.callerWorkspaceId = workspaceId;

  const result = await hostBridge.call('openWorkspaceIntent', { intent, callerContext });
  if (result.ok) {
    return { ok: true, tabId: result.tabId, path: result.path };
  }
  return { ok: false, reason: result.reason };
}

/**
 * Resolve the caller's editing-scope workspace via the SW. System
 * surfaces (popup / sidepanel / devpanel) always reflect the
 * runtime-Active workspace, so this is the right answer for them.
 * Workbench-to-workbench dispatches should pass an explicit
 * `options.workspaceId` to override (the source tab's bound id, not
 * runtime-Active — diverged tabs may differ).
 */
async function resolveCallerWorkspaceId(): Promise<string | undefined> {
  try {
    const resp = await hostBridge.call('listWorkspaces');
    return resp.activeWorkspaceId;
  } catch {
    return undefined;
  }
}
