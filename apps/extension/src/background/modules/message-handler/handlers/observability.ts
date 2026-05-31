/** Observability-log RPCs. */

import { clearObservabilityLog, getObservabilityLog } from '../../observability-log';
import type { HandlerMap } from '../types';

export const observabilityHandlers: HandlerMap = {
  getObservabilityLog: ({ respond }) => {
    respond({ entries: [...getObservabilityLog()] });
  },

  clearObservabilityLog: ({ respond }) => {
    clearObservabilityLog();
    respond({ success: true });
  },
};
