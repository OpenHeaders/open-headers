/**
 * Requests category — behavior of the HTTP request executor (the
 * workbench Send path).
 */

import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'requests.responseBodyCapMB': number;
    'requests.sseEventsNewestFirst': boolean;
    'requests.sseEventsGroupByName': boolean;
    'requests.sseEventsGroupRowLimit': number;
    'requests.grpcSendInvalidMessage': boolean;
    'requests.grpcMessagesNewestFirst': boolean;
    'requests.grpcMessagesGroupByType': boolean;
    'requests.grpcMessagesGroupRowLimit': number;
  }
}

registerSetting({
  key: 'requests.responseBodyCapMB',
  type: 'number',
  default: 2,
  // Validation admits the desktop ceiling everywhere so a synced value
  // never fails on the tighter host; the visible range is per host —
  // the extension holds response snapshots in service-worker messaging
  // and tab state, so its ceiling stays low, while the desktop app
  // keeps the body in local process memory.
  schema: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  labelKey: 'workbench.settings.def.requests.responseBodyCapMB.label',
  descriptionKey: 'workbench.settings.def.requests.responseBodyCapMB.description',
  category: 'requests',
  tags: ['response', 'body', 'truncate', 'limit', 'size', 'cap'],
  scope: 'user',
  numberRange: { min: 1, max: getCurrentHost() === 'desktop' ? 100 : 10, step: 1 },
});

// gRPC invoke pre-flight: by default a message that isn't valid JSON
// fails BEFORE the wire with the exact parse error. Opting in sends
// the call anyway with an EMPTY message, letting the server answer
// (typically INVALID_ARGUMENT) — the Postman posture.
registerSetting({
  key: 'requests.grpcSendInvalidMessage',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.requests.grpcSendInvalidMessage.label',
  descriptionKey: 'workbench.settings.def.requests.grpcSendInvalidMessage.description',
  category: 'requests',
  tags: ['grpc', 'invoke', 'message', 'json', 'validate', 'invalid', 'preflight'],
  scope: 'user',
});

// The SSE event list's order and grouping — written by the list's own
// toolbar too (one global value, no session/default split), so the
// choice survives Send/Stop remounts and reads the same everywhere.
registerSetting({
  key: 'requests.sseEventsNewestFirst',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.requests.sseEventsNewestFirst.label',
  descriptionKey: 'workbench.settings.def.requests.sseEventsNewestFirst.description',
  category: 'requests',
  tags: ['sse', 'stream', 'events', 'sort', 'order', 'newest', 'oldest'],
  scope: 'user',
});

registerSetting({
  key: 'requests.sseEventsGroupByName',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.requests.sseEventsGroupByName.label',
  descriptionKey: 'workbench.settings.def.requests.sseEventsGroupByName.description',
  category: 'requests',
  tags: ['sse', 'stream', 'events', 'group', 'cluster', 'name'],
  scope: 'user',
});

// The gRPC message timeline's order and grouping — the SSE trio's
// sibling (own keys: the two lists are independent surfaces), written
// by the timeline's own toolbar too.
registerSetting({
  key: 'requests.grpcMessagesNewestFirst',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.requests.grpcMessagesNewestFirst.label',
  descriptionKey: 'workbench.settings.def.requests.grpcMessagesNewestFirst.description',
  category: 'requests',
  tags: ['grpc', 'stream', 'messages', 'timeline', 'sort', 'order', 'newest', 'oldest'],
  scope: 'user',
});

registerSetting({
  key: 'requests.grpcMessagesGroupByType',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.requests.grpcMessagesGroupByType.label',
  descriptionKey: 'workbench.settings.def.requests.grpcMessagesGroupByType.description',
  category: 'requests',
  tags: ['grpc', 'stream', 'messages', 'timeline', 'group', 'cluster', 'type'],
  scope: 'user',
});

registerSetting({
  key: 'requests.grpcMessagesGroupRowLimit',
  type: 'number',
  default: 0,
  schema: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)),
  labelKey: 'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label',
  descriptionKey: 'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description',
  category: 'requests',
  tags: ['grpc', 'stream', 'messages', 'timeline', 'group', 'limit', 'rows', 'watch'],
  scope: 'user',
  numberRange: { min: 0, max: 100, step: 1 },
});

// Watch-several-groups-at-once mode: each group shows only its N
// newest rows (the window slides as events arrive); 0 = no limit.
registerSetting({
  key: 'requests.sseEventsGroupRowLimit',
  type: 'number',
  default: 0,
  schema: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)),
  labelKey: 'workbench.settings.def.requests.sseEventsGroupRowLimit.label',
  descriptionKey: 'workbench.settings.def.requests.sseEventsGroupRowLimit.description',
  category: 'requests',
  tags: ['sse', 'stream', 'events', 'group', 'limit', 'rows', 'watch'],
  scope: 'user',
  numberRange: { min: 0, max: 100, step: 1 },
});
