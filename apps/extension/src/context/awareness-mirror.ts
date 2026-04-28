/**
 * Renderer-side awareness mirror (Phase A A1).
 *
 * Subscribes once to the SW's `awarenessBroadcast` channel and holds
 * the canonical per-workspace presence list. UI consumers (editor tab
 * badge, field-level chip, deletion view) query the mirror by entity
 * ref or field path; subscriptions fire when the presence relevant to
 * a query changes.
 *
 * Awareness ≠ sync — the mirror is intentionally separate from
 * `rule-sync-mirror.ts`. They consume different broadcast channels and
 * have different lifecycles (presence is ephemeral; rules are
 * canonical entity state).
 *
 * Workspace switch: the mirror tracks `workspaceId` from the most
 * recent broadcast and clears local state on a switch. Consumers that
 * cache by `(type, id)` don't need to know — the mirror's listeners
 * fire as the presence list rebuilds.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export type AwarenessListener = () => void;

export interface EntityRef {
  type: string;
  id: string;
}

export interface FieldRef extends EntityRef {
  path: string;
}

export interface PresenceQueryOptions {
  /** Filter out the local surface so a tab doesn't see itself. */
  excludeSurfaceId?: string;
}

export interface AwarenessMirror {
  /** The workspace id the latest broadcast carried, or `null` before
   *  the first event has landed. */
  getWorkspaceId(): string | null;
  /** Canonical presence — read-only snapshot. */
  getPresence(): readonly AwarenessState[];
  /** Surfaces with `entityFocus === ref`. */
  getPresenceForEntity(ref: EntityRef, opts?: PresenceQueryOptions): AwarenessState[];
  /** Surfaces with `fieldFocus === ref` (matches type+id+path exactly). */
  getPresenceForField(ref: FieldRef, opts?: PresenceQueryOptions): AwarenessState[];
  /** Subscribe to ANY presence change. Cheap; called on every broadcast. */
  subscribe(listener: AwarenessListener): () => void;
  /** Subscribe to changes affecting one entity (entity-level + field-level). */
  subscribeEntity(ref: EntityRef, listener: AwarenessListener): () => void;
  dispose(): void;
}

export interface CreateAwarenessMirrorOptions {
  /** Seed via the `oh.awareness.snapshot` RPC on construction. Defaults
   *  to true in production; tests turning the snapshot off pass false. */
  bootstrap?: boolean;
}

export function createAwarenessMirror(options: CreateAwarenessMirrorOptions = {}): AwarenessMirror {
  const { bootstrap = true } = options;
  let presence: AwarenessState[] = [];
  let workspaceId: string | null = null;
  const allListeners = new Set<AwarenessListener>();
  const entityListeners = new Map<string, Set<AwarenessListener>>();
  let disposed = false;

  function entityKey(ref: EntityRef): string {
    return `${ref.type}\x1f${ref.id}`;
  }

  function notifyAll(): void {
    for (const l of allListeners) {
      try {
        l();
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  }

  function notifyEntities(touched: Set<string>): void {
    for (const key of touched) {
      const bucket = entityListeners.get(key);
      if (!bucket) continue;
      for (const l of bucket) {
        try {
          l();
        } catch {
          // ignored
        }
      }
    }
  }

  function entityKeysFromPresence(list: readonly AwarenessState[]): Set<string> {
    const out = new Set<string>();
    for (const s of list) {
      if (s.entityFocus) out.add(entityKey(s.entityFocus));
      if (s.fieldFocus) out.add(entityKey(s.fieldFocus));
    }
    return out;
  }

  function applyPresence(nextWorkspaceId: string | null, next: AwarenessState[]): void {
    const beforeKeys = entityKeysFromPresence(presence);
    const afterKeys = entityKeysFromPresence(next);
    const touched = new Set<string>([...beforeKeys, ...afterKeys]);
    workspaceId = nextWorkspaceId;
    presence = next;
    notifyAll();
    notifyEntities(touched);
  }

  const unsubscribe = subscribe('awarenessBroadcast', (event) => {
    if (disposed) return;
    applyPresence(event.workspaceId, event.presence);
  });

  if (bootstrap) {
    void call('oh.awareness.snapshot')
      .then((resp) => {
        if (disposed) return;
        // A broadcast that landed mid-flight wins; only seed if no
        // broadcast has populated the mirror yet.
        if (presence.length > 0 || workspaceId !== null) return;
        applyPresence(resp.workspaceId, resp.presence);
      })
      .catch((err: Error) => {
        logger.info('AwarenessMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  function filterByEntity(ref: EntityRef, opts?: PresenceQueryOptions): AwarenessState[] {
    return presence.filter(
      (s) =>
        s.entityFocus !== null &&
        s.entityFocus.type === ref.type &&
        s.entityFocus.id === ref.id &&
        s.surfaceId !== opts?.excludeSurfaceId,
    );
  }

  function filterByField(ref: FieldRef, opts?: PresenceQueryOptions): AwarenessState[] {
    return presence.filter(
      (s) =>
        s.fieldFocus !== null &&
        s.fieldFocus.type === ref.type &&
        s.fieldFocus.id === ref.id &&
        s.fieldFocus.path === ref.path &&
        s.surfaceId !== opts?.excludeSurfaceId,
    );
  }

  return {
    getWorkspaceId() {
      return workspaceId;
    },
    getPresence() {
      return presence;
    },
    getPresenceForEntity: filterByEntity,
    getPresenceForField: filterByField,
    subscribe(listener) {
      allListeners.add(listener);
      return () => {
        allListeners.delete(listener);
      };
    },
    subscribeEntity(ref, listener) {
      const key = entityKey(ref);
      let bucket = entityListeners.get(key);
      if (!bucket) {
        bucket = new Set();
        entityListeners.set(key, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = entityListeners.get(key);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) entityListeners.delete(key);
      };
    },
    dispose() {
      disposed = true;
      unsubscribe();
      allListeners.clear();
      entityListeners.clear();
      presence = [];
      workspaceId = null;
    },
  };
}

// ── Module-level singleton ───────────────────────────────────────────
//
// One mirror per renderer surface. Multiple component instances share
// it via `getActiveAwarenessMirror`. Tests construct fresh mirrors
// directly when isolation matters.

let active: AwarenessMirror | null = null;

export function getActiveAwarenessMirror(): AwarenessMirror {
  if (!active) active = createAwarenessMirror();
  return active;
}

export function disposeActiveAwarenessMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
