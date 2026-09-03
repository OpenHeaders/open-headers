/**
 * Script slots — the vocabulary the Scripts tab's rail is drawn from.
 *
 * A slot is one script a request kind's lifecycle hooks (before the
 * request leaves, after the response lands; before a session connects,
 * before a message goes out, on a message received, after the session
 * closes); a group is one request kind's slots. The container editor
 * draws every group under its kind header — a collection's HTTP
 * scripts run for its HTTP requests and nothing else — while a
 * request's tab draws its own kind's slots flat. The storage side
 * (where each kind's source lives, its sibling file) is core's
 * (`@openheaders/core/scripts` — the slot table); this module adds the
 * presentation: labels, placeholders, and the groups the rail shows.
 *
 * Every kind in the vocabulary has a descriptor (`SCRIPT_SLOT_BY_KIND`
 * is exhaustive — a widened kind cannot ship without its rail entry),
 * but a group joins the rail (`SCRIPT_SLOT_GROUPS`) only once its
 * slots run: no teaser groups.
 *
 * Scripts compose, they never resolve: every level's slot runs, outer
 * → inner, so a slot has no inherit state and the rail no override
 * affordance — the "Runs after …" line names the levels ahead.
 */

import type { ScriptKind, ScriptSlotCarrier, SessionScriptKind } from '@openheaders/core/scripts';
import { readScriptSlot, SCRIPT_KINDS, withScriptSlot } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';
import type { RequestKind } from '../../request-kind-menu';

export { SCRIPT_KINDS, withScriptSlot };

/** Where the tab is mounted — the placeholder speaks to this request,
 *  or to every request the container holds. */
export type ScriptSlotScope = 'request' | 'container';

export interface ScriptSlotDescriptor {
  kind: ScriptKind;
  labelKey: MessageKey;
  placeholderKey: Readonly<Record<ScriptSlotScope, MessageKey>>;
}

export interface ScriptSlotGroup {
  /** The request kind whose sends the group's slots bracket. */
  requestKind: RequestKind;
  /** Further kinds on the same wire family that run these slots — the
   *  Socket.IO flavor under WebSocket. The rail names them beside the
   *  kind. */
  flavors?: readonly RequestKind[];
  /** The caption of the kind's lifecycle card (the `(i)` cards) — the
   *  kind's Settings tab names its example the same way. */
  captionKey: MessageKey;
  slots: readonly ScriptSlotDescriptor[];
}

/** A session kind's descriptor — its keys follow the kind's camel name. */
function sessionSlot(
  kind: SessionScriptKind,
  keys: { label: MessageKey; request: MessageKey; container: MessageKey },
): ScriptSlotDescriptor {
  return { kind, labelKey: keys.label, placeholderKey: { request: keys.request, container: keys.container } };
}

/** Every slot by kind — exhaustive over `ScriptKind`, so a widened kind
 *  cannot ship without its rail entry. */
export const SCRIPT_SLOT_BY_KIND: Readonly<Record<ScriptKind, ScriptSlotDescriptor>> = {
  'pre-request': {
    kind: 'pre-request',
    labelKey: 'workbench.editors.request.scripts.preRequest',
    placeholderKey: {
      request: 'workbench.editors.request.scripts.prePlaceholder',
      container: 'workbench.editors.request.scripts.prePlaceholderContainer',
    },
  },
  'post-response': {
    kind: 'post-response',
    labelKey: 'workbench.editors.request.scripts.postResponse',
    placeholderKey: {
      request: 'workbench.editors.request.scripts.postPlaceholder',
      container: 'workbench.editors.request.scripts.postPlaceholderContainer',
    },
  },
  'grpc-before-invoke': sessionSlot('grpc-before-invoke', {
    label: 'workbench.editors.request.scripts.grpcBeforeInvoke',
    request: 'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder',
    container: 'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer',
  }),
  'grpc-on-message': sessionSlot('grpc-on-message', {
    label: 'workbench.editors.request.scripts.grpcOnMessage',
    request: 'workbench.editors.request.scripts.grpcOnMessagePlaceholder',
    container: 'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer',
  }),
  'grpc-after-response': sessionSlot('grpc-after-response', {
    label: 'workbench.editors.request.scripts.grpcAfterResponse',
    request: 'workbench.editors.request.scripts.grpcAfterResponsePlaceholder',
    container: 'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer',
  }),
  'ws-before-connect': sessionSlot('ws-before-connect', {
    label: 'workbench.editors.request.scripts.wsBeforeConnect',
    request: 'workbench.editors.request.scripts.wsBeforeConnectPlaceholder',
    container: 'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer',
  }),
  'ws-before-send': sessionSlot('ws-before-send', {
    label: 'workbench.editors.request.scripts.wsBeforeSend',
    request: 'workbench.editors.request.scripts.wsBeforeSendPlaceholder',
    container: 'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer',
  }),
  'ws-on-message': sessionSlot('ws-on-message', {
    label: 'workbench.editors.request.scripts.wsOnMessage',
    request: 'workbench.editors.request.scripts.wsOnMessagePlaceholder',
    container: 'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer',
  }),
  'ws-after-close': sessionSlot('ws-after-close', {
    label: 'workbench.editors.request.scripts.wsAfterClose',
    request: 'workbench.editors.request.scripts.wsAfterClosePlaceholder',
    container: 'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer',
  }),
  'mqtt-before-connect': sessionSlot('mqtt-before-connect', {
    label: 'workbench.editors.request.scripts.mqttBeforeConnect',
    request: 'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder',
    container: 'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer',
  }),
  'mqtt-before-publish': sessionSlot('mqtt-before-publish', {
    label: 'workbench.editors.request.scripts.mqttBeforePublish',
    request: 'workbench.editors.request.scripts.mqttBeforePublishPlaceholder',
    container: 'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer',
  }),
  'mqtt-on-message': sessionSlot('mqtt-on-message', {
    label: 'workbench.editors.request.scripts.mqttOnMessage',
    request: 'workbench.editors.request.scripts.mqttOnMessagePlaceholder',
    container: 'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer',
  }),
  'mqtt-after-close': sessionSlot('mqtt-after-close', {
    label: 'workbench.editors.request.scripts.mqttAfterClose',
    request: 'workbench.editors.request.scripts.mqttAfterClosePlaceholder',
    container: 'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer',
  }),
};

/** The groups in rail order — one per request kind whose slots RUN. The
 *  session kinds' groups join here with their build slices; both
 *  WebSocket flavors are one group (one wire family, one hook set). */
export const SCRIPT_SLOT_GROUPS: readonly ScriptSlotGroup[] = [
  {
    requestKind: 'http',
    captionKey: 'workbench.editors.request.settings.exampleCaption',
    slots: [SCRIPT_SLOT_BY_KIND['pre-request'], SCRIPT_SLOT_BY_KIND['post-response']],
  },
  {
    requestKind: 'grpc',
    captionKey: 'workbench.editors.grpc.settings.exampleCaption',
    slots: [
      SCRIPT_SLOT_BY_KIND['grpc-before-invoke'],
      SCRIPT_SLOT_BY_KIND['grpc-on-message'],
      SCRIPT_SLOT_BY_KIND['grpc-after-response'],
    ],
  },
  {
    requestKind: 'websocket',
    flavors: ['socketio'],
    captionKey: 'workbench.editors.websocket.settings.exampleCaption',
    slots: [
      SCRIPT_SLOT_BY_KIND['ws-before-connect'],
      SCRIPT_SLOT_BY_KIND['ws-before-send'],
      SCRIPT_SLOT_BY_KIND['ws-on-message'],
      SCRIPT_SLOT_BY_KIND['ws-after-close'],
    ],
  },
  {
    requestKind: 'mqtt',
    captionKey: 'workbench.editors.mqtt.settings.exampleCaption',
    slots: [
      SCRIPT_SLOT_BY_KIND['mqtt-before-connect'],
      SCRIPT_SLOT_BY_KIND['mqtt-before-publish'],
      SCRIPT_SLOT_BY_KIND['mqtt-on-message'],
      SCRIPT_SLOT_BY_KIND['mqtt-after-close'],
    ],
  },
];

/** The group a request of `kind` draws on its own tab — a flavor reads
 *  its family's group (Socket.IO the WebSocket one). Empty for a kind
 *  whose slots do not run yet (its editor mounts no Scripts tab). */
export function scriptSlotGroupsFor(kind: RequestKind): readonly ScriptSlotGroup[] {
  return SCRIPT_SLOT_GROUPS.filter((group) => group.requestKind === kind || group.flavors?.includes(kind) === true);
}

/** The group a slot belongs to — its kind's lifecycle; absent for a
 *  kind whose group has not joined the rail. */
export function scriptSlotGroupOf(kind: ScriptKind): ScriptSlotGroup | undefined {
  return SCRIPT_SLOT_GROUPS.find((group) => group.slots.some((slot) => slot.kind === kind));
}

/** The rail's first slot — the tab's initial selection. */
export const DEFAULT_SCRIPT_SLOT: ScriptKind = SCRIPT_SLOT_GROUPS[0].slots[0].kind;

/** The editable sources, one per slot of the whole vocabulary — a
 *  mount draws the kinds its groups list and holds the rest untouched. */
export type ScriptSlotValues = Readonly<Record<ScriptKind, string>>;

/** Per-slot flags (the rail's unsaved dots). */
export type ScriptSlotFlags = Partial<Readonly<Record<ScriptKind, boolean>>>;

/** Every slot empty — the editor's blank state. */
export function emptyScriptSlotValues(): ScriptSlotValues {
  return scriptSlotValuesOf({});
}

/** The editable sources off a carrier — an absent slot is the empty
 *  editor. Spelled out per kind so the record stays exhaustive by type. */
export function scriptSlotValuesOf(carrier: ScriptSlotCarrier): ScriptSlotValues {
  const read = (kind: ScriptKind): string => readScriptSlot(carrier, kind) ?? '';
  return {
    'pre-request': read('pre-request'),
    'post-response': read('post-response'),
    'grpc-before-invoke': read('grpc-before-invoke'),
    'grpc-on-message': read('grpc-on-message'),
    'grpc-after-response': read('grpc-after-response'),
    'ws-before-connect': read('ws-before-connect'),
    'ws-before-send': read('ws-before-send'),
    'ws-on-message': read('ws-on-message'),
    'ws-after-close': read('ws-after-close'),
    'mqtt-before-connect': read('mqtt-before-connect'),
    'mqtt-before-publish': read('mqtt-before-publish'),
    'mqtt-on-message': read('mqtt-on-message'),
    'mqtt-after-close': read('mqtt-after-close'),
  };
}

/** The per-slot unsaved flags off the request editor's per-section
 *  flags — the HTTP pair's fields; a session slot's flag rides its
 *  editor's own flags when its tab lands. */
export function scriptSlotFlagsOf(flags: { preRequestScript: boolean; postResponseScript: boolean }): ScriptSlotFlags {
  return { 'pre-request': flags.preRequestScript, 'post-response': flags.postResponseScript };
}

/** The per-slot unsaved flags of a draft against its saved sources —
 *  the container editor's dots over the whole vocabulary: a slot is
 *  unsaved when its editor text differs from the entity's, verbatim
 *  (the section's own dirty rule); only the flagged slots are set. */
export function scriptSlotFlagsBetween(draft: ScriptSlotValues, saved: ScriptSlotValues): ScriptSlotFlags {
  const flags: Partial<Record<ScriptKind, boolean>> = {};
  for (const kind of SCRIPT_KINDS) {
    if (draft[kind] !== saved[kind]) flags[kind] = true;
  }
  return flags;
}
