/**
 * Sidebar self-close on mount when stored mode is popup.
 *
 * Firefox's manifest schema *requires* `sidebar_action.default_panel`,
 * and on temp install (or initial install) Firefox auto-opens whatever
 * is at that path — there's no manifest flag to suppress this. The SW
 * can't close the sidebar from its boot path either: Firefox's
 * `sidebarAction.close()` is restricted to user-gesture handlers OR
 * the sidebar's own script context. THIS module runs in that script
 * context, so it's the one place a non-gesture close is legal.
 *
 * The check happens before React mounts. There's a brief frame where
 * the sidebar may be visible — Firefox temp-install behavior we can't
 * fully eliminate without the manifest schema growing a suppress flag.
 *
 * Chromium's `side_panel.default_path` does not auto-open, so this
 * module is a no-op there.
 */

// Read chrome.storage.sync directly with the literal key rather than going
// through `@openheaders/core/storage`. That abstraction needs
// `install-host-storage` to have registered the chrome backend first, and
// this module runs before any of the install-* host modules — pulling in
// hostStorage here would silently get an unregistered backend and the
// close would never fire. The key string is intentionally duplicated from
// `packages/core/src/storage/keys.ts` (`viewMode: 'oh.viewMode'`).

export {};

declare const browser: typeof chrome | undefined;

interface SidebarActionLike {
  close?: () => Promise<void>;
}

// Firefox exposes the Mozilla-native `browser.*` namespace; on Chromium
// it's undefined and the code falls back to `chrome.*`. Both
// `storage.sync` and `sidebarAction` come from the same root — using
// the resolved root keeps the Firefox intent explicit even though
// Firefox MV3 also aliases `chrome.*` for compatibility.
const root = typeof browser !== 'undefined' ? browser : chrome;

function getSidebarAction(): SidebarActionLike | null {
  const api = root as unknown as { sidebarAction?: SidebarActionLike };
  return api.sidebarAction ?? null;
}

const VIEW_MODE_KEY = 'oh.viewMode';

void (async () => {
  const sidebar = getSidebarAction();
  if (!sidebar?.close) return;
  try {
    const result = await root.storage.sync.get([VIEW_MODE_KEY]);
    const mode = result[VIEW_MODE_KEY] ?? 'popup';
    if (mode === 'popup') {
      await sidebar.close();
    }
  } catch {
    // Best-effort; sidebar stays open and the user closes manually.
  }
})();
