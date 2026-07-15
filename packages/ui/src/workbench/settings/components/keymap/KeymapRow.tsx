/**
 * KeymapRow — one action row of the Keymap pane.
 *
 * `Label ......... [chord badge] [warnings] [unbind] [reset]` with the
 * modified dot and description popover of a regular setting row.
 * Clicking the chord badge arms inline recording (Escape or a re-click
 * cancels). A captured chord that is already bound to another action in
 * this row's conflict scope does NOT commit straight away — the row
 * expands an inline resolution strip (Reassign / Keep both / Cancel);
 * the capture hook stays pure and only reports the chord. Conflict and
 * reserved-chord warnings render as badges trailing the chord badge.
 *
 * Carries `data-setting-key` like FieldRow, so settings-search deep
 * links scroll-and-flash to it unchanged.
 */

import { CloseOutlined, UndoOutlined, WarningOutlined } from '@ant-design/icons';
import { hasCapability } from '@openheaders/core/capabilities';
import { Button, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../../../shared/host-vocabulary';
import { ShortcutKbd } from '../../../../components/ShortcutKbd';
import { formatChord, useChordLabel } from '../../../hooks/useWorkspaceShortcuts';
import { useChordCapture } from '../../fields/use-chord-capture';
import { useIsModified, useResetSetting, useUntypedSetting } from '../../hooks';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { resolveLabel, resolveSettingDef } from '../../localize';
import { get as storeGet, set as storeSet } from '../../store';
import type { SettingDef, SettingKey, SettingsMap } from '../../types';
import { findChordOwners } from './keymap-conflicts';
import { reservedKindFor } from './keymap-reserved';

interface PendingChord {
  chord: string;
  owners: readonly SettingDef[];
}

interface KeymapRowProps {
  def: SettingDef;
  /** Every def of the keyboard category — the record-time conflict pool. */
  scopeDefs: readonly SettingDef[];
  /** Other defs currently sharing this row's chord in-scope (live index). */
  conflicts?: readonly SettingDef[];
}

const KeymapRow: React.FC<KeymapRowProps> = ({ def: rawDef, scopeDefs, conflicts }) => {
  const { token } = theme.useToken();
  const t = useT();
  const def = useMemo(() => resolveSettingDef(rawDef, t), [rawDef, t]);
  const [value, setValue] = useUntypedSetting(def.key);
  const chordLabel = useChordLabel(def.key as SettingKey);
  const modified = useIsModified(def.key as SettingKey);
  const reset = useResetSetting(def.key as SettingKey);
  const [pending, setPending] = useState<PendingChord | null>(null);

  const onChord = useCallback(
    (chord: string) => {
      const owners = findChordOwners(scopeDefs, rawDef, chord, storeGet);
      if (owners.length > 0) setPending({ chord, owners });
      else setValue(chord);
    },
    [scopeDefs, rawDef, setValue],
  );
  const { recording, toggle } = useChordCapture(onChord);

  if (def.when && !def.when(<K extends SettingKey>(k: K): SettingsMap[K] => storeGet(k))) {
    return null;
  }

  const chord = typeof value === 'string' ? value : '';
  const capabilityGated = def.requiresCapability !== undefined && !hasCapability(def.requiresCapability);
  const gateHint = def.capabilityUnavailableHint ?? t('workbench.settings.row.capabilityUnavailable');
  const reserved = reservedKindFor(chord, getCurrentHost());
  const conflictLabels = (defs: readonly SettingDef[]): string => defs.map((d) => resolveLabel(d, t)).join(', ');

  const commitPending = (unbindOwners: boolean): void => {
    if (!pending) return;
    if (unbindOwners) {
      for (const owner of pending.owners) storeSet(owner.key, '');
    }
    setValue(pending.chord);
    setPending(null);
  };

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
    <div className="settings-field-row" data-setting-key={def.key} style={{ padding: '3px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', columnGap: 6, minHeight: 30 }}>
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
        <Tooltip
          title={capabilityGated ? gateHint : t('workbench.settings.keymapPane.recordTip', { label: def.label })}
        >
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
        {conflicts && conflicts.length > 0 && (
          <Tooltip title={t('workbench.settings.keymapPane.conflictTooltip', { labels: conflictLabels(conflicts) })}>
            <WarningOutlined
              role="img"
              aria-label={t('workbench.settings.keymapPane.conflictBadgeAria')}
              style={{ fontSize: 12, color: token.colorWarning }}
            />
          </Tooltip>
        )}
        {reserved && (
          <Tooltip
            title={
              reserved === 'browser'
                ? t('workbench.settings.keymapPane.reservedBrowser')
                : t('workbench.settings.keymapPane.reservedSystem')
            }
          >
            <WarningOutlined
              role="img"
              aria-label={t('workbench.settings.keymapPane.reservedBadgeAria')}
              style={{ fontSize: 12, color: token.colorTextTertiary }}
            />
          </Tooltip>
        )}
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
      {pending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            padding: '2px 0 5px',
            fontSize: 12,
            color: token.colorTextSecondary,
          }}
        >
          <WarningOutlined style={{ fontSize: 12, color: token.colorWarning }} />
          <span>
            {t('workbench.settings.keymapPane.conflictPrompt', {
              chord: formatChord(pending.chord),
              labels: conflictLabels(pending.owners),
            })}
          </span>
          <Button size="small" onClick={() => commitPending(true)}>
            {t('workbench.settings.keymapPane.conflictReassign')}
          </Button>
          <Button size="small" onClick={() => commitPending(false)}>
            {t('workbench.settings.keymapPane.conflictKeepBoth')}
          </Button>
          <Button size="small" type="text" onClick={() => setPending(null)}>
            {t('shared.action.cancel')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default KeymapRow;
