/**
 * SW awareness store.
 *
 * Per-workspace map of `identity.instanceId → AwarenessState`. Keying
 * on `instanceId` (not `surfaceKind`) lets two workbench tabs — or two
 * open DevTools panels — coexist as distinct presence rows; each
 * surface mint its own instanceId at construction.
 *
 * The local oracle is the **single GC authority**
 * (`docs/SYNC_ENGINE_DESIGN.md` §14.2): surfaces report their state, the
 * store prunes by `lastActivityHlc` physical-time TTL on every publish,
 * and a canonical presence list is emitted whenever the visible set
 * changes.
 *
 * Awareness rides its own broadcast — it is ephemeral, never persisted,
 * and high-frequency. Coupling it to `syncBroadcast` would entangle
 * presence flicker with mutation projection.
 *
 * Sensitive-entity rule (§14.4): for entities the schema marks
 * sensitive, the store strips `fieldFocus` to `null` regardless of
 * what the publisher sends. Defensive at the oracle, not the
 * publisher — the publisher's rule list could drift from the schema's,
 * and the oracle is the single authority for what reaches other
 * surfaces.
 */

import type { AwarenessState } from '@openheaders/core/protocol';

export interface AwarenessStoreOptions {
  workspaceId: string;
  /** Default 30s — see `AWARENESS_TTL_MS`. */
  ttlMs?: number;
  /** Wall-clock source. Defaults to `Date.now`. Tests inject. */
  now?: () => number;
  /**
   * Set of entity types the schema marks sensitive. The oracle blanks
   * `fieldFocus` on incoming states whose `entityFocus.type` is in this
   * set so per-field presence never leaks. Phase A's Rule entity is not
   * sensitive; this hook lets Phase B add Vault / OAuth without a
   * publisher-side scrub.
   */
  sensitiveEntityTypes?: ReadonlySet<string>;
  /**
   * Sink invoked whenever the canonical presence set changes. The
   * service wires this to `bridge.broadcast('awarenessBroadcast', …)`.
   */
  emit: (presence: AwarenessState[]) => void;
}

export interface AwarenessStore {
  readonly workspaceId: string;
  /** Upsert state, run GC, emit on change. Returns the post-GC presence. */
  publish(state: AwarenessState): AwarenessState[];
  /** Drop a presence row immediately (e.g. on explicit unmount). */
  remove(instanceId: string): void;
  /** Snapshot — read-only. */
  list(): AwarenessState[];
  /** Cancel any future emission and clear state. */
  dispose(): void;
}

const DEFAULT_TTL_MS = 30_000;

export function createAwarenessStore(options: AwarenessStoreOptions): AwarenessStore {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const sensitive = options.sensitiveEntityTypes ?? new Set<string>();
  // Keyed by identity.instanceId — multiple instances of the same
  // surfaceKind coexist.
  const states = new Map<string, AwarenessState>();
  let disposed = false;
  let lastEmitted: string | null = null;

  function sanitize(state: AwarenessState): AwarenessState {
    const isSensitive = state.entityFocus ? sensitive.has(state.entityFocus.type) : false;
    if (!isSensitive) return state;
    return { ...state, fieldFocus: null };
  }

  function pruneExpired(): void {
    const cutoff = now() - ttl;
    for (const [instanceId, s] of states) {
      if (s.lastActivityHlc.physicalMs < cutoff) states.delete(instanceId);
    }
  }

  function snapshot(): AwarenessState[] {
    // Stable order keyed by instanceId so equal sets serialize the same.
    return [...states.values()].sort((a, b) => a.identity.instanceId.localeCompare(b.identity.instanceId));
  }

  function emitIfChanged(): AwarenessState[] {
    const list = snapshot();
    const fingerprint = JSON.stringify(list);
    if (fingerprint !== lastEmitted) {
      lastEmitted = fingerprint;
      if (!disposed) options.emit(list);
    }
    return list;
  }

  return {
    workspaceId: options.workspaceId,
    publish(state) {
      if (disposed) return [];
      const sanitized = sanitize(state);
      states.set(sanitized.identity.instanceId, sanitized);
      pruneExpired();
      return emitIfChanged();
    },
    remove(instanceId) {
      if (disposed) return;
      if (states.delete(instanceId)) emitIfChanged();
    },
    list() {
      return snapshot();
    },
    dispose() {
      disposed = true;
      states.clear();
      lastEmitted = null;
    },
  };
}
