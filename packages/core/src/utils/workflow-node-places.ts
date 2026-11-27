/**
 * The per-workspace, HOST-LOCAL record of where a workflow's steps were
 * placed on its graph by hand: workflow uid → step uid → the node's
 * top-left corner, in the graph's own units (the workflow runs plan,
 * Decisions log, S31). An arrangement is this device's view of a
 * workflow, never the workflow — it rides no synced entity and no git
 * file; it lives beside the execution places in `wsKeys(ws)`. A workflow
 * with no entry is drawn by its computed layout.
 */

export interface NodePlace {
  x: number;
  y: number;
}

/** Step uid → where its node stands. */
export type WorkflowNodePlaces = Record<string, NodePlace>;

export type WorkflowNodePlacesRecord = Record<string, WorkflowNodePlaces>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodePlace(value: unknown): value is NodePlace {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

/**
 * The places kept for one workflow — `null` where none are, or where
 * what is stored is not a set of places: the computed layout then.
 */
export function readWorkflowNodePlaces(record: unknown, workflowUid: string): WorkflowNodePlaces | null {
  if (!isRecord(record)) return null;
  const kept = record[workflowUid];
  if (!isRecord(kept)) return null;
  const places: WorkflowNodePlaces = {};
  for (const [stepUid, place] of Object.entries(kept)) {
    if (isNodePlace(place)) places[stepUid] = { x: place.x, y: place.y };
  }
  return Object.keys(places).length > 0 ? places : null;
}

/** The record with one workflow's places set — or forgotten, which removes the entry rather than storing it. */
export function withWorkflowNodePlaces(
  record: WorkflowNodePlacesRecord | undefined,
  workflowUid: string,
  places: WorkflowNodePlaces | null,
): WorkflowNodePlacesRecord {
  const next: WorkflowNodePlacesRecord = { ...(record ?? {}) };
  if (places === null) {
    delete next[workflowUid];
  } else {
    next[workflowUid] = places;
  }
  return next;
}
