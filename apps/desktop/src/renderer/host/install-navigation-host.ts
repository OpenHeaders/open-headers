/**
 * Boot-time wiring: install the desktop's `HostNavigation` adapter.
 *
 * Desktop is a single-window surface with no popup / side-panel duality
 * and no `chrome.tabs` to inspect. Every method collapses to a sensible
 * no-op or a fixed answer that the UI's fallback paths already handle:
 *
 *   - `switchViewMode` → `{ opened: false }`. There's nothing to switch
 *     to; the affordance hides itself when the UI sees this answer.
 *   - `currentWindowId` → `undefined`. The workspace navigator's
 *     same-window-tab preference is meaningless in single-window land;
 *     `undefined` is the documented "answer not available" value.
 *   - `activeTabUrl` / `getActiveTab` → `undefined` / `null`. Desktop
 *     has no browsing tab concept, so "this page" scoping never
 *     resolves.
 *   - `observeActiveTabContext` → no-op disposer. Nothing to observe.
 *   - `inspectedTabId` / `reloadInspectedTab` → DevTools-only; desktop
 *     never renders a DevTools panel surface.
 *   - `openUrl` / `openShortcutSettings` → fire-and-forget. Wire to
 *     Electron's `shell.openExternal` via IPC later when a UI gesture
 *     actually exercises them; for the first cut they no-op silently.
 *
 * Same install pattern as the browser-extension adapter; the contract
 * on the UI side is identical and the no-op shape is host-honest.
 */

import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';

const desktopHostNavigation: HostNavigation = {
  switchViewMode() {
    return Promise.resolve({ opened: false });
  },
  currentWindowId() {
    return Promise.resolve(undefined);
  },
  activeTabUrl() {
    return Promise.resolve(undefined);
  },
  openUrl() {
    // Wire to shell.openExternal via IPC when external-link affordances
    // get exercised. No-op for the first cut.
  },
  openShortcutSettings() {
    // No platform-standard shortcut customization surface for an
    // Electron app — defer to an in-app settings pane later.
  },
  getActiveTab() {
    return Promise.resolve(null);
  },
  observeActiveTabContext() {
    return () => {};
  },
  inspectedTabId() {
    return null;
  },
  reloadInspectedTab() {
    // DevTools panel surface only.
  },
  getInspectedHar() {
    // No `chrome.devtools.network` feed on desktop; the HAR export keeps its
    // own entries.
    return Promise.resolve(null);
  },
  openResource() {
    // No DevTools Sources-panel surface on desktop; call-stack frames
    // fall back to inline rendering.
  },
};

setHostNavigation(desktopHostNavigation);
