/**
 * Inherited settings on a Settings surface — what the ancestor chain
 * supplies, for ONE request kind, to the rows a container (or, in the
 * request UI, a request) shows: the inherited value reads as the row's
 * PLACEHOLDER (full text contrast, the tab's default posture) or, for
 * a switch, as its effective state; an "Inherited from Collection 'X'
 * · Edit in parent" line sits under the row while the row itself sets
 * nothing. A row with its own value shows that value with its dot —
 * explicit wins, whatever the value (the settings-inheritance law) —
 * and, when a level above sets the knob too, an "Overrides Folder 'Y'
 * (1.2)" line so the shadowing is never silent (`InheritedSettingNote`).
 *
 * The view is the shared rule's `inheritedSettingsFor` result over
 * the chain read off the trees, the knobs' provenance (every level's
 * value, for the line's chain hover), the subject the surface stands
 * for and the opener the line rides; a surface WITHOUT the ancestor
 * plane passes no view and keeps the runtime defaults as its
 * placeholders.
 */

import type { AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import {
  inheritedSettingsFor,
  type SettingProvenance,
  type SettingsCarrier,
  settingProvenanceFor,
} from '@openheaders/core/settings-inheritance';
import type { InheritableSettingKey, InheritableSettings, InheritedSettingSource } from '@openheaders/core/types';
import type React from 'react';
import { InheritedSettingNote, type InheritedSettingsSubject, type SettingValueFormat } from './InheritedSettingNote';

export type ContainerLevel = 'collection' | 'folder';

/** The chain's contribution for a surface of one kind — the
 *  placeholders, their sources, every level's value per knob, the
 *  surface's own level name and the opener onto the supplying level. */
export interface InheritedSettingsView {
  settings: Partial<InheritableSettings>;
  sources: readonly InheritedSettingSource[];
  /** Per knob, every ancestor level's value outer → inner; absent =
   *  no history known, the line names the nearest level alone. */
  provenance?: SettingProvenance<InheritableSettingKey>;
  /** How the chain hover names this surface's own level; a request
   *  when absent. */
  subject?: InheritedSettingsSubject;
  onOpenSource?: (level: ContainerLevel, uid: string, name: string) => void;
}

/** The surface's placeholders where nothing is inherited — a
 *  collection (no ancestor) or a request outside every collection. */
export const NO_INHERITED_SETTINGS: InheritedSettingsView = { settings: {}, sources: [] };

/** The view of `kind` over the chain (outer → inner) for a surface
 *  standing for `subject` — what the request editors and a folder's
 *  Settings section derive off the tree-read ancestry. */
export function inheritedSettingsViewFor(
  kind: AuthProtocolKind,
  chain: readonly SettingsCarrier[],
  subject: InheritedSettingsSubject,
  onOpenSource: InheritedSettingsView['onOpenSource'],
): InheritedSettingsView {
  const inherited = inheritedSettingsFor(kind, chain);
  return {
    settings: inherited.settings,
    sources: inherited.sources,
    provenance: settingProvenanceFor(kind, chain),
    subject,
    onOpenSource,
  };
}

/** The listed keys of `source`, as their own object — a request
 *  draft's settings slice. */
export function sliceOf<T, K extends keyof T>(source: T, keys: readonly K[]): { [P in K]?: T[P] } {
  const out: { [P in K]?: T[P] } = {};
  for (const key of keys) out[key] = source[key];
  return out;
}

export function inheritedSourceOf(
  view: InheritedSettingsView | undefined,
  key: InheritableSettingKey,
): InheritedSettingSource | undefined {
  return view?.sources.find((source) => source.key === key);
}

/** The row-side reads over one view — each returns the row props the
 *  inherited plane adds (`placeholder` / `checked` and the `note`). */
export interface InheritedRows {
  /** The line under a row an ancestor sets — inherited while the row
   *  sets nothing, overrides while it does; nothing when nobody above
   *  sets the knob. `format` words the value the way the row does. */
  note<K extends InheritableSettingKey>(
    key: K,
    own: InheritableSettings[K] | undefined,
    format?: SettingValueFormat<K>,
  ): React.ReactNode | undefined;
  /** A text / number / select row: the inherited value formatted as
   *  the placeholder, else the catalog's default text. */
  field<K extends InheritableSettingKey>(
    key: K,
    own: InheritableSettings[K] | undefined,
    fallback: string,
    format: SettingValueFormat<K>,
  ): { placeholder: string; note: React.ReactNode | undefined };
  /** A switch row: own, else inherited, else the runtime default. */
  toggle<K extends BooleanSettingKey>(
    key: K,
    own: InheritableSettings[K] | undefined,
    fallback: boolean,
  ): { checked: boolean; note: React.ReactNode | undefined };
}

/** The knobs a switch row edits. */
export type BooleanSettingKey = {
  [K in InheritableSettingKey]: InheritableSettings[K] extends boolean | undefined ? K : never;
}[InheritableSettingKey];

export function inheritedRowsFor(view: InheritedSettingsView | undefined): InheritedRows {
  const note: InheritedRows['note'] = (key, own, format) => {
    const source = inheritedSourceOf(view, key);
    if (source === undefined || view === undefined) return undefined;
    return (
      <InheritedSettingNote
        source={source}
        inherited={view.settings[key]}
        own={own}
        levels={view.provenance?.[key]}
        format={format}
        subject={view.subject ?? 'request'}
        onOpenSource={view.onOpenSource}
      />
    );
  };
  return {
    note,
    field: (key, own, fallback, format) => {
      const inherited = view?.settings[key];
      return {
        placeholder: inherited === undefined ? fallback : format(inherited),
        note: note(key, own, format),
      };
    },
    toggle: (key, own, fallback) => {
      const inherited = view?.settings[key];
      return {
        checked: typeof own === 'boolean' ? own : typeof inherited === 'boolean' ? inherited : fallback,
        note: note(key, own),
      };
    },
  };
}
