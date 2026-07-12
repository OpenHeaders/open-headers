/**
 * Chrome adapter for the **browser-scoped target plane** (JS contexts
 * Phase B) — service-worker targets reached by `chrome.debugger.attach
 * ({targetId})`, which a per-tab attach can never see (they are not
 * children of any tab target). Sibling of {@link ChromeDebuggerEventSource}
 * with the same posture: the only other place that names
 * `chrome.debugger.*`, inert without the namespace, consumed through
 * narrow seams.
 *
 * Discovery is a **pull**: `chrome.debugger.getTargets()` enumerates all
 * debuggable targets; `Target.setDiscoverTargets` is rejected ("Not
 * allowed") on a `chrome.debugger` session, so there is no push channel —
 * the reconciler polls. A service worker in that enumeration is
 * `type: 'worker'` whose title carries the `Service Worker` prefix (the
 * only field that separates it from a page's dedicated workers, which the
 * tab plane already auto-attaches); it carries NO `tabId`, so ownership is
 * resolved by origin match, not by the enumeration.
 *
 * An attached target gets `Runtime.enable` + `Log.enable` only —
 * contexts, console and browser log. Network capture from SW targets is an
 * explicit non-goal of this plane. Events carry no `tabId`; they are
 * keyed by the synthetic session `target:<targetId>` and fanned per owning
 * tab downstream (`browser-target-fanout`).
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { type JsContext, jsContextKey } from '@openheaders/core/js-contexts';
import { logger } from '@utils/logger';
import { type BrowserAPI, getBrowserAPI } from '@/types/browser';
import {
  normalizeBrowserTargetContextCreated,
  normalizeConsoleApiCalled,
  normalizeExceptionThrown,
  normalizeLogEntryAdded,
} from './cdp-normalizers';
import type {
  RawConsoleApiCalled,
  RawExceptionThrown,
  RawExecutionContextCreated,
  RawExecutionContextDestroyed,
  RawLogEntryAdded,
} from './cdp-raw-payloads';

/**
 * Synthetic session key for a browser-scoped target's events — the target
 * plane's counterpart of the tab plane's `ROOT_SESSION_ID` / child session
 * ids. Stamped into `contextKey` and `ConsoleEntry.contextKey`, so consumers
 * join across planes without knowing which one produced the entry.
 */
export function browserTargetSessionKey(targetId: string): string {
  return `target:${targetId}`;
}

/** One discovered service-worker target — the reconciler's work unit. */
export interface BrowserTargetDescriptor {
  readonly targetId: string;
  /** The worker script URL (including its query). */
  readonly url: string;
}

/**
 * Engine-input event for the target plane's context registry — the
 * target-keyed mirror of the tab plane's `CdpJsContextEvent`. A target has
 * exactly one session, so session-level and target-level teardown coincide:
 * `target-cleared` covers both `Runtime.executionContextsCleared` and the
 * attachment ending.
 */
export type BrowserTargetJsContextEvent =
  | { kind: 'context-created'; targetId: string; context: JsContext }
  | { kind: 'context-destroyed'; targetId: string; contextKey: string }
  | { kind: 'target-cleared'; targetId: string };

type ContextsListener = (event: BrowserTargetJsContextEvent) => void;
type ConsoleListener = (targetId: string, entry: ConsoleEntry) => void;
type DetachListener = (targetId: string, reason: string) => void;
type DebuggerApi = BrowserAPI['debugger'];

/** Protocol version handed to `chrome.debugger.attach`. */
const CDP_PROTOCOL_VERSION = '1.3';

/**
 * The `getTargets()` title prefix that separates a service worker from a
 * page's dedicated workers — both enumerate as `type: 'worker'` and the
 * entry carries no other discriminator (verified live, Phase B spike).
 */
const SERVICE_WORKER_TITLE_PREFIX = 'Service Worker ';

export class ChromeBrowserTargetSource {
  private readonly contextsListeners = new Set<ContextsListener>();
  private readonly consoleListeners = new Set<ConsoleListener>();
  private readonly detachListeners = new Set<DetachListener>();
  /** Targets we hold a `chrome.debugger` attachment for. */
  private readonly attachedTargets = new Set<string>();
  private readonly removeListeners: Array<() => void> = [];

  constructor() {
    this.install();
  }

  /**
   * Enumerate the debuggable service-worker targets on http(s) origins.
   * Our own extension worker and other extensions' enumerate too
   * (`chrome-extension://`) — never candidates.
   */
  async discoverServiceWorkers(): Promise<BrowserTargetDescriptor[]> {
    const api = this.api();
    if (!api) return [];
    const targets = await api.getTargets();
    return targets
      .filter(
        (t) =>
          t.type === 'worker' &&
          t.title.startsWith(SERVICE_WORKER_TITLE_PREFIX) &&
          (t.url.startsWith('https://') || t.url.startsWith('http://')),
      )
      .map((t) => ({ targetId: t.id, url: t.url }));
  }

  /**
   * Attach to a service-worker target and enable its Runtime + Log domains.
   * The enable replays the target's live contexts as `executionContextCreated`
   * and buffered console output as `consoleAPICalled` — self-seeding, no
   * snapshot pull. Idempotent for a live target; tolerant of the
   * "already attached" race (a re-attach after SW wake). Rejects on a real
   * failure so the reconciler never marks an unestablished attachment.
   */
  async attach(targetId: string): Promise<void> {
    const api = this.api();
    if (!api) return;
    if (this.attachedTargets.has(targetId)) return;
    try {
      await api.attach({ targetId }, CDP_PROTOCOL_VERSION);
    } catch (err) {
      if (!isAlreadyAttached(err)) {
        logger.warn('BrowserTargetSource', 'debugger.attach failed', { targetId, error: errorMessage(err) });
        throw err instanceof Error ? err : new Error(errorMessage(err));
      }
    }
    this.attachedTargets.add(targetId);
    await this.send(targetId, 'Runtime.enable');
    await this.send(targetId, 'Log.enable');
  }

  /**
   * Detach from a target. The context set is live state that dies with the
   * attachment, so `target-cleared` fans before the chrome handshake.
   * Tolerant of "not attached" (the target may have died underneath us).
   */
  async detach(targetId: string): Promise<void> {
    const api = this.api();
    if (!api) return;
    this.attachedTargets.delete(targetId);
    this.fanContexts({ kind: 'target-cleared', targetId });
    try {
      await api.detach({ targetId });
    } catch (err) {
      if (!isNotAttached(err)) {
        logger.warn('BrowserTargetSource', 'debugger.detach failed', { targetId, error: errorMessage(err) });
      }
    }
  }

  /**
   * Control-plane seam — issue one CDP command on an attached target and
   * return its raw result (the target plane's `sendOnSession` counterpart;
   * the console REPL evaluates in SW contexts through here). Rejects on an
   * absent transport; surfaces command errors to the caller, which owns
   * the tolerance decision.
   */
  async sendOnTarget(targetId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const api = this.api();
    if (!api) throw new Error('CDP transport unavailable');
    return api.sendCommand({ targetId }, method, params);
  }

  /** Context-registry events for attached targets (target-keyed). */
  subscribeContexts(listener: ContextsListener): () => void {
    this.contextsListeners.add(listener);
    return () => {
      this.contextsListeners.delete(listener);
    };
  }

  /** Console output + browser log entries from attached targets (target-keyed). */
  subscribeConsole(listener: ConsoleListener): () => void {
    this.consoleListeners.add(listener);
    return () => {
      this.consoleListeners.delete(listener);
    };
  }

  /** Chrome-initiated detach of one of our targets (target died, user cancel). */
  onDetach(listener: DetachListener): () => void {
    this.detachListeners.add(listener);
    return () => {
      this.detachListeners.delete(listener);
    };
  }

  /** Remove chrome listeners + detach every live target. Tests / SW shutdown. */
  dispose(): void {
    for (const off of this.removeListeners) off();
    this.removeListeners.length = 0;
    for (const targetId of [...this.attachedTargets]) void this.detach(targetId);
    this.contextsListeners.clear();
    this.consoleListeners.clear();
    this.detachListeners.clear();
    this.attachedTargets.clear();
  }

  // ── install / chrome event binding ────────────────────────────────

  private install(): void {
    const api = this.api();
    if (!api) {
      logger.info('BrowserTargetSource', 'chrome.debugger unavailable; browser-target source inert');
      return;
    }
    const onEvent = (source: chrome.debugger.DebuggerSession, method: string, params?: object): void => {
      this.handleEvent(source, method, params);
    };
    const onDetach = (source: chrome.debugger.Debuggee, reason: string): void => {
      this.handleDetach(source, reason);
    };
    api.onEvent.addListener(onEvent);
    api.onDetach.addListener(onDetach);
    this.removeListeners.push(
      () => api.onEvent.removeListener(onEvent),
      () => api.onDetach.removeListener(onDetach),
    );
  }

  // ── event routing ─────────────────────────────────────────────────

  private handleEvent(source: chrome.debugger.DebuggerSession, method: string, params?: object): void {
    // Only events on a target debuggee we attached; tab-session events carry
    // `tabId` and belong to the tab plane's adapter.
    const targetId = source.targetId;
    if (targetId === undefined || source.tabId !== undefined || !this.attachedTargets.has(targetId)) return;
    const sessionKey = browserTargetSessionKey(targetId);

    if (method === 'Runtime.executionContextsCleared') {
      // No parameters on the wire — dispatch before the params gate. A target
      // has one session, so a session clear is a whole-target clear.
      this.fanContexts({ kind: 'target-cleared', targetId });
      return;
    }
    if (params === undefined) return;
    if (method === 'Runtime.executionContextCreated') {
      this.fanContexts({
        kind: 'context-created',
        targetId,
        context: normalizeBrowserTargetContextCreated(
          sessionKey,
          'service-worker',
          params as RawExecutionContextCreated,
        ),
      });
    } else if (method === 'Runtime.executionContextDestroyed') {
      const destroyed = params as RawExecutionContextDestroyed;
      this.fanContexts({
        kind: 'context-destroyed',
        targetId,
        contextKey: jsContextKey(sessionKey, destroyed.executionContextId),
      });
    } else if (method === 'Runtime.consoleAPICalled') {
      this.fanConsole(targetId, normalizeConsoleApiCalled(sessionKey, params as RawConsoleApiCalled));
    } else if (method === 'Runtime.exceptionThrown') {
      this.fanConsole(targetId, normalizeExceptionThrown(sessionKey, params as RawExceptionThrown));
    } else if (method === 'Log.entryAdded') {
      this.fanConsole(targetId, normalizeLogEntryAdded(sessionKey, params as RawLogEntryAdded));
    }
  }

  private handleDetach(source: chrome.debugger.Debuggee, reason: string): void {
    const targetId = source.targetId;
    if (targetId === undefined || !this.attachedTargets.delete(targetId)) return;
    this.fanContexts({ kind: 'target-cleared', targetId });
    for (const listener of this.detachListeners) listener(targetId, reason);
  }

  // ── chrome.debugger command helper ────────────────────────────────

  private async send(targetId: string, method: string, params?: Record<string, unknown>): Promise<void> {
    const api = this.api();
    if (!api) return;
    try {
      await api.sendCommand({ targetId }, method, params);
    } catch (err) {
      // The worker can stop between attach and our command; tolerate.
      logger.debug('BrowserTargetSource', 'sendCommand failed', { method, error: errorMessage(err) });
    }
  }

  private fanContexts(event: BrowserTargetJsContextEvent): void {
    for (const listener of this.contextsListeners) listener(event);
  }

  private fanConsole(targetId: string, entry: ConsoleEntry): void {
    for (const listener of this.consoleListeners) listener(targetId, entry);
  }

  private api(): DebuggerApi | undefined {
    return getBrowserAPI().debugger;
  }
}

// ── chrome error tolerance ───────────────────────────────────────────

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `chrome.debugger.attach` on a target another client already debugs. */
function isAlreadyAttached(err: unknown): boolean {
  return /already attached/i.test(errorMessage(err));
}

/** `chrome.debugger.detach` on a target no longer attached. */
function isNotAttached(err: unknown): boolean {
  return /not attached/i.test(errorMessage(err));
}
