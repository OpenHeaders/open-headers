/**
 * The request's execution place as a HOST-LOCAL, per-request value
 * saved with the request (the Execution Place plan, the user's rule:
 * a place names this device's topology, so it never syncs). The
 * editors keep the knob on their draft — the Settings tab's Runs on
 * row and the place button's picker both edit it, so a pick is a
 * draft edit until Save — and this module is where the value leaves
 * the draft: composed onto the live entity for the reprime baseline
 * (`withLocalPlace`), split off the entity updates at save time
 * (`splitLocalPlace`), and read and written in the `executionPlaces`
 * slot of the editing scope's workspace (`useRequestExecutionPlaces`).
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { getHostStorage, wsKeys } from '@openheaders/core/storage';
import type { ExecutionPlaceRole } from '@openheaders/core/types';
import { type ExecutionPlacesRecord, readExecutionPlace, withExecutionPlace } from '@openheaders/core/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SCOPE = 'useRequestExecutionPlaces';

export interface LocalExecutionPlace {
  /** The role the send's socket opens on; undefined = Automatic. */
  executionPlace?: ExecutionPlaceRole;
}

export type WithLocalPlace<T> = T & LocalExecutionPlace;

/** The live entity with this device's saved place composed on — the
 *  reprime baseline the draft primes from and is compared against. */
export function withLocalPlace<T extends object>(
  entity: T,
  executionPlace: ExecutionPlaceRole | undefined,
): WithLocalPlace<T> {
  return executionPlace === undefined ? { ...entity } : { ...entity, executionPlace };
}

/** The draft's updates split into the entity's (what the wire
 *  carries) and the place (what this device keeps). */
export function splitLocalPlace<U extends LocalExecutionPlace>(
  updates: U,
): { executionPlace: ExecutionPlaceRole | undefined; entityUpdates: Omit<U, 'executionPlace'> } {
  const { executionPlace, ...entityUpdates } = updates;
  return { executionPlace, entityUpdates };
}

export interface RequestExecutionPlaces {
  /** The saved place of a request on this device; undefined = Automatic. */
  placeOf: (requestUid: string) => ExecutionPlaceRole | undefined;
  /** Save a request's place on this device — undefined clears it to Automatic. */
  setPlace: (requestUid: string, role: ExecutionPlaceRole | undefined) => Promise<void>;
}

/**
 * The editing scope's `executionPlaces` slot, live: read once, then
 * followed through the host-storage subscription so a save in another
 * tab re-primes this one. `workspaceId` null (no scope yet) reads as
 * empty and refuses writes.
 */
export function useRequestExecutionPlaces(workspaceId: string | null): RequestExecutionPlaces {
  const [record, setRecord] = useState<ExecutionPlacesRecord | undefined>(undefined);

  useEffect(() => {
    setRecord(undefined);
    const storage = getHostStorage();
    if (!storage || workspaceId === null) return;
    const key = wsKeys(workspaceId).executionPlaces;
    let cancelled = false;
    storage
      .get(key)
      .then((value) => {
        if (!cancelled) setRecord(value);
      })
      .catch((err: Error) => {
        logger.warn(SCOPE, `read failed: ${err.message}`);
      });
    const unsubscribe = storage.subscribe(key, (next) => setRecord(next));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [workspaceId]);

  const placeOf = useCallback((requestUid: string) => readExecutionPlace(record, requestUid), [record]);

  const setPlace = useCallback(
    async (requestUid: string, role: ExecutionPlaceRole | undefined) => {
      const storage = getHostStorage();
      if (!storage || workspaceId === null) return;
      const key = wsKeys(workspaceId).executionPlaces;
      // Read-then-write against the persisted record, not the mirror —
      // two editors saving different requests must not drop each other.
      const current = await storage.get(key).catch(() => undefined);
      if (readExecutionPlace(current, requestUid) === role) return;
      const next = withExecutionPlace(current, requestUid, role);
      setRecord(next);
      await storage.set(key, next).catch((err: Error) => {
        logger.warn(SCOPE, `write failed: ${err.message}`);
      });
    },
    [workspaceId],
  );

  return useMemo(() => ({ placeOf, setPlace }), [placeOf, setPlace]);
}
