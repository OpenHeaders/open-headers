/**
 * Lifecycle → tab-telemetry projection. Maps each emitted
 * `RequestLifecycleUpdate` onto the existing tab-telemetry API entry
 * points without mutating tab-telemetry's outer surface (TT5).
 *
 * Tab-telemetry ingestion is gated by `isTracked(tabId)` inside the
 * tab-telemetry module itself; we still pre-check here to avoid
 * normalization work on untracked tabs (the original `request-monitor`
 * did the same thing).
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TrackedResourceType } from '@/types/browser';

import {
  isTracked as isTabTracked,
  onMainFrameError,
  onMainFrameRedirect,
  onMainFrameRequest,
  recordObservedUrl,
  recordRequestObservation,
  recordRequestRedirect,
  updateRequestDeliveryMode,
} from '../modules/tab-telemetry';
import { isTrackableUrl, normalizeUrlForTracking } from '../modules/url-utils';

export interface ProjectionOptions {
  readonly store: RequestLifecycleStore;
}

export function project(update: RequestLifecycleUpdate, options: ProjectionOptions): void {
  switch (update.kind) {
    case 'started':
      projectStarted(update.lifecycle);
      return;
    case 'redirect':
      projectRedirect(update, options);
      return;
    case 'phase':
      projectPhase(update, options);
      return;
    default:
      return;
  }
}

function projectStarted(lifecycle: RequestLifecycle): void {
  const { tabId, requestId, url, method, resourceType, initiator, startedAtMs } = lifecycle;
  if (tabId === -1 || !isTabTracked(tabId)) return;
  if (!isTrackableUrl(url)) return;
  const normalized = normalizeUrlForTracking(url);
  recordObservedUrl(tabId, normalized);
  recordRequestObservation(tabId, {
    requestId,
    method,
    url,
    resourceType: resourceType as TrackedResourceType,
    ...(initiator !== undefined ? { initiator } : {}),
    timestamp: startedAtMs,
  });
  if (resourceType === 'main_frame') {
    onMainFrameRequest(tabId, requestId, normalized);
  }
}

function projectRedirect(
  update: Extract<RequestLifecycleUpdate, { kind: 'redirect' }>,
  options: ProjectionOptions,
): void {
  const { tabId, requestId, hop, nextUrl } = update;
  if (tabId === -1 || !isTabTracked(tabId)) return;
  if (!isTrackableUrl(nextUrl)) return;
  const lifecycle = options.store.get(tabId, requestId);
  if (!lifecycle) return;
  const resourceType = lifecycle.resourceType as TrackedResourceType;
  const normalized = normalizeUrlForTracking(nextUrl);
  recordObservedUrl(tabId, normalized);
  recordRequestObservation(tabId, {
    requestId,
    method: lifecycle.method,
    url: nextUrl,
    resourceType,
    timestamp: hop.timestampMs,
  });
  recordRequestRedirect(tabId, {
    requestId,
    sourceUrl: hop.sourceUrl,
    method: lifecycle.method,
    resourceType,
    statusCode: hop.statusCode,
    redirectUrl: hop.redirectUrl,
    timestamp: hop.timestampMs,
  });
  if (resourceType === 'main_frame') {
    onMainFrameRedirect(tabId, requestId, normalized);
  }
}

function projectPhase(
  update: Extract<RequestLifecycleUpdate, { kind: 'phase' }>,
  options: ProjectionOptions,
): void {
  const { tabId, requestId, patch } = update;
  if (tabId === -1 || !isTabTracked(tabId)) return;

  if (patch.fromCache !== undefined) {
    updateRequestDeliveryMode(tabId, requestId, patch.fromCache ? 'cached' : 'network');
  }

  if (patch.phase === 'failed') {
    const lifecycle = options.store.get(tabId, requestId);
    if (lifecycle?.resourceType === 'main_frame') {
      onMainFrameError(tabId, requestId);
    }
  }
}
