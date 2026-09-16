/**
 * The execution place PREFERENCE — fork 3's three layers folded into
 * the one role the reader takes: the per-send pick on the send control
 * (this send only) over the request's own `executionPlace` knob, over
 * the nearest ancestor's (collection > folder — the inherited view's
 * effective settings), over the ONE global row under Settings › API
 * requests, else Automatic. A role from any layer is a preference the
 * reader may still find unsupported on this device — it then names the
 * requirement rather than honouring anything silently.
 */

import type { ExecutionPlaceRole } from '@openheaders/core/types';
import type { InheritedSettingsView } from '../components/shared/inherited-settings/inherited-settings';
import type { ExecutionPlacePreference } from './resolve-execution-place';

export function resolveExecutionPlacePreference(
  pick: ExecutionPlacePreference,
  own: ExecutionPlaceRole | undefined,
  inherited: Pick<InheritedSettingsView, 'settings'>,
  global: ExecutionPlacePreference,
): ExecutionPlacePreference {
  if (pick !== 'auto') return pick;
  return own ?? inherited.settings.executionPlace ?? global;
}
