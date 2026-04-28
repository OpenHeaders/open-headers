/**
 * React hooks that read presence from the renderer-side awareness mirror
 * (`apps/extension/src/context/awareness-mirror.ts`).
 *
 * `useEntityPresence` returns the surfaces with `entityFocus === ref`,
 * filtering out the local surface so a tab never sees itself.
 *
 * `useFieldPresence` does the same for `fieldFocus`. Both hooks subscribe
 * to the mirror's entity bucket and recompute the filtered list on each
 * notification — the mirror groups by entity, so field-scoped queries
 * still pick up updates correctly without a separate index.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { useEffect, useState } from 'react';
import { type EntityRef, type FieldRef, getActiveAwarenessMirror } from '@/context/awareness-mirror';

export interface UseEntityPresenceOptions {
  /** Local surface id — filtered out so the tab doesn't see itself. */
  excludeSurfaceId?: string;
  /** Skip the subscription entirely when false (e.g. ref id not yet known). */
  enabled?: boolean;
}

const EMPTY: readonly AwarenessState[] = Object.freeze([]);

/**
 * Returns surfaces with their `entityFocus` set to `ref`, excluding the
 * local surface. Empty array when the entity is unknown / disabled.
 */
export function useEntityPresence(ref: EntityRef | null, options: UseEntityPresenceOptions = {}): AwarenessState[] {
  const { excludeSurfaceId, enabled = true } = options;
  const [presence, setPresence] = useState<readonly AwarenessState[]>(EMPTY);

  useEffect(() => {
    if (!enabled || !ref) {
      setPresence(EMPTY);
      return;
    }
    const mirror = getActiveAwarenessMirror();
    const recompute = () => {
      setPresence(mirror.getPresenceForEntity(ref, { excludeSurfaceId }));
    };
    recompute();
    return mirror.subscribeEntity(ref, recompute);
  }, [enabled, ref?.type, ref?.id, excludeSurfaceId]);

  return presence as AwarenessState[];
}

/**
 * Returns surfaces with their `fieldFocus` exactly matching `ref`,
 * excluding the local surface.
 */
export function useFieldPresence(ref: FieldRef | null, options: UseEntityPresenceOptions = {}): AwarenessState[] {
  const { excludeSurfaceId, enabled = true } = options;
  const [presence, setPresence] = useState<readonly AwarenessState[]>(EMPTY);

  useEffect(() => {
    if (!enabled || !ref) {
      setPresence(EMPTY);
      return;
    }
    const mirror = getActiveAwarenessMirror();
    const recompute = () => {
      setPresence(mirror.getPresenceForField(ref, { excludeSurfaceId }));
    };
    recompute();
    return mirror.subscribeEntity({ type: ref.type, id: ref.id }, recompute);
  }, [enabled, ref?.type, ref?.id, ref?.path, excludeSurfaceId]);

  return presence as AwarenessState[];
}
