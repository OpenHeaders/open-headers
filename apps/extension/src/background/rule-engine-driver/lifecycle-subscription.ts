/**
 * Lifecycle Subscription — bridges the engine-side `RequestLifecycleStore`
 * to the extension's rule-engine surface. Dispatches each emitted
 * `RequestLifecycleUpdate` to the appropriate handler module; owns no
 * state itself.
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TrackedResourceType } from '@/types/browser';

import { type UpdateBadge, triggerBadgeIfActive } from './badge-trigger';
import { recordFiresForObservation } from './fire-recorder';
import { dropOnNetworkFailure, ingestMatchObservation } from './match-tracker';
import { NETWORK_FAILURE_ERRORS } from './network-failure-errors';

export interface LifecycleSubscriptionOptions {
  readonly store: RequestLifecycleStore;
  readonly updateBadge: UpdateBadge;
}

export function installLifecycleSubscription(options: LifecycleSubscriptionOptions): () => void {
  return options.store.subscribe((update) => dispatch(update, options));
}

function dispatch(update: RequestLifecycleUpdate, options: LifecycleSubscriptionOptions): void {
  switch (update.kind) {
    case 'started':
      onStarted(update.lifecycle, options);
      return;
    case 'redirect':
      onRedirect(update, options);
      return;
    case 'phase':
      onPhase(update, options);
      return;
    default:
      return;
  }
}

function onStarted(lifecycle: RequestLifecycle, options: LifecycleSubscriptionOptions): void {
  const { tabId, requestId, url, resourceType, startedAtMs } = lifecycle;
  const rt = resourceType as TrackedResourceType;
  const matched = ingestMatchObservation({ tabId, url, resourceType: rt });
  recordFiresForObservation({ tabId, url, requestId, timestampMs: startedAtMs, resourceType: rt });
  if (matched) triggerBadgeIfActive(tabId, options.updateBadge);
}

function onRedirect(
  update: Extract<RequestLifecycleUpdate, { kind: 'redirect' }>,
  options: LifecycleSubscriptionOptions,
): void {
  const { tabId, requestId, hop, nextUrl } = update;
  const lifecycle = options.store.get(tabId, requestId);
  if (!lifecycle) return;
  const rt = lifecycle.resourceType as TrackedResourceType;
  const matched = ingestMatchObservation({ tabId, url: nextUrl, resourceType: rt });
  recordFiresForObservation({ tabId, url: nextUrl, requestId, timestampMs: hop.timestampMs, resourceType: rt });
  if (matched) triggerBadgeIfActive(tabId, options.updateBadge);
}

function onPhase(
  update: Extract<RequestLifecycleUpdate, { kind: 'phase' }>,
  options: LifecycleSubscriptionOptions,
): void {
  const code = update.patch.error?.code;
  if (update.patch.phase !== 'failed' || code === undefined || !NETWORK_FAILURE_ERRORS.has(code)) return;
  const lifecycle = options.store.get(update.tabId, update.requestId);
  if (!lifecycle) return;
  const removed = dropOnNetworkFailure({ tabId: lifecycle.tabId, url: lifecycle.url });
  if (removed) triggerBadgeIfActive(lifecycle.tabId, options.updateBadge);
}
