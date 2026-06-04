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
 *
 * A floor is also bound to a DevTools-session `token`. The token is minted
 * once per DevTools-open by the devtools_page and persists alongside the
 * floor: `startSession` advances the floor only when the token genuinely
 * changes (a reopen), so an SW-eviction reconnect replaying the same token
 * is a no-op and never drops the in-flight log. The token is reported back
 * to the consumer on the `ready` envelope so it can gate its own
 * session-scoped state.
 */
export interface WatchSessionFloors {
  /**
   * The session floor for `tabId`, establishing it at `establishAtMs` (and
   * persisting, if durable) the first time the tab is seen.
   */
  resolveFloor(tabId: number, establishAtMs: number): number;
  /**
   * Begin (or continue) the DevTools session for `tabId` identified by
   * `token`. A new/changed token advances the floor to `floorMs` (dropping
   * everything observed before now) and returns `true`; the same token (an
   * SW-eviction reconnect replaying the message) is a no-op and returns
   * `false`. Token identity persists with the floor so the no-op survives an
   * SW restart.
   */
  startSession(tabId: number, token: string, floorMs: number): boolean;
  /** The DevTools-session token bound to the tab's floor, if established. */
  sessionToken(tabId: number): string | undefined;
  /** Start a fresh session for `tabId` at `floorMs`, keeping its token. */
  reset(tabId: number, floorMs: number): void;
  /** Drop the tab's session entirely (tab closed / forgotten). */
  forget(tabId: number): void;
}

interface SessionFloor {
  readonly floor: number;
  readonly token?: string;
}

/** Process-lifetime `WatchSessionFloors`. No persistence; lost on restart. */
export class InMemoryWatchSessionFloors implements WatchSessionFloors {
  private readonly floors = new Map<number, SessionFloor>();

  resolveFloor(tabId: number, establishAtMs: number): number {
    const existing = this.floors.get(tabId);
    if (existing !== undefined) return existing.floor;
    this.floors.set(tabId, { floor: establishAtMs });
    return establishAtMs;
  }

  startSession(tabId: number, token: string, floorMs: number): boolean {
    const existing = this.floors.get(tabId);
    if (existing?.token === token) return false;
    this.floors.set(tabId, { floor: floorMs, token });
    return true;
  }

  sessionToken(tabId: number): string | undefined {
    return this.floors.get(tabId)?.token;
  }

  reset(tabId: number, floorMs: number): void {
    this.floors.set(tabId, { floor: floorMs, token: this.floors.get(tabId)?.token });
  }

  forget(tabId: number): void {
    this.floors.delete(tabId);
  }
}
