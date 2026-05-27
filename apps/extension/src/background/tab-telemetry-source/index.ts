/**
 * Tab Telemetry Source — in-process consumer of `RequestLifecycleStore`
 * that projects every emitted update onto tab-telemetry's existing
 * ingestion API. Replaces the data feed `request-monitor` provided.
 *
 * Tab-telemetry's outer API surface is unchanged (TT5); this module
 * just calls those functions from a single subscription instead of
 * five chrome.webRequest listeners.
 *
 * Also subscribes to the cross-driver `TabLifecycleBus` so it can drop
 * per-tab telemetry on `tab-forgotten` — previously called directly
 * from `modules/tab-listeners.ts`.
 */

import { logger } from '@utils/logger';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';

import { clearTab as tabTelemetryClearTab } from '../modules/tab-telemetry';
import { project } from './projection';

export interface TabTelemetrySourceOptions {
  readonly store: RequestLifecycleStore;
  readonly bus: TabLifecycleBus;
}

export interface TabTelemetrySourceHandle {
  dispose(): void;
}

export function startTabTelemetrySource(options: TabTelemetrySourceOptions): TabTelemetrySourceHandle {
  const detachStore = options.store.subscribe((update) => project(update, options));
  const detachBus = options.bus.subscribe((event) => {
    if (event.kind !== 'tab-forgotten') return;
    tabTelemetryClearTab(event.tabId);
  });
  logger.info('TabTelemetrySource', 'lifecycle → tab-telemetry projection online');
  return {
    dispose: () => {
      detachStore();
      detachBus();
    },
  };
}
