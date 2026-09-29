/**
 * Server Admin reveal intents — a gesture deep in an editor that lands
 * on an administration domain (the peer-execute refusal's "Open Server
 * Admin" on the served tab) posts a section; the workbench shell opens
 * that domain's tab and fronts the nav window the way the post-claim
 * landing does (`server-admin-landing.ts`), but LIVE: the landing is
 * parked before the mount and consumed once, this bus fires into a
 * mounted shell (the settings-reveal posture — a bridge broadcast never
 * reaches the page that sent it, so the same-page seam is a bus).
 */

import type { ServerAdminSection } from '../types';

const listeners = new Set<(section: ServerAdminSection) => void>();

export function postServerAdminReveal(section: ServerAdminSection): void {
  for (const listener of listeners) listener(section);
}

/** Observe posts. Returns unsubscribe. */
export function subscribeServerAdminReveal(listener: (section: ServerAdminSection) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
