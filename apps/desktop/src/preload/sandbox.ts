/**
 * Sandbox-window preload — the minimal IPC ⇄ postMessage bridge between
 * the main-process script broker and the sandboxed runner page
 * (`renderer/sandbox/sandbox-runner.ts`).
 *
 * The runner page is top-level, so both directions ride `window
 * .postMessage` on its own window: message events dispatch to listeners
 * in BOTH worlds (the page's main world and this isolated world), which
 * is the whole bridge — no `contextBridge` surface, nothing exposed to
 * the page beyond plain data messages.
 *
 * Routing is by the `type` tag: the runner emits `sandbox.ready` /
 * `script.result` / `script.host-request` (forwarded up to the broker
 * over IPC) and consumes `script.execute` / `script.host-response`
 * (forwarded down from the broker). The two sets are disjoint, so each
 * listener ignores the other direction's traffic — including its own
 * echoes on the shared window.
 */

import { ipcRenderer } from 'electron';

const SCRIPT_SANDBOX_UP_CHANNEL = 'oh:script-sandbox:up';
const SCRIPT_SANDBOX_DOWN_CHANNEL = 'oh:script-sandbox:down';

const UPWARD_TYPES = new Set(['sandbox.ready', 'script.result', 'script.host-request']);

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return;
  const data = ev.data as { type?: unknown } | null | undefined;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
  if (!UPWARD_TYPES.has(data.type)) return;
  ipcRenderer.send(SCRIPT_SANDBOX_UP_CHANNEL, data);
});

ipcRenderer.on(SCRIPT_SANDBOX_DOWN_CHANNEL, (_event, message: unknown) => {
  window.postMessage(message, '*');
});
