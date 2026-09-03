/**
 * InheritedSettingNote — the line under a Settings row that an
 * ancestor level sets, in one of two readings:
 *
 *   - the row sets nothing: "Inherited from Folder ‘Y’ · Edit in
 *     parent" — the placeholder above it is that level's value;
 *   - the row sets its own value: "Overrides Folder ‘Y’ (1.2) · Edit
 *     in parent" — the surface shadows the nearest level's value, and
 *     the line says so with the value it shadows.
 *
 * Both name the NEAREST level (the one the row would read, the one it
 * overrides). When more than one level above sets the knob, an (i)
 * lists the whole chain outermost first, ending with this surface's
 * own value when it has one — so a request under a folder that
 * overrode the collection sees every value on the way down.
 * Transparency is the point: nobody overrides a level without being
 * told the level was there.
 */

import type { SettingLevelValue } from '@openheaders/core/settings-inheritance';
import type { InheritableSettingKey, InheritableSettings, InheritedSettingSource } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, Typography } from 'antd';
import type React from 'react';
import { inheritSourceLabel } from '../../request-editor/inherited-auth';

const { Text } = Typography;

/** The surface the note sits on — how the chain names its own level. */
export type InheritedSettingsSubject = 'request' | 'folder';

export type SettingValueFormat<K extends InheritableSettingKey> = (value: NonNullable<InheritableSettings[K]>) => string;

export interface InheritedSettingNoteProps<K extends InheritableSettingKey> {
  /** The nearest level that sets the knob. */
  source: InheritedSettingSource;
  /** That level's value — the placeholder, or the value the row overrides. */
  inherited: InheritableSettings[K] | undefined;
  /** The row's own value; defined = the overrides reading. */
  own: InheritableSettings[K] | undefined;
  /** Every level that sets the knob, outer → inner; absent = no
   *  history known, the line names the nearest level alone. */
  levels?: readonly SettingLevelValue<K>[];
  /** The row's own value formatting; booleans read Enabled / Disabled
   *  without one, anything else its string form. */
  format?: SettingValueFormat<K>;
  subject: InheritedSettingsSubject;
  onOpenSource?: (level: 'collection' | 'folder', uid: string, name: string) => void;
}

function formatValue<K extends InheritableSettingKey>(
  t: Translate,
  value: NonNullable<InheritableSettings[K]>,
  format: SettingValueFormat<K> | undefined,
): string {
  if (typeof value === 'boolean') return t(value ? 'shared.settingsRows.enabled' : 'shared.settingsRows.disabled');
  return format !== undefined ? format(value) : String(value);
}

export function InheritedSettingNote<K extends InheritableSettingKey>({
  source,
  inherited,
  own,
  levels,
  format,
  subject,
  onOpenSource,
}: InheritedSettingNoteProps<K>): React.ReactElement {
  const t = useT();
  const sourceLabel = inheritSourceLabel(t, { kind: source.level, name: source.name });
  const overrides = own !== undefined;
  const line =
    overrides && inherited !== undefined
      ? t('workbench.editors.request.settings.overridesSource', {
          source: sourceLabel,
          value: formatValue(t, inherited, format),
        })
      : t('workbench.editors.request.settings.inheritedFrom', { source: sourceLabel });
  const chain = levels !== undefined && levels.length > 1 ? levels : undefined;
  return (
    <div
      data-testid="oh-inherited-setting-note"
      data-key={source.key}
      data-reading={overrides ? 'overrides' : 'inherited'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
    >
      <Text type="secondary" style={{ fontSize: 11 }}>
        {line}
      </Text>
      {chain !== undefined && (
        <span data-testid="oh-inherited-setting-chain">
          <InfoTrigger
            placement="bottomLeft"
            content={{
              title: t('workbench.editors.request.settings.settingChainTitle'),
              summary: t('workbench.editors.request.settings.settingChainSummary'),
              sections: [
                {
                  heading: t('workbench.editors.request.settings.settingChainHeading'),
                  layout: 'inline',
                  items: [
                    ...chain.map((level) => ({
                      key: level.uid,
                      label: inheritSourceLabel(t, { kind: level.level, name: level.name }),
                      desc: formatValue(t, level.value, format),
                    })),
                    ...(own !== undefined
                      ? [
                          {
                            key: 'self',
                            label: t(
                              subject === 'folder'
                                ? 'workbench.editors.request.settings.thisFolder'
                                : 'workbench.editors.request.settings.thisRequest',
                            ),
                            desc: formatValue(t, own, format),
                          },
                        ]
                      : []),
                  ],
                },
              ],
            }}
          />
        </span>
      )}
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
}
