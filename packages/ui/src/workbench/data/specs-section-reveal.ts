/**
 * Specs-section reveal intents — a request editor's Spec tab, finding
 * no spec of its format in the workspace, sends the user to where one
 * gets created: the sidebar's SPECS section. The tab posts an intent;
 * the workbench shell activates the API Requests tool window and opens
 * the section (git-panel-reveal posture — nothing to consume, the
 * shell only navigates).
 */

const listeners = new Set<() => void>();

export function postSpecsSectionReveal(): void {
  for (const listener of listeners) listener();
}

/** Observe posts. Returns unsubscribe. */
export function subscribeSpecsSectionReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
