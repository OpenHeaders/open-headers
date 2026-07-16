/** Product-telemetry RPCs — anonymous usage counting, not per-tab traffic telemetry. */

import type { TelemetryEvent } from '@openheaders/core/telemetry';
import { readProductTelemetrySnapshot, trackProductTelemetryEvent } from '../../product-telemetry';
import type { HandlerMap } from '../types';

export const productTelemetryHandlers: HandlerMap = {
  productTelemetryTrack: ({ message, respond }) => {
    trackProductTelemetryEvent(message.event as TelemetryEvent);
    respond({ success: true });
  },

  productTelemetryRead: ({ respond }) => {
    void readProductTelemetrySnapshot().then(respond);
    return true;
  },
};
