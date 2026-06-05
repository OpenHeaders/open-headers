/**
 * `CdpAttachController` — the SW-side reconciler that owns the locked
 * invariant
 *
 *     attached = { tabs with a live DevTools port } ∩ { master switch ON }
 *
 * It is the **only** code that drives a tab into CDP. Every attach/detach
 * is this reconciler recomputing the intersection and applying the delta —
 * never an imperative one-off `attach` sprinkled elsewhere. Concurrent CDP
 * across N DevTools-open tabs, global teardown on flag-OFF, and
 * no-attach-when-OFF all fall out of the one rule, not separate code paths.
 *
 * Two inputs, both injected:
 *   - **live DevTools ports** — `notePortConnected` / `notePortDisconnected`,
 *     fed by the `devtools-port-presence` observer (the `devtools-har-source:
 *     <tabId>` port connect/disconnect). DevTools-open = port connect,
 *     DevTools-close / tab-close / SW-evict = port disconnect.
 *   - **the master switch** — `setEnabled`, fed by Slice 5's
 *     `subscribeKey('inspection.cdpEnabled')`. Default OFF, so a live build
 *     attaches nothing until S5 flips it.
 *
 * Each newly-desired tab pairs `source.attach(tabId)` with
 * `router.route(tabId, 'cdp')`; each newly-undesired tab pairs
 * `source.detach(tabId)` with `router.route(tabId, 'heuristic')`. The router
 * keeps the no-double-feed invariant (routing to cdp detaches heuristic for
 * that tab); the source owns the chrome handshake. Both, always together.
 *
 * Effect-only over its two inputs: it names no chrome API. The connect/
 * disconnect plumbing lives in the `devtools-port-presence` adapter; the
 * router/source are injected via narrow `Pick<…>` interfaces.
 *
 * Async gap (plan §B2-remains). `source.attach` is a `Promise<void>` — the
 * `chrome.debugger.attach` → `Network.enable` handshake. A
 * connect→disconnect race during that window must not leave a half-attached
 * tab, so per-tab operations are serialized through a chain and each link
 * re-reads the current desire after the await: if the port vanished while
 * attaching, the tab is detached again and never routed to cdp. The tab
 * ends heuristic-owned and not CDP-attached.
 *
 * No persistence. The attached set is fully derived from (live ports × flag),
 * both of which self-recover: on SW wake the `devtools_page` ports lazy-
 * reconnect and the reconciler re-establishes the set (or nothing if OFF).
 * The per-tab banner re-flashes on re-attach, and any in-flight CDP state
 * died with the worker — orphaned requests at eviction lack a terminal.
 */

import type { TabSourceRouter } from './tab-source-router';

/** The slice of the debugger source the reconciler drives. */
interface DebuggerSourceRef {
  attach(tabId: number): Promise<void>;
  detach(tabId: number): Promise<void>;
  onDetach(listener: (tabId: number, reason: string) => void): () => void;
}

/** The slice of the router the reconciler drives. */
type RouterRef = Pick<TabSourceRouter, 'route'>;

export interface CdpAttachControllerOptions {
  readonly source: DebuggerSourceRef;
  readonly router: RouterRef;
}

export class CdpAttachController {
  private readonly source: DebuggerSourceRef;
  private readonly router: RouterRef;
  private readonly unsubscribeDetach: () => void;

  /** Tabs with a live DevTools port (input set). */
  private readonly livePorts = new Set<number>();
  /** Master switch (input flag); OFF until Slice 5 drives `setEnabled`. */
  private enabled = false;
  /** Tabs we hold a committed CDP attachment for (the derived intersection). */
  private readonly attached = new Set<number>();
  /** Per-tab op chain — serializes attach/detach so races can't interleave. */
  private readonly pending = new Map<number, Promise<void>>();

  constructor(options: CdpAttachControllerOptions) {
    this.source = options.source;
    this.router = options.router;
    this.unsubscribeDetach = this.source.onDetach((tabId, reason) => this.handleDetach(tabId, reason));
  }

  /** A DevTools port connected on a tab. Updates the input set + reconciles. */
  notePortConnected(tabId: number): void {
    if (this.livePorts.has(tabId)) return;
    this.livePorts.add(tabId);
    this.reconcile();
  }

  /** A DevTools port disconnected on a tab. Updates the input set + reconciles. */
  notePortDisconnected(tabId: number): void {
    if (!this.livePorts.delete(tabId)) return;
    this.reconcile();
  }

  /** The master switch changed. Updates the flag + reconciles. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.reconcile();
  }

  /** Detach every CDP tab + drop chrome subscriptions. Tests / SW shutdown. */
  dispose(): void {
    this.unsubscribeDetach();
    for (const tabId of [...this.attached]) {
      this.attached.delete(tabId);
      void this.source.detach(tabId);
    }
    this.livePorts.clear();
    this.pending.clear();
    this.enabled = false;
  }

  // ── reconcile ────────────────────────────────────────────────────────

  /**
   * Recompute `desired = livePorts ∩ enabled` and converge every affected
   * tab toward it. Edge-triggered; the actual attach/detach is serialized
   * and re-evaluated per tab in {@link applyTab}, so the latest input always
   * wins regardless of in-flight handshakes.
   */
  private reconcile(): void {
    for (const tabId of new Set([...this.livePorts, ...this.attached])) {
      this.scheduleTab(tabId);
    }
  }

  private isDesired(tabId: number): boolean {
    return this.enabled && this.livePorts.has(tabId);
  }

  /** Append a convergence step to the tab's serialized op chain. */
  private scheduleTab(tabId: number): void {
    const prev = this.pending.get(tabId) ?? Promise.resolve();
    const next = prev.then(() => this.applyTab(tabId));
    this.pending.set(tabId, next);
    void next.finally(() => {
      if (this.pending.get(tabId) === next) this.pending.delete(tabId);
    });
  }

  /**
   * Converge one tab to its current desired state. Re-reads the inputs at
   * run time and re-checks after the attach await, so a port that vanished
   * mid-handshake leaves the tab detached and heuristic-owned (never routed
   * to cdp).
   */
  private async applyTab(tabId: number): Promise<void> {
    const wantAttached = this.isDesired(tabId);
    const isAttached = this.attached.has(tabId);

    if (wantAttached && !isAttached) {
      await this.source.attach(tabId);
      if (!this.isDesired(tabId)) {
        // The port disconnected (or the flag flipped) while attaching —
        // undo the handshake and leave the tab heuristic-owned.
        await this.source.detach(tabId);
        return;
      }
      this.attached.add(tabId);
      this.router.route(tabId, 'cdp');
      return;
    }

    if (!wantAttached && isAttached) {
      this.attached.delete(tabId);
      await this.source.detach(tabId);
      this.router.route(tabId, 'heuristic');
    }
  }

  // ── chrome-initiated detach ──────────────────────────────────────────

  /**
   * `chrome.debugger.onDetach` fired — banner Cancel (`canceled_by_user`),
   * tab close (`target_closed`), or the (likely-dead in multi-client Chrome)
   * `replaced_with_devtools`. The source already cleared its own attachment
   * state; we drop the tab from `attached` and route it back to heuristic.
   *
   * Deliberately does NOT reconcile: on a banner-Cancel the port is still
   * live and the flag still ON, so a reconcile would immediately re-attach
   * and fight the user's cancel. The tab stays heuristic until a genuine
   * input change (port disconnect / flag flip). target_closed is also
   * followed by a port disconnect, which cleans up `livePorts` on its own.
   */
  private handleDetach(tabId: number, _reason: string): void {
    if (!this.attached.delete(tabId)) return;
    this.router.route(tabId, 'heuristic');
  }
}
