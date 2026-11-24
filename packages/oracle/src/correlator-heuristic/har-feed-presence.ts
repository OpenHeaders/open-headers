/**
 * Which tabs have a live finished-request feed — the host's devtools
 * page, the only thing that hands over a finished request's entry and
 * its body. Folded from the host's {@link HarPresenceEvent}s: a tab the
 * host never announced has none.
 *
 * Counted, not flagged: a reconnect can overlap the port it replaces,
 * and the tab has a feed until the last one is gone.
 *
 * Kept apart from the per-tab correlation state on purpose. A feed
 * outlives a tab's detach — a tab routed to the other correlator and
 * back still has its DevTools open — so nothing here is forgotten with
 * the tab; an entry leaves when its last feed does.
 */

import type { HarPresenceEvent } from './har-events';

export class HarFeedPresence {
  private readonly live = new Map<number, number>();

  isLive(tabId: number): boolean {
    return this.live.has(tabId);
  }

  /** Fold one event. True when it took the tab's last feed away. */
  observe(event: HarPresenceEvent): boolean {
    const count = this.live.get(event.tabId) ?? 0;
    if (event.kind === 'tab-har-active') {
      this.live.set(event.tabId, count + 1);
      return false;
    }
    if (count > 1) {
      this.live.set(event.tabId, count - 1);
      return false;
    }
    this.live.delete(event.tabId);
    return count === 1;
  }
}
