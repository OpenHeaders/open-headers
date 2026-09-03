/**
 * Inherited settings on a Settings surface — what the ancestor chain
 * supplies for the rows a container (or, in the request UI, a request)
 * shows: the inherited value reads as the row's PLACEHOLDER (full text
 * contrast, the tab's default posture) or, for a switch, as its
 * effective state; an "Inherited from Collection 'X' · Edit in parent"
 * line sits under the row while the row itself sets nothing. A row
 * with its own value shows that value with its dot and no line —
 * explicit wins, whatever the value (the settings-inheritance law).
 *
 * The view is the shared rule's `inheritedSettingsFor` result over the
 * chain read off the trees, plus the opener the line rides; a surface
 * WITHOUT the ancestor plane passes no view and keeps the runtime
 * defaults as its placeholders.
 */

import type { InheritableSettingKey, InheritableSettings, InheritedSettingSource } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Typography } from 'antd';
import type React from 'react';
import { inheritSourceLabel } from '../../request-editor/inherited-auth';

const { Text } = Typography;

export type ContainerLevel = 'collection' | 'folder';

/** The chain's contribution for a surface — the placeholders, their
 *  sources, and the opener onto the supplying level. */
export interface InheritedSettingsView {
  settings: Partial<InheritableSettings>;
  sources: readonly InheritedSettingSource[];
  onOpenSource?: (level: ContainerLevel, uid: string, name: string) => void;
}

/** The surface's placeholders where nothing is inherited — a
 *  collection (no ancestor) or a request outside every collection. */
export const NO_INHERITED_SETTINGS: InheritedSettingsView = { settings: {}, sources: [] };

/** The listed keys of `source`, as their own object — a kind's slice of
 *  a container's `settings`, or a request draft's settings slice. */
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

const InheritedSettingNote: React.FC<{
  source: InheritedSettingSource;
  onOpenSource?: InheritedSettingsView['onOpenSource'];
}> = ({ source, onOpenSource }) => {
  const t = useT();
  return (
    <div
      data-testid="oh-inherited-setting-note"
      data-key={source.key}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
    >
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.request.settings.inheritedFrom', {
          source: inheritSourceLabel(t, { kind: source.level, name: source.name }),
        })}
      </Text>
      {onOpenSource !== undefined && (
        <Button
          type="link"
          size="small"
          style={{ fontSize: 11, height: 'auto', padding: 0 }}
          data-testid="oh-inherited-setting-edit-in-parent"
          onClick={() => onOpenSource(source.level, source.uid, source.name)}
        >
          {t('workbench.editors.request.auth.editInParent')}
        </Button>
      )}
    </div>
  );
};

/** The row-side reads over one view — each returns the row props the
 *  inherited plane adds (`placeholder` / `checked` and the `note`). */
export interface InheritedRows {
  /** The line under a row inheriting `key`; nothing while the row
   *  sets its own value or nobody above sets the knob. */
  note<K extends InheritableSettingKey>(key: K, own: InheritableSettings[K] | undefined): React.ReactNode | undefined;
  /** A text / number / select row: the inherited value formatted as
   *  the placeholder, else the catalog's default text. */
  field<K extends InheritableSettingKey>(
    key: K,
    own: InheritableSettings[K] | undefined,
    fallback: string,
    format: (value: NonNullable<InheritableSettings[K]>) => string,
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
  const note: InheritedRows['note'] = (key, own) => {
    if (own !== undefined) return undefined;
    const source = inheritedSourceOf(view, key);
    if (source === undefined) return undefined;
    return <InheritedSettingNote source={source} onOpenSource={view?.onOpenSource} />;
  };
  return {
    note,
    field: (key, own, fallback, format) => {
      const inherited = view?.settings[key];
      return {
        placeholder: inherited === undefined ? fallback : format(inherited),
        note: note(key, own),
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
