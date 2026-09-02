/**
 * Script slots — the vocabulary the Scripts tab's rail is drawn from.
 *
 * A slot is one script a request kind's send brackets (before the
 * request leaves, after the response lands); a group is one request
 * kind's slots. The container editor draws every group under its kind
 * header — a collection's HTTP scripts run for its HTTP requests and
 * nothing else — while a request's tab draws its own kind's slots
 * flat. The HTTP kind is the only one carrying script slots today; the
 * session kinds join here, one group each, when their slots land.
 *
 * Scripts compose, they never resolve: every level's slot runs, outer
 * → inner, so a slot has no inherit state and the rail no override
 * affordance — the "Runs after …" line names the levels ahead.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';
import type { RequestKind } from '../../request-kind-menu';

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
  slots: readonly ScriptSlotDescriptor[];
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
};

/** The groups in rail order — one per request kind carrying slots. */
export const SCRIPT_SLOT_GROUPS: readonly ScriptSlotGroup[] = [
  { requestKind: 'http', slots: [SCRIPT_SLOT_BY_KIND['pre-request'], SCRIPT_SLOT_BY_KIND['post-response']] },
];

/** The rail's first slot — the tab's initial selection. */
export const DEFAULT_SCRIPT_SLOT: ScriptKind = SCRIPT_SLOT_GROUPS[0].slots[0].kind;

/** The editable sources, one per slot. */
export type ScriptSlotValues = Readonly<Record<ScriptKind, string>>;

/** Per-slot flags (the rail's unsaved dots). */
export type ScriptSlotFlags = Partial<Readonly<Record<ScriptKind, boolean>>>;

/** The rail's slots in order, and their kinds. */
export const SCRIPT_SLOTS: readonly ScriptSlotDescriptor[] = SCRIPT_SLOT_GROUPS.flatMap((group) => group.slots);
export const SCRIPT_KINDS: readonly ScriptKind[] = SCRIPT_SLOTS.map((slot) => slot.kind);

/** The entity field a slot is stored in — the request's, the folder's
 *  and the collection's script fields share these names. */
export type ScriptSlotField = 'preRequestScript' | 'postResponseScript';

export const SCRIPT_SLOT_FIELD: Readonly<Record<ScriptKind, ScriptSlotField>> = {
  'pre-request': 'preRequestScript',
  'post-response': 'postResponseScript',
};

/** Anything carrying the script fields — a request draft, a container
 *  entity, the per-section unsaved flags. */
export type ScriptSlotCarrier<T = string> = Partial<Readonly<Record<ScriptSlotField, T>>>;

/** Read a carrier's fields as a slot record, `fallback` for an absent field. */
export function scriptSlotRecordOf<T>(carrier: ScriptSlotCarrier<T>, fallback: T): Readonly<Record<ScriptKind, T>> {
  return {
    'pre-request': carrier[SCRIPT_SLOT_FIELD['pre-request']] ?? fallback,
    'post-response': carrier[SCRIPT_SLOT_FIELD['post-response']] ?? fallback,
  };
}

/** The editable sources off a carrier — an absent field is the empty editor. */
export function scriptSlotValuesOf(carrier: ScriptSlotCarrier): ScriptSlotValues {
  return scriptSlotRecordOf(carrier, '');
}

/** A carrier with one slot's field replaced — the request draft's edit. */
export function withScriptSlot<D extends ScriptSlotCarrier>(carrier: D, kind: ScriptKind, value: string): D {
  switch (kind) {
    case 'pre-request':
      return { ...carrier, preRequestScript: value };
    case 'post-response':
      return { ...carrier, postResponseScript: value };
  }
}
