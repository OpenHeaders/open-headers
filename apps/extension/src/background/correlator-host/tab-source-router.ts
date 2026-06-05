/**
 * `TabSourceRouter` — the single owner of the per-tab invariant
 * **exactly one correlator feeds a tab**. The heuristic and CDP
 * correlators both `subscribe()` into the one `RequestLifecycleStore`, so
 * if both observed the same tab the store would be double-fed. The router
 * guarantees that never happens: routing a tab to one owner `attachTab`s
 * that correlator and `detachTab`s the other, atomically.
 *
 * Pure, sync, correlator-only — it names no chrome API and does no I/O.
 * The actual `chrome.debugger.attach` (the `ChromeDebuggerEventSource`
 * handshake) is Slice 4's job: the reconciler pairs `source.attach(tabId)`
 * with `router.route(tabId, 'cdp')`. Keeping the source attach out of the
 * router leaves it a small, testable ownership map with no async surface.
 *
 * Default owner is `'heuristic'`: every tab the lifecycle bridge sees is
 * registered there via {@link attachTab}. A tab only moves to `'cdp'`
 * when Slice 4/5 flip it; with CDP never enabled the CDP correlator is
 * never `attachTab`'d and the heuristic path is byte-for-byte unchanged.
 */

import type { RequestCorrelator } from '@openheaders/core/request-lifecycle';

/** Which correlator currently feeds a tab. */
export type TabOwner = 'heuristic' | 'cdp';

/** The slice of a correlator the router coordinates. */
type CorrelatorRef = Pick<RequestCorrelator, 'attachTab' | 'detachTab'>;

export interface TabSourceRouterOptions {
  readonly heuristic: CorrelatorRef;
  readonly cdp: CorrelatorRef;
}

export class TabSourceRouter {
  private readonly heuristic: CorrelatorRef;
  private readonly cdp: CorrelatorRef;
  private readonly owners = new Map<number, TabOwner>();
  /** Per-tab ownership observers — fed the new owner on every flip. */
  private readonly ownerListeners = new Set<(tabId: number, owner: TabOwner) => void>();

  constructor(options: TabSourceRouterOptions) {
    this.heuristic = options.heuristic;
    this.cdp = options.cdp;
  }

  /**
   * The correlator currently feeding a tab. An unknown tab reads as
   * `'heuristic'` — the default path and "not CDP-enhanced" for the panel
   * badge. This is the subscribe-time baseline; live flips arrive via
   * {@link onOwnerChange}.
   */
  ownerOf(tabId: number): TabOwner {
    return this.owners.get(tabId) ?? 'heuristic';
  }

  /**
   * Observe ownership flips. Fires from {@link route} — the only
   * transition that changes a tab's owner (the badge's provenance signal).
   * Returns the unsubscribe handle.
   */
  onOwnerChange(listener: (tabId: number, owner: TabOwner) => void): () => void {
    this.ownerListeners.add(listener);
    return () => {
      this.ownerListeners.delete(listener);
    };
  }

  /**
   * Register a tab at the default owner (`'heuristic'`). Idempotent — a
   * tab already known (under either owner) is left as-is, so a stray
   * second `onCreated` never clobbers a CDP claim.
   */
  attachTab(tabId: number): void {
    if (this.owners.has(tabId)) return;
    this.owners.set(tabId, 'heuristic');
    this.heuristic.attachTab(tabId);
  }

  /**
   * Detach whichever correlator owns the tab and drop the entry. A no-op
   * for an unknown tab (nothing owns it).
   */
  detachTab(tabId: number): void {
    const owner = this.owners.get(tabId);
    if (owner === undefined) return;
    this.correlatorFor(owner).detachTab(tabId);
    this.owners.delete(tabId);
  }

  /**
   * Switch ownership of a tab. Attaches the target correlator and detaches
   * the other, so the tab is never on both. A no-op if the tab is already
   * that owner. Well-defined for a tab not yet seen via {@link attachTab}:
   * it is registered at the target owner (the other correlator's
   * `detachTab` is idempotent, so detaching it when never attached is
   * harmless).
   */
  route(tabId: number, owner: TabOwner): void {
    if (this.owners.get(tabId) === owner) return;
    const target = this.correlatorFor(owner);
    const other = this.correlatorFor(owner === 'heuristic' ? 'cdp' : 'heuristic');
    target.attachTab(tabId);
    other.detachTab(tabId);
    this.owners.set(tabId, owner);
    for (const listener of this.ownerListeners) listener(tabId, owner);
  }

  private correlatorFor(owner: TabOwner): CorrelatorRef {
    return owner === 'cdp' ? this.cdp : this.heuristic;
  }
}
