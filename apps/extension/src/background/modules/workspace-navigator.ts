/**
 * Workspace Navigator — the SW-hosted dispatcher for cross-surface
 * `WorkspaceIntent`s (see packages/core/src/workspace-intent/ + Phase 9
 * of docs/V5_FOUNDATION_PLAN.md).
 *
 * Entry point: {@link openWorkspaceIntent} handles the RPC. Pure helper
 * {@link selectTargetTab} picks the best existing workspace tab (if
 * any) given the caller's window — same-window preference; cross-window
 * falls through to the cold path rather than yanking the user across
 * Chrome windows.
 *
 * Two code paths once the target is known:
 *   • **Warm** — activate the target tab + focus its window + deliver
 *     the intent via `chrome.tabs.sendMessage`. One retry after 150 ms
 *     covers the fresh-boot case where the renderer's intent listener
 *     hasn't mounted yet; if that still fails, we fall back to
 *     `tabs.update({ url })` so the tab's cold-path router picks up the
 *     intent on the next load.
 *   • **Cold** — `chrome.tabs.create` with the intent encoded as a URL
 *     hash. The fresh tab decodes it on mount via `useWorkspaceIntentRouter`.
 *
 * Every dispatch records one observability entry (subsystem: `workspace`)
 * with the intent kind + path taken, so "which tab got the intent" is
 * triage-visible in exported logs.
 */

import type { IntentCallerContext, WorkspaceIntent } from '@openheaders/core/workspace-intent';
import { boundIntentToHash, hashToBoundIntent, parseIntent } from '@openheaders/core/workspace-intent';
import { getBrowserAPI } from '@/types/browser';
import { recordLog } from './observability-log';
import { ordinalForTab } from './workspace-tab-registry';

/** Path of the workspace HTML file in the packed extension. */
const WORKBENCH_HTML = 'workbench.html';

/** How long to wait before retrying sendMessage once. */
const SEND_MESSAGE_RETRY_MS = 150;

export type NavigatorPath = 'warm' | 'warm-fallback' | 'cold';

export type NavigatorResult =
  | { ok: true; tabId: number; windowId?: number; path: NavigatorPath }
  | { ok: false; reason: string };

/**
 * Pure selector — picks the best target tab from a candidate list.
 *
 * Filtering applies in this order:
 *   1. **Workspace match.** When `callerWorkspaceId` is set, drop tabs
 *      whose URL hash binds them to a different workspace. Tabs without
 *      a `/ws/<wsId>/` prefix (legacy bookmarks) are kept — they bind
 *      to whatever the workbench resolves on mount, and rebinding via
 *      a warm-path intent dispatch is an acceptable UX (the tab gets
 *      "claimed" by the popup's active workspace). Tabs whose `/ws/<wsId>/`
 *      prefix points at a different workspace are dropped — sending an
 *      intent there would either cross-bind the tab or get rejected by
 *      the renderer's per-tab guard.
 *   2. **Same-window preference.** Cross-window tabs are deliberately
 *      ignored: if the caller's window has no workspace tab matching
 *      the workspace filter, we return null so the dispatcher opens a
 *      new one in the caller's window instead of yanking focus to
 *      another Chrome window.
 *   3. **Active tab > recency > id.** Within the caller's window.
 *
 * Exported for unit testing — the full dispatcher is harder to cover
 * without mocking every chrome.* API, but this selector is the piece
 * with the actual policy logic.
 */
export function selectTargetTab(
  tabs: readonly chrome.tabs.Tab[],
  context: IntentCallerContext,
): chrome.tabs.Tab | null {
  if (tabs.length === 0) return null;

  const callerWindowId = context.callerWindowId;
  const callerWorkspaceId = context.callerWorkspaceId;

  const workspaceMatched = callerWorkspaceId
    ? tabs.filter((t) => {
        const bound = boundWorkspaceForTab(t);
        // Keep legacy (no binding) and exact-match tabs; drop mismatches.
        return bound === undefined || bound === callerWorkspaceId;
      })
    : tabs;
  if (workspaceMatched.length === 0) return null;

  // Caller window unknown — fall back to a deterministic pick across
  // all workspace tabs. This path is rare; in practice surfaces should
  // always pass a callerWindowId via `windows.getCurrent()`.
  if (callerWindowId === undefined) {
    return pickByRecencyThenId(workspaceMatched);
  }

  // Same-window preference.
  const sameWindow = workspaceMatched.filter((t) => t.windowId === callerWindowId);
  if (sameWindow.length === 0) return null;

  // Within the caller's window: prefer the active tab first (user is
  // already looking at it), otherwise by recency + id.
  const active = sameWindow.find((t) => t.active);
  if (active) return active;
  return pickByRecencyThenId(sameWindow);
}

/**
 * Extract the `/ws/<wsId>/` binding from a tab's URL hash, or undefined
 * if the tab has no such prefix (legacy bookmark / freshly-created bare
 * `workbench.html`). Returns undefined on parse failure rather than
 * throwing — the navigator's filter treats undefined as "no opinion."
 */
function boundWorkspaceForTab(tab: chrome.tabs.Tab): string | undefined {
  const url = tab.url;
  if (typeof url !== 'string') return undefined;
  const hashStart = url.indexOf('#');
  if (hashStart === -1) return undefined;
  const bound = hashToBoundIntent(url.slice(hashStart));
  return bound?.workspaceId;
}

function pickByRecencyThenId(tabs: readonly chrome.tabs.Tab[]): chrome.tabs.Tab {
  let best: chrome.tabs.Tab = tabs[0];
  let bestAccessed = accessedAt(best);
  for (let i = 1; i < tabs.length; i++) {
    const t = tabs[i];
    const ta = accessedAt(t);
    if (ta > bestAccessed) {
      best = t;
      bestAccessed = ta;
      continue;
    }
    if (ta === bestAccessed && tabIdOrMax(t) < tabIdOrMax(best)) {
      best = t;
    }
  }
  return best;
}

function accessedAt(t: chrome.tabs.Tab): number {
  // `lastAccessed` is a Chrome 121+ property; may be missing in older
  // browsers or in tests. Treat missing as oldest possible.
  const raw = (t as { lastAccessed?: number }).lastAccessed;
  return typeof raw === 'number' ? raw : 0;
}

function tabIdOrMax(t: chrome.tabs.Tab): number {
  return typeof t.id === 'number' ? t.id : Number.MAX_SAFE_INTEGER;
}

/**
 * Dispatch a `WorkspaceIntent` — focus-or-create the workspace tab and
 * deliver the intent. The `raw` parameter is intentionally typed
 * `unknown` so the schema boundary is the only thing between a caller
 * payload and an in-memory intent — malformed values are rejected here
 * rather than crashing downstream.
 */
export async function openWorkspaceIntent(raw: unknown, context: IntentCallerContext = {}): Promise<NavigatorResult> {
  const intent = parseIntent(raw);
  if (!intent) {
    recordLog({
      subsystem: 'workspace',
      op: 'navigator/reject',
      level: 'warn',
      message: 'Rejected malformed intent',
      context: {},
    });
    return { ok: false, reason: 'invalid-intent' };
  }

  const workspaceUrl = getBrowserAPI().runtime.getURL(WORKBENCH_HTML);

  let candidates: chrome.tabs.Tab[];
  try {
    // `query` matches substrings with `*` at the end, so this catches
    // both `workbench.html` and `workbench.html#/...` variants.
    candidates = await queryTabs({ url: `${workspaceUrl}*` });
  } catch (err) {
    return failLogged(intent, 'query-failed', err);
  }

  const target = selectTargetTab(candidates, context);
  if (target === null || typeof target.id !== 'number') {
    return coldPath(intent, workspaceUrl, context.callerWorkspaceId);
  }
  return warmPath(intent, target, workspaceUrl, context.callerWorkspaceId);
}

async function warmPath(
  intent: WorkspaceIntent,
  target: chrome.tabs.Tab,
  workspaceUrl: string,
  callerWorkspaceId: string | undefined,
): Promise<NavigatorResult> {
  const tabId = target.id as number; // narrowed by caller
  const windowId = target.windowId;

  // Activate + focus first; if this fails (tab disappeared between
  // query and update — a real race on fast tab-close), we still try
  // delivery so the caller sees a clean failure instead of a split
  // state.
  try {
    await updateTab(tabId, { active: true });
    if (typeof windowId === 'number') {
      await updateWindow(windowId, { focused: true });
    }
  } catch (err) {
    recordLog({
      subsystem: 'workspace',
      op: 'navigator/activate-failed',
      level: 'warn',
      message: formatError(err),
      context: { errorClass: errorClassOf(err) },
    });
  }

  // Deliver the intent with one retry to cover fresh-boot timing
  // (renderer's onMessage listener mounts a few frames after the tab
  // creates). If delivery still fails, fall back to URL navigation —
  // the tab's cold-path router will pick the intent up on reload.
  const delivered = await tryDeliverIntent(tabId, intent);
  if (delivered) {
    recordLog({
      subsystem: 'workspace',
      op: 'navigator/delivered',
      level: 'info',
      message: `warm · ${intent.kind}${ordinalSuffix(tabId)}`,
      context: {},
    });
    return { ok: true, tabId, windowId, path: 'warm' };
  }

  try {
    await updateTab(tabId, { url: workspaceUrl + boundIntentToHash({ workspaceId: callerWorkspaceId, intent }) });
  } catch (err) {
    return failLogged(intent, 'fallback-failed', err);
  }
  recordLog({
    subsystem: 'workspace',
    op: 'navigator/fallback',
    level: 'info',
    message: `warm→cold · ${intent.kind}`,
    context: {},
  });
  return { ok: true, tabId, windowId, path: 'warm-fallback' };
}

async function coldPath(
  intent: WorkspaceIntent,
  workspaceUrl: string,
  callerWorkspaceId: string | undefined,
): Promise<NavigatorResult> {
  const url = workspaceUrl + boundIntentToHash({ workspaceId: callerWorkspaceId, intent });
  let tab: chrome.tabs.Tab;
  try {
    tab = await createTab({ url, active: true });
  } catch (err) {
    return failLogged(intent, 'create-failed', err);
  }
  if (typeof tab.id !== 'number') {
    return failLogged(intent, 'create-missing-id', new Error('tabs.create returned no id'));
  }
  recordLog({
    subsystem: 'workspace',
    op: 'navigator/created',
    level: 'info',
    message: `cold · ${intent.kind}${ordinalSuffix(tab.id)}`,
    context: {},
  });
  return { ok: true, tabId: tab.id, windowId: tab.windowId, path: 'cold' };
}

async function tryDeliverIntent(tabId: number, intent: WorkspaceIntent): Promise<boolean> {
  // Two attempts. If the first fails because the renderer hasn't
  // mounted its intent listener yet (fresh-tab boot race), wait a
  // single frame-equivalent and try again.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sendMessageToTab(tabId, { type: 'workspace-intent', intent });
      return true;
    } catch (err) {
      // Chrome surfaces "The message port closed before a response was
      // received" whenever a listener fires synchronously and does not
      // call `sendResponse`. Our renderer uses `bridge.subscribe`
      // (pub-sub, no response) to consume workspace intents, so this
      // IS the normal success signature — the message WAS delivered,
      // the channel just closed without a reply. Treat it as success
      // to avoid a needless warm→cold fallback on every dispatch.
      if (isChannelClosedError(err)) return true;
      if (attempt === 0) {
        await sleep(SEND_MESSAGE_RETRY_MS);
      }
    }
  }
  return false;
}

function isChannelClosedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /message port closed|message channel (?:closed|is closed)/i.test(msg);
}

function failLogged(intent: WorkspaceIntent, reason: string, err: unknown): NavigatorResult {
  recordLog({
    subsystem: 'workspace',
    op: `navigator/${reason}`,
    level: 'error',
    message: `${intent.kind} · ${formatError(err)}`,
    context: { errorClass: errorClassOf(err) },
  });
  return { ok: false, reason };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorClassOf(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ` · #<ordinal>` suffix for the structured log, or empty string
 * when the registry hasn't yet assigned an ordinal (cold-path race
 * with the `tabs.onCreated` listener — the listener may not have
 * fired by the time `tabs.create` resolves).
 */
function ordinalSuffix(tabId: number | undefined): string {
  if (typeof tabId !== 'number') return '';
  const ordinal = ordinalForTab(tabId);
  return ordinal === null ? '' : ` · #${ordinal}`;
}

// ── Chrome API wrappers ─────────────────────────────────────────────
//
// MV3 Chrome 128+ and target Firefox versions both support promise-
// returning tabs/windows APIs when called without a callback. Keep
// the wrappers narrow so tests can stub exactly what the navigator
// uses without pulling in the whole cross-browser shim.

function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    const api = getBrowserAPI();
    try {
      const maybe = (api.tabs.query as unknown as (q: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>)(queryInfo);
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        maybe.then(resolve, reject);
        return;
      }
    } catch {
      // Callback-style below.
    }
    api.tabs.query(queryInfo, (tabs: chrome.tabs.Tab[]) => {
      const lastError = api.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'tabs.query failed'));
      else resolve(tabs);
    });
  });
}

function updateTab(tabId: number, props: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    const api = getBrowserAPI();
    try {
      const maybe = (
        api.tabs.update as unknown as (
          id: number,
          p: chrome.tabs.UpdateProperties,
        ) => Promise<chrome.tabs.Tab | undefined>
      )(tabId, props);
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        maybe.then(resolve, reject);
        return;
      }
    } catch {
      // Callback-style below.
    }
    api.tabs.update(tabId, props, (tab?: chrome.tabs.Tab) => {
      const lastError = api.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'tabs.update failed'));
      else resolve(tab);
    });
  });
}

function createTab(props: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    const api = getBrowserAPI();
    try {
      const maybe = (api.tabs.create as unknown as (p: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>)(
        props,
      );
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        maybe.then(resolve, reject);
        return;
      }
    } catch {
      // Callback-style below.
    }
    api.tabs.create(props, (tab: chrome.tabs.Tab) => {
      const lastError = api.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'tabs.create failed'));
      else resolve(tab);
    });
  });
}

function sendMessageToTab(tabId: number, message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const api = getBrowserAPI();
    const sendMessage = api.tabs.sendMessage as unknown as (
      id: number,
      msg: unknown,
      cb?: (response: unknown) => void,
      // biome-ignore lint/suspicious/noConfusingVoidType: Chrome API returns void in callback-style; we check for Promise at runtime.
    ) => Promise<unknown> | void;
    try {
      const maybe = sendMessage(tabId, message);
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        (maybe as Promise<unknown>).then(resolve, reject);
        return;
      }
    } catch {
      // Callback-style below.
    }
    sendMessage(tabId, message, (response: unknown) => {
      const lastError = api.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'tabs.sendMessage failed'));
      else resolve(response);
    });
  });
}

interface WindowsApi {
  // biome-ignore lint/suspicious/noConfusingVoidType: Chrome API returns void in callback-style; we branch at runtime.
  update?: (windowId: number, props: { focused?: boolean }) => Promise<chrome.windows.Window> | void;
}

function updateWindow(windowId: number, props: { focused?: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    const api = getBrowserAPI() as unknown as {
      windows?: WindowsApi;
      runtime: { lastError?: chrome.runtime.LastError };
    };
    const windows = api.windows;
    if (!windows?.update) {
      // Firefox popup-override extensions may not expose `windows` in
      // all contexts — swallow gracefully; focus-steal is a nice-to-
      // have, the activation above is what actually matters.
      resolve();
      return;
    }
    try {
      const maybe = windows.update(windowId, props);
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        (maybe as Promise<unknown>).then(() => resolve(), reject);
        return;
      }
    } catch (err) {
      reject(err);
      return;
    }
    // Callback-less browsers: assume success.
    const lastError = api.runtime.lastError;
    if (lastError) reject(new Error(lastError.message ?? 'windows.update failed'));
    else resolve();
  });
}
