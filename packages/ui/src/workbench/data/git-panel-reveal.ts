/**
 * Git tool-window reveal intents — a Commit-window gesture (Compare
 * with Branch or Tag, Branches…) that lands in the Git window posts an
 * intent; the workbench shell activates the Git tool window. Tab-level
 * state (compare tabs, rail expansion) is applied by the poster
 * directly on the module-cached git-panel registry — only the dock
 * activation needs the shell (traffic-storage-reveal posture).
 */

const listeners = new Set<() => void>();

export function postGitPanelReveal(): void {
  for (const listener of listeners) listener();
}

/** Observe posts. Returns unsubscribe. */
export function subscribeGitPanelReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
