/**
 * The post-claim landing — where the first arrival after a server's
 * claim lands.
 *
 * The browser that claims a server is its operator's, and the operator's
 * next job is the directory: add the people who will use it, hand out
 * the first roles. So the claim's way into the Workbench lands on Server
 * Admin › Users instead of the workspace home — the Users tab doubles as
 * the claim's receipt (the admin sees their own row, Server admin on,
 * Owner on the workspace) and its Add user form is the next step itself.
 *
 * The host parks the landing before it mounts the Workbench (the claim
 * is the only poster); the shell consumes it exactly once, after the
 * admin probe has let the Server Admin window into the layout. A later
 * sign-in parks nothing and lands on the workspace as before — the
 * claim is one-shot by state, so no stored latch is needed.
 */

import type { ServerAdminSection } from '../types';

let pending: ServerAdminSection | null = null;

/** Park the landing — the next Workbench mount opens this section. */
export function postServerAdminLanding(section: ServerAdminSection = 'users'): void {
  pending = section;
}

/** Consume the parked landing (once). */
export function takeServerAdminLanding(): ServerAdminSection | null {
  const taken = pending;
  pending = null;
  return taken;
}
