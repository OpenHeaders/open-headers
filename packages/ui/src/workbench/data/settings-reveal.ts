/**
 * Settings reveal intents — a gesture deep in an editor that lands in
 * Settings (the place picker's "Open Backup and Sync" on a server whose
 * wire is down) posts a target; the workbench shell opens Settings on
 * it the way its own menus do (the git-panel-reveal posture). A bridge
 * broadcast never reaches the page that sent it — this bus is the
 * same-page seam.
 */

export interface SettingsRevealTarget {
  categoryId?: string;
  settingKey?: string;
}

const listeners = new Set<(target: SettingsRevealTarget) => void>();

export function postSettingsReveal(target: SettingsRevealTarget): void {
  for (const listener of listeners) listener(target);
}

/** Observe posts. Returns unsubscribe. */
export function subscribeSettingsReveal(listener: (target: SettingsRevealTarget) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
