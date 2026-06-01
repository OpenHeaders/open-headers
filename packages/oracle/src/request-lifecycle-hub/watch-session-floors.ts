/**
 * `WatchSessionFloors` — per-tab "watch session" floor ownership for the
 * lifecycle hub.
 *
 * A watch session is the span a UI considers in-scope: it begins the first
 * time a tab is watched and ends only when the user clears. Its floor is a
 * `startedAtMs` value; the hub replays `startedAtMs > floor` to a watcher,
 * so the floor decides which in-flight requests a reconnecting or
 * remounting panel sees.
 *
 * Owning the floor engine-side (rather than having each consumer carry it)
 * is what keeps a panel's view stable across reconnects, panel remounts,
 * and — when the host implementation persists — SW restarts. The interface
 * is host-neutral: the in-memory default below covers tests and hosts that
 * do not outlive their process; a host that survives restarts (e.g. an
 * extension backing this with `chrome.storage.session`) implements the
 * same shape with durable storage.
 *
 * `resolveFloor` MUST be synchronous — the hub calls it inside the
 * synchronous attach/replay block. A host with async storage hydrates an
 * in-memory cache up front and gates attach on that readiness, so the
 * floor is always resolvable without awaiting here.
 */
export interface WatchSessionFloors {
  /**
   * The session floor for `tabId`, establishing it at `establishAtMs` (and
   * persisting, if durable) the first time the tab is seen.
   */
  resolveFloor(tabId: number, establishAtMs: number): number;
  /** Start a fresh session for `tabId` at `floorMs`. */
  reset(tabId: number, floorMs: number): void;
  /** Drop the tab's session entirely (tab closed / forgotten). */
  forget(tabId: number): void;
}

/** Process-lifetime `WatchSessionFloors`. No persistence; lost on restart. */
export class InMemoryWatchSessionFloors implements WatchSessionFloors {
  private readonly floors = new Map<number, number>();

  resolveFloor(tabId: number, establishAtMs: number): number {
    const existing = this.floors.get(tabId);
    if (existing !== undefined) return existing;
    this.floors.set(tabId, establishAtMs);
    return establishAtMs;
  }

  reset(tabId: number, floorMs: number): void {
    this.floors.set(tabId, floorMs);
  }

  forget(tabId: number): void {
    this.floors.delete(tabId);
  }
}
