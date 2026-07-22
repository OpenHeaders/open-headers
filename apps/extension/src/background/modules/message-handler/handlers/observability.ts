/** Observability-log RPCs + the companion-status wire probe. */

import { wsRequest } from '../../../ws-request';
import { clearObservabilityLog, getObservabilityLog } from '../../observability-log';
import type { HandlerMap } from '../types';

type CliWireState = 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';

/** The popover is transient — a slow answer is a dead answer. */
const CLI_WIRE_STATUS_TIMEOUT_MS = 3_000;

export const observabilityHandlers: HandlerMap = {
  getObservabilityLog: ({ respond }) => {
    respond({ entries: [...getObservabilityLog()] });
  },

  clearObservabilityLog: ({ respond }) => {
    clearObservabilityLog();
    respond({ success: true });
  },

  // The Add-ons CLI row's honest state: relay the read-only
  // `getCliStatusSummary` peer verb to the connected desktop. Every
  // failure shape (no wire, an older desktop without the verb, a
  // timeout) folds to `state: null` — unknown — so the surface can
  // fall back to the pointer copy instead of faking a state.
  getCliWireStatus: ({ respond }) => {
    wsRequest<{ state?: CliWireState | null }>(
      { type: 'getCliStatusSummary' },
      { timeoutMs: CLI_WIRE_STATUS_TIMEOUT_MS },
    )
      .then((payload) => respond({ state: payload?.state ?? null }))
      .catch(() => respond({ state: null }));
    return true;
  },
};
