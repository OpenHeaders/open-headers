/**
 * Where a workflow's steps were placed on its graph, as THIS device
 * keeps it (the workflow runs plan, Decisions log, S31): the
 * `workflowNodePlaces` slot of the editing scope's workspace, read once
 * as the workflow's editor mounts and written whenever the places
 * change — a move, its undo, Auto-arrange. Never the workflow's: nothing
 * here rides a save, a sync or a git file.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { getHostStorage, wsKeys } from '@openheaders/core/storage';
import { readWorkflowNodePlaces, type WorkflowNodePlaces, withWorkflowNodePlaces } from '@openheaders/core/utils';
import { useEffect, useRef } from 'react';

const SCOPE = 'useKeptNodePlaces';

/** Keep a workflow's places on this device — `null` forgets them. */
export async function keepNodePlaces(
  workspaceId: string | null,
  workflowUid: string,
  places: WorkflowNodePlaces | null,
): Promise<void> {
  const storage = getHostStorage();
  if (!storage || workspaceId === null) return;
  const key = wsKeys(workspaceId).workflowNodePlaces;
  // Read-then-write against the persisted record: two workflows' editors must not drop each other's places.
  const current = await storage.get(key).catch(() => undefined);
  await storage.set(key, withWorkflowNodePlaces(current, workflowUid, places)).catch((err: Error) => {
    logger.warn(SCOPE, `write failed: ${err.message}`);
  });
}

/**
 * Follow `places` onto the device, and hand over what the device kept
 * (`onRead`) once it is read. Nothing is written before that read: what
 * the editor holds until then is not yet the device's to lose.
 */
export function useKeptNodePlaces(
  workspaceId: string | null,
  workflowUid: string,
  places: WorkflowNodePlaces | null,
  onRead: (kept: WorkflowNodePlaces) => void,
): void {
  // What the device holds, as far as this editor knows — `undefined` until it is read.
  const keptRef = useRef<WorkflowNodePlaces | null | undefined>(undefined);
  const placesRef = useRef(places);
  placesRef.current = places;
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    keptRef.current = undefined;
    const storage = getHostStorage();
    if (!storage || workspaceId === null) return;
    let cancelled = false;
    storage
      .get(wsKeys(workspaceId).workflowNodePlaces)
      .then((record) => {
        if (cancelled) return;
        const kept = readWorkflowNodePlaces(record, workflowUid);
        // A node moved before the read came back is the newer arrangement.
        const moved = placesRef.current;
        keptRef.current = moved ?? kept;
        if (kept !== null) onReadRef.current(kept);
        if (moved !== null) void keepNodePlaces(workspaceId, workflowUid, moved);
      })
      .catch((err: Error) => {
        logger.warn(SCOPE, `read failed: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workflowUid]);

  useEffect(() => {
    if (keptRef.current === undefined || places === keptRef.current) return;
    keptRef.current = places;
    void keepNodePlaces(workspaceId, workflowUid, places);
  }, [workspaceId, workflowUid, places]);
}
