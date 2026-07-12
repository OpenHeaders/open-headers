/**
 * `BrowserTargetAttachController` — the reconciler for browser-scoped
 * service-worker targets (JS contexts Phase B), sibling of
 * {@link CdpAttachController} with the same locked-invariant shape:
 *
 *     attachedTargets = { targets whose owner-set ∩ cdp-attached tabs ≠ ∅ }
 *                       ∩ { master switch ON }
 *
 * where a target's owner-set is the cdp-attached tabs whose main-frame
 * **origin** matches the worker script URL's origin — `getTargets()` gives
 * a service worker no `tabId` (verified live, Phase B spike), so origin
 * match is the attribution. One worker may serve N attached tabs; the
 * committed owner mapping is what the fanout resolves entries against.
 *
 * Discovery is a **poll**: `Target.setDiscoverTargets` is "Not allowed"
 * over `chrome.debugger` (spike), so there is no push. An epoch runs on
 * every input change (tab attach-set, master switch), on demand
 * (main-frame navigation), and on a low-frequency interval while anything
 * could be desired; each epoch re-resolves tab origins, re-enumerates
 * targets, recomputes desire, and converges every affected target.
 *
 * Per-target operations are serialized with the desire re-read after each
 * await, exactly like the tab reconciler's async-gap rule — never
 * imperative attaches. A chrome-initiated detach drops the target with no
 * immediate re-attach; the next epoch decides again.
 */

import type { BrowserTargetDescriptor } from './browser-target-source';

/** The slice of the browser-target source the reconciler drives. */
interface BrowserTargetSourceRef {
  discoverServiceWorkers(): Promise<BrowserTargetDescriptor[]>;
  attach(targetId: string): Promise<void>;
  detach(targetId: string): Promise<void>;
  onDetach(listener: (targetId: string, reason: string) => void): () => void;
}

/**
 * A committed owner-set change on one target: `added` tabs now receive its
 * stream (the fanout replays the live context mirror into them), `removed`
 * tabs stop (the fanout clears the target's session subset from them).
 */
export type BrowserTargetOwnersListener = (
  targetId: string,
  added: readonly number[],
  removed: readonly number[],
) => void;

export interface BrowserTargetAttachControllerOptions {
  readonly source: BrowserTargetSourceRef;
  /**
   * Resolve a cdp-attached tab's main-frame origin (`null` when the tab is
   * gone or has no http(s) URL). Re-resolved every epoch, never cached —
   * navigation moves a tab between owner-sets.
   */
  readonly originOf: (tabId: number) => Promise<string | null>;
  /** Low-frequency discovery interval; workers start/stop with no push signal. */
  readonly pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 15_000;

export class BrowserTargetAttachController {
  private readonly source: BrowserTargetSourceRef;
  private readonly originOf: (tabId: number) => Promise<string | null>;
  private readonly pollIntervalMs: number;
  private readonly unsubscribeDetach: () => void;

  /** The tab reconciler's committed attach set (input). */
  private attachedTabs: ReadonlySet<number> = new Set();
  /** Master switch (input flag); driven by `inspection.cdpEnabled`. */
  private enabled = false;
  /** Current epoch's desired owner-set per discovered target. */
  private desiredOwners = new Map<string, ReadonlySet<number>>();
  /** Targets we hold a committed attachment for. */
  private readonly attached = new Set<string>();
  /** Committed owner mapping per attached target — what the fanout reads. */
  private readonly owners = new Map<string, ReadonlySet<number>>();
  /** Per-target op chain — serializes attach/detach so races can't interleave. */
  private readonly pending = new Map<string, Promise<void>>();
  private readonly ownersListeners = new Set<BrowserTargetOwnersListener>();

  private discovering = false;
  private discoverAgain = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(options: BrowserTargetAttachControllerOptions) {
    this.source = options.source;
    this.originOf = options.originOf;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.unsubscribeDetach = this.source.onDetach((targetId) => this.handleDetach(targetId));
  }

  /** The tab reconciler's committed attach set changed. Re-runs discovery.
   *  Fed from the tab controller's `onChange`, which also emits for pin and
   *  fault churn — an unchanged set short-circuits. */
  noteAttachedTabs(tabIds: readonly number[]): void {
    const next = new Set(tabIds);
    if (next.size === this.attachedTabs.size && [...next].every((tabId) => this.attachedTabs.has(tabId))) return;
    this.attachedTabs = next;
    this.updatePoll();
    this.requestDiscovery();
  }

  /** The master switch changed. Re-runs discovery (OFF converges to ∅). */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.updatePoll();
    this.requestDiscovery();
  }

  /**
   * Run a discovery epoch now (or queue one behind the epoch in flight).
   * Called on input changes, main-frame navigations, and the poll tick.
   */
  requestDiscovery(): void {
    if (this.disposed) return;
    if (this.discovering) {
      this.discoverAgain = true;
      return;
    }
    this.discovering = true;
    void this.runDiscovery().finally(() => {
      this.discovering = false;
      if (this.discoverAgain) {
        this.discoverAgain = false;
        this.requestDiscovery();
      }
    });
  }

  /** The committed owner tabs of an attached target (∅ when not attached). */
  ownersOf(targetId: string): readonly number[] {
    return [...(this.owners.get(targetId) ?? [])];
  }

  /** Observe committed owner-set changes. Returns the unsubscribe handle. */
  onOwnersChanged(listener: BrowserTargetOwnersListener): () => void {
    this.ownersListeners.add(listener);
    return () => {
      this.ownersListeners.delete(listener);
    };
  }

  /** Detach every target + drop subscriptions and the poll. Tests / shutdown. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribeDetach();
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = null;
    for (const targetId of [...this.attached]) {
      this.attached.delete(targetId);
      this.commitOwners(targetId, new Set());
      void this.source.detach(targetId);
    }
    this.desiredOwners.clear();
    this.pending.clear();
    this.ownersListeners.clear();
    this.attachedTabs = new Set();
    this.enabled = false;
  }

  // ── discovery epoch ──────────────────────────────────────────────────

  private async runDiscovery(): Promise<void> {
    this.desiredOwners = await this.computeDesiredOwners();
    // Converge every target any epoch or commitment touches — a target that
    // just left the desired set still gets a step that detaches it.
    const affected = new Set<string>([...this.desiredOwners.keys(), ...this.attached, ...this.owners.keys()]);
    for (const targetId of affected) this.scheduleTarget(targetId);
  }

  private async computeDesiredOwners(): Promise<Map<string, ReadonlySet<number>>> {
    const desired = new Map<string, ReadonlySet<number>>();
    if (!this.enabled || this.attachedTabs.size === 0) return desired;
    const tabs = [...this.attachedTabs];
    const [origins, targets] = await Promise.all([
      Promise.all(tabs.map((tabId) => this.originOf(tabId))),
      this.source.discoverServiceWorkers(),
    ]);
    const tabsByOrigin = new Map<string, Set<number>>();
    tabs.forEach((tabId, i) => {
      const origin = origins[i];
      if (origin === null) return;
      const set = tabsByOrigin.get(origin) ?? new Set<number>();
      set.add(tabId);
      tabsByOrigin.set(origin, set);
    });
    for (const target of targets) {
      const ownerTabs = tabsByOrigin.get(originOfUrl(target.url));
      if (ownerTabs !== undefined && ownerTabs.size > 0) desired.set(target.targetId, ownerTabs);
    }
    return desired;
  }

  private isDesired(targetId: string): boolean {
    return this.enabled && (this.desiredOwners.get(targetId)?.size ?? 0) > 0;
  }

  // ── per-target convergence ───────────────────────────────────────────

  /** Append a convergence step to the target's serialized op chain. */
  private scheduleTarget(targetId: string): void {
    const prev = this.pending.get(targetId) ?? Promise.resolve();
    const next = prev.then(() => this.applyTarget(targetId));
    this.pending.set(targetId, next);
    void next.finally(() => {
      if (this.pending.get(targetId) === next) this.pending.delete(targetId);
    });
  }

  /**
   * Converge one target to its current desired state. Re-reads the desire
   * after the attach await, so a target that fell out mid-handshake is
   * detached again and never committed.
   */
  private async applyTarget(targetId: string): Promise<void> {
    const wantAttached = this.isDesired(targetId);
    const isAttached = this.attached.has(targetId);

    if (wantAttached && !isAttached) {
      try {
        await this.source.attach(targetId);
      } catch {
        // A real attach failure: the target stays off; the next epoch may
        // retry (workers churn — a dead target simply stops enumerating).
        return;
      }
      if (!this.isDesired(targetId)) {
        await this.source.detach(targetId);
        return;
      }
      this.attached.add(targetId);
      this.commitOwners(targetId, this.desiredOwners.get(targetId) ?? new Set());
      return;
    }

    if (!wantAttached && isAttached) {
      this.attached.delete(targetId);
      this.commitOwners(targetId, new Set());
      await this.source.detach(targetId);
      return;
    }

    if (wantAttached && isAttached) {
      // Steady state — but the owner-set itself may have churned (a tab
      // navigated in or out of the worker's origin, a tab detached while
      // others remain). Commit the membership delta.
      this.commitOwners(targetId, this.desiredOwners.get(targetId) ?? new Set());
    }
  }

  /** Commit a target's owner-set and fan the membership delta. */
  private commitOwners(targetId: string, next: ReadonlySet<number>): void {
    const prev = this.owners.get(targetId) ?? new Set<number>();
    const added = [...next].filter((tabId) => !prev.has(tabId));
    const removed = [...prev].filter((tabId) => !next.has(tabId));
    if (added.length === 0 && removed.length === 0) return;
    if (next.size === 0) this.owners.delete(targetId);
    else this.owners.set(targetId, new Set(next));
    for (const listener of this.ownersListeners) listener(targetId, added, removed);
  }

  // ── chrome-initiated detach ──────────────────────────────────────────

  /**
   * The attachment died underneath us (worker stopped, user cancel). Drop
   * the commitment with no immediate re-attach — re-attaching is the next
   * epoch's decision, so a user cancel is not fought.
   */
  private handleDetach(targetId: string): void {
    if (!this.attached.delete(targetId)) return;
    this.commitOwners(targetId, new Set());
  }

  // ── poll ─────────────────────────────────────────────────────────────

  /** Run the low-frequency poll only while an epoch could desire anything. */
  private updatePoll(): void {
    const shouldPoll = this.enabled && this.attachedTabs.size > 0;
    if (shouldPoll && this.pollTimer === null) {
      this.pollTimer = setInterval(() => this.requestDiscovery(), this.pollIntervalMs);
    } else if (!shouldPoll && this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

/** The origin of a worker script URL (http(s) guaranteed by discovery). */
function originOfUrl(url: string): string {
  return new URL(url).origin;
}
