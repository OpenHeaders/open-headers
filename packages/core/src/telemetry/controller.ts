/**
 * Product-telemetry controller — owns a host's single `TelemetryClient`
 * (TELEMETRY_PLAN.md §7) behind injected seams so the whole gate matrix
 * (disclosure latch, enabled toggle, once-per-session `session_start`)
 * is unit-testable without any platform API. Exactly one instance lives
 * per host process (extension SW / desktop main); UI surfaces never
 * construct one — they reach it over the `productTelemetry*` RPCs.
 *
 * "Product telemetry" everywhere: plain "telemetry" in this codebase
 * already means the per-tab traffic telemetry the inspector shows.
 *
 * Session semantics are the host's to define through the injected
 * session store. The extension service worker is evicted many times per
 * browser session, so it persists the id and the session_start-sent
 * latch in `chrome.storage.session` (RAM only, cleared at browser
 * exit) — a session means one browser launch, not one SW wake. A
 * persistent process (desktop main) is its own session and uses the
 * in-memory store.
 */

import type { ProductTelemetrySnapshot } from '../protocol/channels/product-telemetry';
import type { TelemetryTransport } from './client';
import { TelemetryClient } from './client';
import type { TelemetryEvent } from './vocabulary';

/** Per-session state; RAM-backed on every host, never written to disk. */
export interface ProductTelemetrySessionStore {
  getSessionId(): Promise<string | null>;
  setSessionId(id: string): Promise<void>;
  wasSessionStartSent(): Promise<boolean>;
  markSessionStartSent(): Promise<void>;
}

/** Session store for hosts whose process lifetime IS the session (desktop main). */
export function createInMemoryProductTelemetrySessionStore(): ProductTelemetrySessionStore {
  let sessionId: string | null = null;
  let sessionStartSent = false;
  return {
    getSessionId: async () => sessionId,
    setSessionId: async (id) => {
      sessionId = id;
    },
    wasSessionStartSent: async () => sessionStartSent,
    markSessionStartSent: async () => {
      sessionStartSent = true;
    },
  };
}

export interface ProductTelemetryControllerDeps {
  transport: TelemetryTransport;
  now(): number;
  sessionStore: ProductTelemetrySessionStore;
  /** Current `telemetry.enabled` setting value. */
  getEnabled(): boolean;
  /** Subscribe to `telemetry.enabled` changes. */
  subscribeEnabled(fn: () => void): void;
  /** Current first-run-disclosure-shown flag. */
  getDisclosed(): Promise<boolean>;
  /** Subscribe to the disclosure flag flipping (UI surfaces set it). */
  subscribeDisclosed(fn: () => void): void;
  /**
   * Build this host's `session_start` event, or null when the running
   * platform has no vocabulary member (we skip the event rather than
   * misreport — the allowlist grows by design discussion, not mapping).
   */
  buildSessionStart(): Promise<TelemetryEvent | null>;
}

export class ProductTelemetryController {
  private readonly deps: ProductTelemetryControllerDeps;
  private client: TelemetryClient | null = null;
  private ready: Promise<void> | null = null;

  constructor(deps: ProductTelemetryControllerDeps) {
    this.deps = deps;
  }

  /** Idempotent boot: resolve the session id, build the client, wire both gates. */
  init(): Promise<void> {
    this.ready ??= this.boot();
    return this.ready;
  }

  private async boot(): Promise<void> {
    let sessionId = await this.deps.sessionStore.getSessionId();
    const client = sessionId
      ? new TelemetryClient({ transport: this.deps.transport, now: this.deps.now, sessionId })
      : new TelemetryClient({ transport: this.deps.transport, now: this.deps.now });
    if (!sessionId) {
      sessionId = client.sessionId;
      await this.deps.sessionStore.setSessionId(sessionId);
    }
    this.client = client;

    client.setEnabled(this.deps.getEnabled());
    this.deps.subscribeEnabled(() => client.setEnabled(this.deps.getEnabled()));

    const applyDisclosure = async (): Promise<void> => {
      if (client.isDisclosed) return;
      if (!(await this.deps.getDisclosed())) return;
      client.noteDisclosureShown();
      await this.ensureSessionStart();
    };
    this.deps.subscribeDisclosed(() => void applyDisclosure());
    await applyDisclosure();
  }

  /** Fire `session_start` once per session, only after disclosure. */
  private async ensureSessionStart(): Promise<void> {
    if (!this.client?.isDisclosed) return;
    if (await this.deps.sessionStore.wasSessionStartSent()) return;
    const event = await this.deps.buildSessionStart();
    await this.deps.sessionStore.markSessionStartSent();
    if (event) this.client.track(event);
  }

  async track(event: TelemetryEvent): Promise<void> {
    await this.init();
    this.client?.track(event);
  }

  async flush(): Promise<void> {
    await this.init();
    await this.client?.flush();
  }

  async snapshot(): Promise<ProductTelemetrySnapshot> {
    await this.init();
    const client = this.client;
    if (!client) return { sessionId: '', enabled: false, disclosed: false, entries: [] };
    return {
      sessionId: client.sessionId,
      enabled: client.isEnabled,
      disclosed: client.isDisclosed,
      entries: client.readEventLog().map((entry) => ({ ...entry })),
    };
  }
}
