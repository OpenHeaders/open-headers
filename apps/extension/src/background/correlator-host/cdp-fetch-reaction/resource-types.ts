/**
 * CDP resource-type vocabulary maps — `Fetch.requestPaused` resource
 * types onto the condition vocabulary and the fire-record vocabulary.
 */

import type { ResourceType, TrackedResourceType } from '@openheaders/core/types';

/** CDP `Fetch.requestPaused` resource type → our condition vocabulary. */
const CDP_TO_CONDITION_RESOURCE_TYPE: Readonly<Record<string, ResourceType>> = {
  Document: 'page',
  Stylesheet: 'stylesheet',
  Image: 'image',
  Media: 'media',
  Font: 'font',
  Script: 'script',
  XHR: 'xhr',
  Fetch: 'xhr',
  WebSocket: 'websocket',
};

/** CDP resource type → the tab-telemetry fire-record vocabulary. */
const CDP_TO_TRACKED_RESOURCE_TYPE: Readonly<Record<string, TrackedResourceType>> = {
  Document: 'main_frame',
  Stylesheet: 'stylesheet',
  Image: 'image',
  Media: 'media',
  Font: 'font',
  Script: 'script',
  XHR: 'xmlhttprequest',
  Fetch: 'xmlhttprequest',
  WebSocket: 'websocket',
  Ping: 'ping',
};

/** Map a CDP pause resource type onto the `resource-types` condition vocabulary. */
export function cdpResourceTypeToCondition(raw: string): ResourceType {
  return CDP_TO_CONDITION_RESOURCE_TYPE[raw] ?? 'other';
}

/** Map a CDP pause resource type onto the fire-record resource vocabulary. */
export function cdpResourceTypeToTracked(raw: string): TrackedResourceType {
  return CDP_TO_TRACKED_RESOURCE_TYPE[raw] ?? 'other';
}
