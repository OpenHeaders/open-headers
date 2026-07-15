/**
 * Product-telemetry controller — owns the host's single `TelemetryClient`
 * (TELEMETRY_PLAN.md §7) behind injected seams so the whole gate matrix
 * (disclosure latch, enabled toggle, once-per-browser-session
 * `session_start`) is unit-testable without chrome APIs.
 *
 * "Product telemetry" everywhere: plain "telemetry" in this extension
 * already means the per-tab traffic telemetry the inspector shows.
 *
 * Session semantics: the service worker is evicted many times per
 * browser session, so the session id and the session_start-sent latch
 * live in the injected session store (`chrome.storage.session` — RAM
 * only, never on disk, cleared at browser exit). A session therefore
 * means one browser launch, not one SW wake.
 */

import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import type { TelemetryEvent, TelemetryTransport } from '@openheaders/core/telemetry';
import { TelemetryClient } from '@openheaders/core/telemetry';

/** RAM-backed per-browser-session state (`chrome.storage.session` in production). */
export interface ProductTelemetrySessionStore {
  getSessionId(): Promise<string | null>;
  setSessionId(id: string): Promise<void>;
  wasSessionStartSent(): Promise<boolean>;
  markSessionStartSent(): Promise<void>;
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

  /** Fire `session_start` once per browser session, only after disclosure. */
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
