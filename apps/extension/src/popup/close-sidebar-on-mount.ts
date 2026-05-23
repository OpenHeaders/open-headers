/**
 * Defensive cleanup: try to close the Firefox sidebar when the popup
 * mounts. The popup only opens when `action.setPopup` is bound, which
 * only happens in popup mode — so a sidebar visible at this moment is
 * stale state (Firefox's manifest-required `sidebar_action.default_panel`
 * can auto-open the sidebar on temp/initial install). Closing here
 * mirrors `sidepanel/self-close-if-popup-mode.ts` on the sidebar side.
 *
 * Caveat: Firefox's gesture model treats popup-script execution as
 * happening AFTER the toolbar click's user-input task, not within it.
 * `sidebarAction.close()` is gesture-bound and may reject (or, on some
 * versions, throw synchronously) — hence the belt-and-braces try/catch
 * wrapper around the whole module body. If Firefox refuses, the boot
 * reconciler on the sidebar side (which IS allowed from the sidebar's
 * own script) is the load-bearing close path; this one is best-effort.
 *
 * No-op on Chromium (no `sidebarAction` API).
 */

export {};

declare const browser: typeof chrome | undefined;

interface SidebarActionLike {
  close?: () => Promise<void>;
}

try {
  const root = typeof browser !== 'undefined' ? browser : chrome;
  const sidebar = (root as unknown as { sidebarAction?: SidebarActionLike }).sidebarAction ?? null;
  const closePromise = sidebar?.close?.();
  if (closePromise) closePromise.catch(() => {});
} catch {
  // Some Firefox versions throw synchronously on gesture-bound API
  // violations instead of rejecting the promise; swallow either form.
}
