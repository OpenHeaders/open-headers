/**
 * The per-workspace, HOST-LOCAL execution-place record: request uid →
 * the role its socket opens on (the Execution Place plan). A place
 * names THIS device's topology — the desktop app on this machine, the
 * server this device is signed in to — so it never rides the synced
 * entity; it lives beside the pause markers in `wsKeys(ws)` and is
 * written by the editor's Save. An absent entry reads as Automatic.
 */

import type { ExecutionPlaceRole } from '../types';

export type ExecutionPlacesRecord = Record<string, ExecutionPlaceRole>;

/** The saved place of one request; undefined = Automatic. */
export function readExecutionPlace(
  record: ExecutionPlacesRecord | undefined,
  requestUid: string,
): ExecutionPlaceRole | undefined {
  return record?.[requestUid];
}

/** The record with one request's place set — or cleared back to
 *  Automatic, which removes the entry rather than storing it. */
export function withExecutionPlace(
  record: ExecutionPlacesRecord | undefined,
  requestUid: string,
  role: ExecutionPlaceRole | undefined,
): ExecutionPlacesRecord {
  const next: ExecutionPlacesRecord = { ...(record ?? {}) };
  if (role === undefined) {
    delete next[requestUid];
  } else {
    next[requestUid] = role;
  }
  return next;
}
