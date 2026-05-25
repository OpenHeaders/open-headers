/**
 * Tab Telemetry Source — in-process consumer of `RequestLifecycleStore`
 * that projects every emitted update onto tab-telemetry's existing
 * ingestion API. Replaces the data feed `request-monitor` provided.
 *
 * Tab-telemetry's outer API surface is unchanged (TT5); this module
 * just calls those functions from a single subscription instead of
 * five chrome.webRequest listeners.
 */

import { logger } from '@utils/logger';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';

import { project } from './projection';

export interface TabTelemetrySourceOptions {
  readonly store: RequestLifecycleStore;
}

export interface TabTelemetrySourceHandle {
  dispose(): void;
}

export function startTabTelemetrySource(options: TabTelemetrySourceOptions): TabTelemetrySourceHandle {
  const detach = options.store.subscribe((update) => project(update, options));
  logger.info('TabTelemetrySource', 'lifecycle → tab-telemetry projection online');
  return {
    dispose: () => detach(),
  };
}
