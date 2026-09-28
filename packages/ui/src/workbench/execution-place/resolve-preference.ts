/**
 * The execution place PREFERENCE — the two device-local layers folded
 * into the one role the reader takes: the request's own place (saved
 * with the request on this device, or its unsaved draft edit) over the
 * ONE global row under Settings › API requests, else Automatic. A role
 * from either layer is a preference the reader may still find
 * unsupported on this device — it then names the requirement rather
 * than honouring anything silently. Nothing here syncs: a place names
 * this device's topology.
 */

import type { ExecutionPlaceRole } from '@openheaders/core/types';
import type { ExecutionPlacePreference } from './resolve-execution-place';

export function resolveExecutionPlacePreference(
  own: ExecutionPlaceRole | undefined,
  global: ExecutionPlacePreference,
): ExecutionPlacePreference {
  return own ?? global;
}
