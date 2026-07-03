/**
 * Per-workspace mirror registry — generic helper used by every
 * `*-sync-mirror.ts` adapter to host a `Map<workspaceId, XSyncMirror>`
 * with lazy creation. Replaces the pre-commit-2 module-level
 * `let active: XSyncMirror | null` singleton: workspaceId-scoped lookup
 * is the structural fix for the v1.1 runtime bug ("env created in
 * tab2/w2 in only-this-tab mode lands in wsKeys(w1).environments").
 *
 * The renderer mirror plane is the symmetric counterpart of the SW
 * data plane (see `apps/extension/src/background/sync/service.ts`'s
 * `services: Map<workspaceId, WorkspaceServiceState>`). Each registry
 * here is the renderer-side projection of one entity's workspace map.
 *
 * Lifecycle:
 *   - `getOrCreate(workspaceId)` lazily instantiates a mirror on first
 *     read. The factory's `subscribe('syncBroadcast', …)` call MUST
 *     fire synchronously so the bridge subscription opens BEFORE any
 *     write can fire — matches the pre-extraction contract.
 *   - `dispose(workspaceId)` tears one entry down (subscription
 *     unsubscribed, listeners cleared). Used when a workspace is
 *     removed or the lifeline grace expires.
 *   - `disposeAll()` tears every entry down. Used at test-suite reset.
 */

interface DisposableMirror {
  dispose(): void;
}

export interface WorkspaceMirrorRegistry<M extends DisposableMirror> {
  /** Lazily create or return the mirror for `workspaceId`. */
  getOrCreate(workspaceId: string): M;
  /** Return the mirror for `workspaceId` if it exists; never creates. */
  peek(workspaceId: string): M | null;
  /** Tear down one mirror entry. No-op if none exists. */
  dispose(workspaceId: string): void;
  /** Tear down every mirror entry. */
  disposeAll(): void;
  /** Resident workspace ids — useful for tests and lifecycle audits. */
  residentWorkspaceIds(): string[];
}

export function createWorkspaceMirrorRegistry<M extends DisposableMirror>(
  factory: (workspaceId: string) => M,
): WorkspaceMirrorRegistry<M> {
  const mirrors = new Map<string, M>();
  return {
    getOrCreate(workspaceId) {
      let m = mirrors.get(workspaceId);
      if (!m) {
        m = factory(workspaceId);
        mirrors.set(workspaceId, m);
      }
      return m;
    },
    peek(workspaceId) {
      return mirrors.get(workspaceId) ?? null;
    },
    dispose(workspaceId) {
      const m = mirrors.get(workspaceId);
      if (!m) return;
      m.dispose();
      mirrors.delete(workspaceId);
    },
    disposeAll() {
      for (const m of mirrors.values()) m.dispose();
      mirrors.clear();
    },
    residentWorkspaceIds() {
      return Array.from(mirrors.keys());
    },
  };
}
