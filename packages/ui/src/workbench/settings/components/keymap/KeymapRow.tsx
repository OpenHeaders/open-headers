/**
 * KeymapRow — one action row of the Keymap pane.
 *
 * `Label ......... [chord badge] [unbind] [reset]` with the modified
 * dot and description popover of a regular setting row. Clicking the
 * chord badge arms inline recording (Escape or a re-click cancels);
 * the captured chord commits straight to the setting, so dispatch and
 * every hint surface update immediately.
 *
 * Carries `data-setting-key` like FieldRow, so settings-search deep
 * links scroll-and-flash to it unchanged.
 */

import { CloseOutlined, UndoOutlined } from '@ant-design/icons';
import { hasCapability } from '@openheaders/core/capabilities';
import { Button, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutKbd } from '../../../../components/ShortcutKbd';
import { useChordLabel } from '../../../hooks/useWorkspaceShortcuts';
import { useChordCapture } from '../../fields/use-chord-capture';
import { useIsModified, useResetSetting, useUntypedSetting } from '../../hooks';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { resolveSettingDef } from '../../localize';
import { get as storeGet } from '../../store';
import type { SettingDef, SettingKey, SettingsMap } from '../../types';

interface KeymapRowProps {
  def: SettingDef;
}

const KeymapRow: React.FC<KeymapRowProps> = ({ def: rawDef }) => {
  const { token } = theme.useToken();
  const t = useT();
  const def = useMemo(() => resolveSettingDef(rawDef, t), [rawDef, t]);
  const [value, setValue] = useUntypedSetting(def.key);
  const chordLabel = useChordLabel(def.key as SettingKey);
  const modified = useIsModified(def.key as SettingKey);
  const reset = useResetSetting(def.key as SettingKey);
  const { recording, toggle } = useChordCapture(setValue);

  if (def.when && !def.when(<K extends SettingKey>(k: K): SettingsMap[K] => storeGet(k))) {
    return null;
  }

  const chord = typeof value === 'string' ? value : '';
  const capabilityGated = def.requiresCapability !== undefined && !hasCapability(def.requiresCapability);
  const gateHint = def.capabilityUnavailableHint ?? t('workbench.settings.row.capabilityUnavailable');

  const badge = recording ? (
    <Tag color="processing" style={{ margin: 0 }}>
      {t('workbench.settings.keymapPane.recording')}
    </Tag>
  ) : chordLabel ? (
    <ShortcutKbd label={chordLabel} surface="page" />
  ) : (
    <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{t('workbench.settings.keymapPane.unbound')}</span>
  );

  return (
    <div
      className="settings-field-row"
      data-setting-key={def.key}
      style={{
        display: 'flex',
        alignItems: 'center',
        columnGap: 6,
        padding: '3px 0',
        minHeight: 30,
      }}
    >
      {modified && (
        <Tooltip title={t('workbench.settings.row.modified')}>
          <span
            role="img"
            aria-label={t('workbench.settings.row.modifiedAria')}
            style={{ width: 5, height: 5, borderRadius: '50%', background: token.colorPrimary, flex: 'none' }}
          />
        </Tooltip>
      )}
      <span style={{ fontSize: 13, color: token.colorText, minWidth: 0 }}>{def.label}</span>
      {def.description && (
        <InfoTrigger
          content={{ title: def.label, summary: def.description }}
          ariaLabel={t('workbench.settings.row.aboutAria', { label: def.label })}
        />
      )}
      <span style={{ flex: 1 }} />
      <Tooltip title={capabilityGated ? gateHint : t('workbench.settings.keymapPane.recordTip', { label: def.label })}>
        <Button
          size="small"
          type="text"
          onClick={toggle}
          disabled={capabilityGated}
          aria-label={t('workbench.settings.keymapPane.recordAria', { label: def.label })}
          style={{ height: 24, padding: '0 4px' }}
        >
          {badge}
        </Button>
      </Tooltip>
      {chord.length > 0 && (
        <Tooltip title={t('workbench.settings.keymapPane.unbind')}>
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined style={{ fontSize: 11 }} />}
            onClick={() => setValue('')}
            disabled={capabilityGated}
            aria-label={t('workbench.settings.keymapPane.unbindAria', { label: def.label })}
            style={{ width: 20, height: 20, minWidth: 20 }}
          />
        </Tooltip>
      )}
      {modified && (
        <Tooltip title={t('workbench.settings.row.resetToDefault')}>
          <Button
            size="small"
            type="text"
            icon={<UndoOutlined style={{ fontSize: 11 }} />}
            onClick={reset}
            disabled={capabilityGated}
            aria-label={t('workbench.settings.keymapPane.resetAria', { label: def.label })}
            style={{ width: 20, height: 20, minWidth: 20 }}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default KeymapRow;
