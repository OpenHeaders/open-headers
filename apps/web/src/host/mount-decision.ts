/**
 * Mount-decision helpers — the web entry's answer to "is there anywhere
 * to work" once the boot plane stopped seeding (A4: the served tab is a
 * replica; `bootWebHost` declares `seedOnEmpty: false`).
 *
 * Two acts, both ordinary mutations against the live oracle rather
 * than bootstrap replays:
 *
 *   - A NEVER-JOINED browser mounting offline-first (the A8 case — no
 *     stored session, daemon unreachable) seeds its one local
 *     workspace here, at the mount decision. A joined tab never seeds;
 *     a showing gate never seeds.
 *   - The Workbench assumes an active workspace, so when workspaces
 *     exist but the active pointer is unset (a join whose adoption
 *     hint never synced, or a grant arriving on the awaiting-access
 *     screen), the first workspace in sort order is promoted. The
 *     `setActiveExtensionWorkspace` flip drives the coord runner,
 *     which performs exactly the per-workspace hydration an empty
 *     boot skipped.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import {
  createWorkspace,
  DEFAULT_WORKSPACE_COLOR,
  DEFAULT_WORKSPACE_NAME,
  listWorkspaces,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { hasDaemonToken } from './daemon-token';

const SCOPE = 'MountDecision';

/**
 * True when the active pointer names a live workspace — the state the
 * Workbench may mount in. A dangling pointer (the last workspace was
 * deleted or revoked mid-session) reads as unset.
 */
export function hasUsableActiveWorkspace(): boolean {
  const active = peekActiveWorkspaceId();
  return active !== null && listWorkspaces().some((ws) => ws.id === active);
}

/**
 * A8 — seed the local workspace on a never-joined browser with an
 * empty store, through the ordinary SW-internal create (home Org — the
 * identity snapshot is installed by mount time) plus the ordinary
 * setActive flip. A no-op when a session token is stored (a joined tab
 * never seeds) or when workspaces already exist.
 */
export async function seedLocalWorkspaceIfNeverJoined(): Promise<void> {
  if (hasDaemonToken() || listWorkspaces().length > 0) return;
  const created = await createWorkspace({ name: DEFAULT_WORKSPACE_NAME, color: DEFAULT_WORKSPACE_COLOR });
  await setActiveWorkspaceById(created.id);
  logger.info(SCOPE, `seeded local workspace ${created.id} at the offline-first mount`);
}

/**
 * Promote the first workspace in sort order when workspaces exist but
 * no live one is active. Safe to re-enter: re-checks the pointer, and
 * a concurrent join → adopt promotion simply wins the last write.
 */
export async function promoteFirstWorkspaceWhenUnset(): Promise<void> {
  if (hasUsableActiveWorkspace()) return;
  const first = listWorkspaces()[0];
  if (!first) return;
  await setActiveWorkspaceById(first.id);
  logger.info(SCOPE, `promoted first workspace ${first.id} — no usable active pointer at mount`);
}
