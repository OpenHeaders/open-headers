/**
 * Test Widget — in-page floating panel that visualises a running test
 * session on the test tab itself.
 *
 * ## Architecture
 *
 * The widget is a self-contained function injected via
 * `chrome.scripting.executeScript({ func, args, world: 'ISOLATED' })`. It
 * mounts a Shadow-DOM host on the page so site CSS cannot bleed in, and
 * subscribes to its session via a long-lived `chrome.runtime.Port`.
 *
 * The port is the **only** background ↔ widget channel and was chosen over
 * `chrome.tabs.sendMessage` push because of the bind-time race: scope-rule
 * fires for the main_frame request are promoted by `tab-telemetry.onPageCommit`
 * BEFORE `executeScript` resolves, so any push-before-mount lands without a
 * listener and is silently dropped. With a port:
 *
 *   - The widget connects on mount via `chrome.runtime.connect({ name })`.
 *   - The background's `runtime.onConnect` handler (registered by
 *     `setupTestRunnerPorts` in test-runner) receives the connection,
 *     looks up the session, and immediately posts a `snapshot` containing
 *     the current `liveFireCount`. This message lands BEFORE any subsequent
 *     delta because port messages are strictly FIFO.
 *   - For every later in-scope fire, the test-runner posts an `update` to
 *     all live ports for that session.
 *   - At session end, the runner posts `finished` and `disconnect()`s.
 *
 * No state lives in `cfg` other than the initial render parameters
 * (label, count, wait, report URL, startedAt). The fires count is
 * authoritative on the background side.
 *
 * The injected function (`testWidgetFunc`) must be self-contained — it is
 * serialised via `Function.toString()` and runs in the page's ISOLATED
 * world with no access to module-level variables. Every value it needs is
 * passed in via the single `cfg` argument.
 */

import { logger } from '@utils/logger';

declare const browser: typeof chrome | undefined;

const browserAPI = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

/** Port name prefix the widget uses to connect — `oh-test-session:<sessionId>`. */
export const TEST_SESSION_PORT_PREFIX = 'oh-test-session:';

/** Build the port name for a given session. Inverse of `parseTestSessionPortName`. */
export function testSessionPortName(sessionId: string): string {
  return `${TEST_SESSION_PORT_PREFIX}${sessionId}`;
}

/** Extract the session id from a port name. Returns null for non-matching names. */
export function parseTestSessionPortName(name: string): string | null {
  if (!name.startsWith(TEST_SESSION_PORT_PREFIX)) return null;
  return name.slice(TEST_SESSION_PORT_PREFIX.length) || null;
}

/** Snapshot posted to a freshly-connected widget. */
export interface PortSnapshotMessage {
  type: 'snapshot';
  fires: number;
  /** Session phase at the moment of snapshot — usually 'capturing'. */
  phase: 'capturing' | 'done';
  /** When the session ended (only set if phase === 'done'). */
  finished?: PortFinishedPayload;
}

/** Live delta pushed for every in-scope fire. */
export interface PortUpdateMessage {
  type: 'update';
  fires: number;
}

/** Terminal payload pushed when the capture window closes. */
export interface PortFinishedPayload {
  fires: number;
  executed: number;
  noFire: number;
}

/** Wrapper around `PortFinishedPayload` for the port message envelope. */
export interface PortFinishedMessage extends PortFinishedPayload {
  type: 'finished';
}

export type PortMessage = PortSnapshotMessage | PortUpdateMessage | PortFinishedMessage;

/** Payload sent into the widget at injection time as the executeScript arg. */
export interface TestWidgetConfig {
  sessionId: string;
  scopeLabel: string;
  ruleCount: number;
  waitSeconds: number;
  /** Absolute URL of the workspace test-report page for this session. */
  reportUrl: string;
  /**
   * Wall-clock ms when the session started — the widget computes its
   * count-down against this so a re-injection mid-capture (e.g. user clicked
   * a link, page hard-navigated) shows the *real* remaining time, not a
   * fresh `waitSeconds` from zero.
   */
  startedAtMs: number;
  /** Port name the widget should use to connect to the background. */
  portName: string;
}

/**
 * Mount the widget on the given tab. Safe to call multiple times for the
 * same session — the widget self-dedupes via its host element id. Errors
 * (closed tab, restricted page, CSP weirdness) are swallowed and logged
 * because the widget is a UX nicety, not a correctness requirement.
 */
export async function injectTestWidget(tabId: number, config: TestWidgetConfig): Promise<void> {
  try {
    if (!browserAPI.scripting?.executeScript) {
      logger.info('TestWidget', 'scripting.executeScript unavailable — skipping widget injection');
      return;
    }
    await browserAPI.scripting.executeScript({
      target: { tabId },
      // Cast: executeScript serializes via Function.toString(); param shapes
      // are erased at runtime so the typed signature is purely advisory.
      func: testWidgetFunc as unknown as (cfg: unknown) => void,
      args: [config as unknown as Record<string, unknown>],
      // ISOLATED is the default, but spell it out so we don't drift into
      // the page realm if Chrome's defaults change.
      world: 'ISOLATED' as chrome.scripting.ExecutionWorld,
    });
    logger.debug('TestWidget', `Injected widget into tab ${tabId} (session ${config.sessionId})`);
  } catch (err) {
    const msg = (err as Error).message;
    if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
      logger.info('TestWidget', `Failed to inject widget into tab ${tabId}: ${msg}`);
    }
  }
}

// ── In-page function ────────────────────────────────────────────────
//
// Everything below this line runs in the test tab's ISOLATED world. It
// must not reference any imports, module-level state, or types from this
// file at runtime — Chrome serialises the function via toString() and
// rehydrates it in the page. Type annotations are erased by Vite/TS, so
// they're safe; values are not.
//
// The function is exported for unit testing.

interface InPageConfig {
  sessionId: string;
  scopeLabel: string;
  ruleCount: number;
  waitSeconds: number;
  reportUrl: string;
  startedAtMs: number;
  portName: string;
}

export function testWidgetFunc(cfg: InPageConfig): void {
  const HOST_ID = 'oh-test-session-widget-host';

  // Self-dedupe: a previous instance for this session may still be on the
  // page (e.g. background re-injected after a hard navigation during the
  // capture window). Run its cleanup hook so its message listener and
  // count-down interval are torn down before we mount a fresh instance.
  // The cleanup hook is stored on the host element itself.
  type HostWithCleanup = HTMLElement & { __ohTestCleanup?: () => void };
  const existing = document.getElementById(HOST_ID) as HostWithCleanup | null;
  if (existing) {
    try {
      existing.__ohTestCleanup?.();
    } catch {
      // No-op
    }
    existing.remove();
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  // `all: initial` resets every property the page might have inherited
  // onto our host element. The actual widget chrome lives inside a closed
  // shadow root so site CSS cannot reach it.
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'pointer-events: none',
  ].join(';');

  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .pill {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1f1f1f;
        color: #fff;
        border-radius: 14px;
        padding: 12px 14px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.06);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        line-height: 1.3;
        min-width: 280px;
        max-width: 380px;
        pointer-events: all;
        user-select: none;
        cursor: default;
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #1677ff;
        box-shadow: 0 0 10px #1677ff;
        animation: pulse 1.2s ease-in-out infinite;
        flex-shrink: 0;
      }
      .pill.done .dot {
        background: #52c41a;
        box-shadow: 0 0 10px #52c41a;
        animation: none;
      }
      .pill.error .dot {
        background: #ff4d4f;
        box-shadow: 0 0 10px #ff4d4f;
        animation: none;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.85); }
      }
      .info { flex: 1; min-width: 0; }
      .title {
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sub {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.65);
        margin-top: 3px;
      }
      .actions { display: flex; gap: 6px; align-items: center; }
      button {
        all: unset;
        background: #1677ff;
        color: #fff;
        padding: 7px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease;
        font-family: inherit;
      }
      button:hover { background: #4096ff; }
      button.ghost {
        background: transparent;
        color: rgba(255, 255, 255, 0.5);
        padding: 6px 8px;
        font-size: 16px;
        line-height: 1;
        border-radius: 6px;
      }
      button.ghost:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }
      button.primary { display: none; }
      .pill.done button.primary { display: inline-block; }
    </style>
    <div class="pill" part="pill">
      <span class="dot"></span>
      <div class="info">
        <div class="title" id="oh-title"></div>
        <div class="sub" id="oh-sub"></div>
      </div>
      <div class="actions">
        <button class="primary" id="oh-primary">View results</button>
        <button class="ghost" id="oh-dismiss" title="Dismiss">×</button>
      </div>
    </div>
  `;

  (document.documentElement || document.body).appendChild(host);

  const pill = shadow.querySelector('.pill') as HTMLElement;
  const titleEl = shadow.getElementById('oh-title') as HTMLElement;
  const subEl = shadow.getElementById('oh-sub') as HTMLElement;
  const primaryBtn = shadow.getElementById('oh-primary') as HTMLButtonElement;
  const dismissBtn = shadow.getElementById('oh-dismiss') as HTMLButtonElement;

  let phase: 'capturing' | 'done' = 'capturing';
  let fires = 0;
  let executed = 0;
  let noFire = 0;

  const computeRemaining = (): number =>
    Math.max(0, cfg.waitSeconds - Math.floor((Date.now() - cfg.startedAtMs) / 1000));

  let remaining = computeRemaining();

  const ruleWord = (n: number) => `${n} rule${n === 1 ? '' : 's'}`;
  const fireWord = (n: number) => `${n} fire${n === 1 ? '' : 's'}`;

  function render() {
    if (phase === 'capturing') {
      titleEl.textContent = `Testing ${cfg.scopeLabel}`;
      subEl.textContent = `Capturing ${remaining}s · ${fireWord(fires)} · ${ruleWord(cfg.ruleCount)} in scope`;
    } else {
      pill.classList.add('done');
      titleEl.textContent = 'Test complete';
      subEl.textContent = `${executed}/${cfg.ruleCount} executed · ${fireWord(fires)}${
        noFire > 0 ? ` · ${noFire} no-fire` : ''
      }`;
    }
  }

  // Count-down ticker. We tick every 250ms but only redraw when the visible
  // second changes — keeps the DOM updates cheap. Computing against
  // `cfg.startedAtMs` (not local `Date.now()`) means a re-injection during
  // the capture window picks up the right remaining time instead of resetting.
  let lastDrawnRemaining = remaining;
  const tickHandle = setInterval(() => {
    if (phase !== 'capturing') return;
    const next = computeRemaining();
    if (next !== lastDrawnRemaining) {
      lastDrawnRemaining = next;
      remaining = next;
      render();
    }
  }, 250);

  // Connect to the background's port for this session. The background's
  // `runtime.onConnect` handler (in test-runner) responds with a `snapshot`
  // immediately, then streams `update` and `finished` messages over the
  // same FIFO channel. Snapshot-then-deltas eliminates the bind-time race
  // that a fire-and-forget `tabs.sendMessage` push would have, because the
  // background only knows the widget exists *after* the port has connected.
  let port: chrome.runtime.Port | null = null;
  try {
    port = chrome.runtime.connect({ name: cfg.portName });
  } catch {
    // No background channel — the widget will still show the count-down
    // but live counts won't update. Better than crashing.
  }

  function handlePortMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const msg = message as {
      type?: string;
      fires?: number;
      executed?: number;
      noFire?: number;
      phase?: 'capturing' | 'done';
      finished?: { fires: number; executed: number; noFire: number };
    };
    if (msg.type === 'snapshot') {
      fires = msg.fires ?? 0;
      if (msg.phase === 'done' && msg.finished) {
        fires = msg.finished.fires;
        executed = msg.finished.executed;
        noFire = msg.finished.noFire;
        phase = 'done';
      }
      render();
    } else if (msg.type === 'update') {
      fires = msg.fires ?? fires;
      render();
    } else if (msg.type === 'finished') {
      fires = msg.fires ?? fires;
      executed = msg.executed ?? 0;
      noFire = msg.noFire ?? 0;
      phase = 'done';
      render();
    }
  }

  if (port) {
    port.onMessage.addListener(handlePortMessage);
    // If the background drops the port (extension reload, session ended
    // and runner closed the port), do nothing — the widget keeps showing
    // its last known state. The user can still dismiss it.
    port.onDisconnect.addListener(() => {
      port = null;
    });
  }

  function cleanup() {
    clearInterval(tickHandle);
    if (port) {
      try {
        port.disconnect();
      } catch {
        // No-op
      }
      port = null;
    }
    if (host.parentNode) host.remove();
  }

  // Stash the cleanup on the host so a future re-injection from this
  // session (or a different one) can tear us down deterministically.
  (host as HTMLElement & { __ohTestCleanup?: () => void }).__ohTestCleanup = cleanup;

  primaryBtn.addEventListener('click', () => {
    // Navigate the test tab itself to the workspace report. Same-tab
    // navigation is intentional: the user is done with the page and
    // wants to see the analysis.
    try {
      window.location.href = cfg.reportUrl;
    } catch {
      window.open(cfg.reportUrl, '_blank');
    }
  });

  dismissBtn.addEventListener('click', () => {
    cleanup();
  });

  render();
}
