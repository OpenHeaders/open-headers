/**
 * Activity Feed log — Phase C F1.
 *
 * Per-workspace, append-only store of inbound mutation classifications
 * produced by the F2 classifier. The feed exists to give users
 * passive visibility into changes that landed without a foreground
 * conflict prompt — the editor-closed silent-LWW gap described in
 * the data-plane topologies design §11.6.
 *
 * Contract:
 *
 *   - **Idempotent append.** `(workspaceId, mutationId, kind)` is the
 *     uniqueness invariant. A re-delivered envelope (WS echo, replay,
 *     reconnect-flush) must yield exactly one row per kind.
 *   - **HLC-ordered iteration.** `list` returns newest-first by HLC;
 *     UI groups by source + timeline.
 *   - **Workspace-scoped reads.** Every read takes a `workspaceId`;
 *     no cross-workspace bleed.
 *
 * Two production backends will land next:
 *
 *   - {@link IdbActivityLog} — extension SW (F1.c).
 *   - `SqliteActivityLog` — desktop main / future daemon (F1.d).
 *
 * Tests use the in-memory reference impl below.
 */

import { activityEntryId, hlcToString, type ActivityEntry, type ActivityEntryKind } from '@openheaders/core/sync';

export interface ActivityLogListOptions {
  /** Max rows to return (default unlimited). Newest first. */
  limit?: number;
  /** Inclusive cursor; rows strictly newer than this HLC key are returned. */
  sinceHlcKey?: string;
  /** Filter to read==false rows (badge / unread view). */
  unreadOnly?: boolean;
}

export interface ActivityLog {
  /**
   * Append one classified entry. Idempotent: a row with the same
   * `(workspaceId, mutationId, kind)` is a no-op. The implementation
   * computes the entry id via {@link activityEntryId} if the caller
   * left `id` blank.
   */
  append(entry: ActivityEntry): Promise<void>;

  /** Newest-first list within one workspace. */
  list(workspaceId: string, opts?: ActivityLogListOptions): Promise<ActivityEntry[]>;

  /** Flip the `read` flag on the given entry ids. */
  markRead(workspaceId: string, ids: readonly string[]): Promise<void>;

  /** Live unread count for the workspace — drives the sidebar badge. */
  countUnread(workspaceId: string): Promise<number>;

  /**
   * Drop entries whose `observedAt` is strictly older than the cutoff.
   * Caller schedules cadence (auto-decay lands in F7); the store
   * itself doesn't keep wall-clock timers.
   */
  prune(workspaceId: string, beforeObservedAtMs: number): Promise<number>;

  /** Idempotency check — exposed for tests and classifier-replay paths. */
  has(workspaceId: string, mutationId: string, kind: ActivityEntryKind): Promise<boolean>;
}

/**
 * Pure in-memory reference implementation. Used by tests + the
 * cold-start window before a durable backend resolves. Production
 * paths install IDB or SQLite via the persistence provider.
 */
export class InMemoryActivityLog implements ActivityLog {
  private readonly buckets = new Map<string, Map<string, ActivityEntry>>();

  private bucket(workspaceId: string): Map<string, ActivityEntry> {
    let b = this.buckets.get(workspaceId);
    if (!b) {
      b = new Map();
      this.buckets.set(workspaceId, b);
    }
    return b;
  }

  private resolveId(entry: ActivityEntry): string {
    return entry.id.length > 0 ? entry.id : activityEntryId(entry);
  }

  async append(entry: ActivityEntry): Promise<void> {
    const b = this.bucket(entry.workspaceId);
    const id = this.resolveId(entry);
    if (b.has(id)) return;
    b.set(id, { ...entry, id });
  }

  async list(workspaceId: string, opts: ActivityLogListOptions = {}): Promise<ActivityEntry[]> {
    const b = this.buckets.get(workspaceId);
    if (!b) return [];
    const all = [...b.values()];
    all.sort((a, c) => {
      const ka = hlcToString(a.hlc);
      const kc = hlcToString(c.hlc);
      // newest first
      return ka < kc ? 1 : ka > kc ? -1 : 0;
    });
    let view = all;
    if (opts.unreadOnly) view = view.filter((e) => !e.read);
    if (opts.sinceHlcKey !== undefined) {
      const cutoff = opts.sinceHlcKey;
      view = view.filter((e) => hlcToString(e.hlc) > cutoff);
    }
    if (opts.limit !== undefined) view = view.slice(0, Math.max(0, opts.limit));
    return view;
  }

  async markRead(workspaceId: string, ids: readonly string[]): Promise<void> {
    const b = this.buckets.get(workspaceId);
    if (!b) return;
    for (const id of ids) {
      const e = b.get(id);
      if (e && !e.read) b.set(id, { ...e, read: true });
    }
  }

  async countUnread(workspaceId: string): Promise<number> {
    const b = this.buckets.get(workspaceId);
    if (!b) return 0;
    let n = 0;
    for (const e of b.values()) if (!e.read) n++;
    return n;
  }

  async prune(workspaceId: string, beforeObservedAtMs: number): Promise<number> {
    const b = this.buckets.get(workspaceId);
    if (!b) return 0;
    let removed = 0;
    for (const [id, e] of b) {
      if (e.observedAt < beforeObservedAtMs) {
        b.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async has(workspaceId: string, mutationId: string, kind: ActivityEntryKind): Promise<boolean> {
    const b = this.buckets.get(workspaceId);
    if (!b) return false;
    for (const e of b.values()) {
      if (e.mutationId === mutationId && e.kind === kind) return true;
    }
    return false;
  }
}
