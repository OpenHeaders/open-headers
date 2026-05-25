/**
 * Bridges the chrome-neutral parity debug hook (window.__OH_DUMP_PARITY_ROWS__)
 * to chrome.storage so the playground capture script can request a row dump
 * without attaching to this panel's iframe target directly.
 *
 * Active only when chrome.storage.local.__oh_parity_hook__ is true (set by
 * playground/scripts/capture-parity.mjs).
 */

export {};

declare global {
  interface Window {
    __OH_DUMP_PARITY_ROWS__?: () => unknown[];
    __OH_CLEAR_PARITY__?: () => void;
  }
}

interface ParityRequest {
  tabId: number;
  ts: number;
  action: 'dump' | 'clear';
}

function getInspectedTabId(): number | null {
  const devtools = (chrome as unknown as { devtools?: { inspectedWindow?: { tabId?: number } } }).devtools;
  const id = devtools?.inspectedWindow?.tabId;
  return typeof id === 'number' ? id : null;
}

const tabId = getInspectedTabId();
if (tabId != null && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes.__oh_parity_request__;
    if (!change) return;
    const req = change.newValue as ParityRequest | undefined;
    if (!req || req.tabId !== tabId) return;
    if (req.action === 'clear') {
      window.__OH_CLEAR_PARITY__?.();
      chrome.storage.local.set({ [`__oh_parity_ack_${tabId}__`]: { reqTs: req.ts, ok: true } });
      return;
    }
    const rows = window.__OH_DUMP_PARITY_ROWS__?.() ?? [];
    chrome.storage.local.set({ [`__oh_parity_dump_${tabId}__`]: { reqTs: req.ts, rows } });
  });
}
