/**
 * Boot-time wiring: install the web tab's `HostNavigation` adapter.
 *
 * A plain browser tab has no popup / side-panel duality, no
 * `chrome.tabs` to inspect, and no DevTools panel surface. Every method
 * collapses to a sensible no-op or a fixed answer the UI's fallback
 * paths already handle — the same host-honest shape as the desktop
 * adapter, except `openUrl`, which a tab genuinely can do.
 */

import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';

const webHostNavigation: HostNavigation = {
  switchViewMode() {
    return Promise.resolve({ opened: false });
  },
  currentWindowId() {
    return Promise.resolve(undefined);
  },
  activeTabUrl() {
    return Promise.resolve(undefined);
  },
  openUrl(url) {
    window.open(url, '_blank', 'noopener');
  },
  openShortcutSettings() {
    // No browser-level shortcut surface a page may open.
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
    return Promise.resolve(null);
  },
  openResource() {
    // No DevTools Sources-panel surface in a plain tab; call-stack
    // frames fall back to inline rendering.
  },
};

setHostNavigation(webHostNavigation);
