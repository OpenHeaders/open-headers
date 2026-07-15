/** Product-telemetry RPCs — anonymous usage counting, not per-tab traffic telemetry. */

import type { TelemetryEvent } from '@openheaders/core/telemetry';
import {
  readProductTelemetrySnapshot,
  resetProductTelemetryInstallId,
  trackProductTelemetryEvent,
} from '../../product-telemetry';
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

  productTelemetryResetInstallId: ({ respond }) => {
    void resetProductTelemetryInstallId().then((installId) => respond({ installId }));
    return true;
  },
};
