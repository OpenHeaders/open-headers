/**
 * Shared `isQuitting` flag. Read by the window-manager's close handler
 * (to decide hide-vs-destroy) and set by the tray's Quit menu / `app`'s
 * `before-quit` lifecycle event.
 */

let quitting = false;

export function isQuitting(): boolean {
  return quitting;
}

export function markQuitting(): void {
  quitting = true;
}
