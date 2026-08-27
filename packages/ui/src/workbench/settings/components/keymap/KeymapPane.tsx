/**
 * KeymapPane — custom right-pane renderer for the Keyboard settings
 * category. Replaces the flat record-button rows with an interactive
 * keymap: subcategory groups with collapsible headers, one KeymapRow
 * per action (inline record, unbind, reset, modified dot, conflict and
 * reserved-chord warnings), a plain-text filter over action labels/
 * descriptions, and a sticky bottom strip summarizing duplicate
 * assignments — clicking it filters the list down to the conflicted
 * rows and back.
 *
 * Reverse lookup ("why did nothing happen when I pressed X"): the
 * keyboard toggle beside the search field arms chord capture; the
 * pressed chord filters the list to the actions bound to it across
 * BOTH scopes — the scope split governs conflicts, not the factual
 * "what is bound to X" — with group headers telling the scopes apart.
 * The chord shows as a dismissible chip; Escape or the chip's close
 * clears it. Text query and chord lookup are mutually exclusive:
 * arming one clears the other.
 *
 * Presets: the first section's `Preset: [select]` row switches the
 * base keymap (`keyboard.preset`) — overrides survive the switch,
 * non-overridden keys move to the new base (see
 * keymap-preset-actions.ts). A restore button trails the select while
 * overrides exist. Only keybinding defs become rows; the preset def
 * itself is pane chrome laid out like a field row, anchored by its
 * setting key so settings-search deep links still land on it.
 */

import { SearchOutlined, UndoOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Input, Select, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { KeyboardIcon } from '@openheaders/ui/shared/icons';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import { getCurrentHost } from '../../../../shared/host-vocabulary';
import { formatChord } from '../../../hooks/useWorkspaceShortcuts';
import { useChordCapture } from '../../fields/use-chord-capture';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useModifiedSettings, useSettingValue, useSettingsReady } from '../../hooks';
import { resolveDescription, resolveLabel } from '../../localize';
import { requireDef } from '../../registry';
import { Pane, PaneHeader, PaneSection } from '../pane-chrome';
import type { CategoryPaneProps } from '../../types';
import { buildKeymapConflicts } from './keymap-conflicts';
import { buildKeymapGroups } from './keymap-groups';
import { applyPresetSwitch, presetDomainDefs, restorePreset } from './keymap-preset-actions';
import { reservedKindFor } from './keymap-reserved';
import KeymapRow from './KeymapRow';
import { useKeymapChordValues } from './use-keymap-chords';

const PRESET_OPTIONS = [
  { value: 'openheaders', labelKey: 'workbench.settings.def.keyboard.preset.option.openheaders.label' },
  { value: 'vscode', labelKey: 'workbench.settings.def.keyboard.preset.option.vscode.label' },
] as const;

const KeymapPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const t = useT();
  useSettingsReady();
  // Product telemetry: opening the keymap pane is the feature's first
  // meaningful use (S17); the per-document guard drops repeats.
  useEffect(() => noteFeatureUsed('keymap'), []);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [lookupChord, setLookupChord] = useState<string | null>(null);

  // Only keybinding defs become keymap rows — `keyboard.preset` (and any
  // future non-binding key on the category) is pane chrome, not a row.
  const bindingDefs = useMemo(() => defs.filter((def) => def.type === 'keybinding'), [defs]);
  const activePreset = useSettingValue('keyboard.preset');
  const domainKeys = useMemo(() => presetDomainDefs(bindingDefs).map((def) => def.key), [bindingDefs]);
  const overrides = useModifiedSettings(domainKeys);

  const chordValues = useKeymapChordValues(bindingDefs);
  const conflicts = useMemo(
    () => buildKeymapConflicts(bindingDefs, (key) => chordValues.get(key) ?? ''),
    [bindingDefs, chordValues],
  );
  // The show-only-conflicts mode has no strip to leave through once the
  // last conflict resolves — drop it so a future conflict doesn't
  // surprise-filter the list.
  useEffect(() => {
    if (conflicts.size === 0) setConflictsOnly(false);
  }, [conflicts]);

  const lookup = useChordCapture((chord) => setLookupChord(chord));
  // Escape dismisses the active lookup before it dismisses anything
  // above (settings shell listens bubble-phase; capture during record
  // mode is the hook's own handler).
  useEffect(() => {
    if (lookupChord === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setLookupChord(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [lookupChord]);

  const lookupMatches = useMemo(() => {
    if (lookupChord === null) return null;
    const matched = new Set<string>();
    for (const def of bindingDefs) {
      if (chordValues.get(def.key) === lookupChord) matched.add(def.key);
    }
    return matched;
  }, [bindingDefs, chordValues, lookupChord]);
  const lookupReserved = lookupChord === null ? null : reservedKindFor(lookupChord, getCurrentHost());

  const restrictTo = useMemo(() => {
    if (lookupMatches) return lookupMatches;
    return conflictsOnly && conflicts.size > 0 ? new Set(conflicts.keys()) : null;
  }, [lookupMatches, conflictsOnly, conflicts]);
  const groups = useMemo(
    () => buildKeymapGroups(category, bindingDefs, query, t, restrictTo),
    [category, bindingDefs, query, t, restrictTo],
  );
  // Any restriction counts as searching: hits must not hide inside
  // collapsed sections.
  const isSearching = query.trim().length > 0 || restrictTo !== null;

  const armLookup = (): void => {
    if (lookup.recording) {
      lookup.stop();
      return;
    }
    setQuery('');
    setLookupChord(null);
    lookup.start();
  };

  const toggleGroup = (id: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const presetDef = requireDef('keyboard.preset');
  const presetLabel = resolveLabel(presetDef, t);

  return (
    <Pane>
      <PaneHeader category={category} />

      <PaneSection title={t('workbench.settings.keymapPane.presetSection')}>
        <div
          data-setting-key="keyboard.preset"
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 4, padding: '3px 0' }}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, flex: 'none', minWidth: 180 }}
          >
            {`${presetLabel}:`}
            <InfoTrigger
              content={{ title: presetLabel, summary: resolveDescription(presetDef, t) }}
              ariaLabel={t('workbench.settings.row.aboutAria', { label: presetLabel })}
            />
          </span>
          <Select
            size="small"
            value={activePreset}
            onChange={(next) => applyPresetSwitch(bindingDefs, next)}
            aria-label={t('workbench.settings.keymapPane.presetAria')}
            options={PRESET_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            style={{ width: 180 }}
          />
          {overrides.size > 0 && (
            <Tooltip title={t('workbench.settings.keymapPane.presetRestoreTip')}>
              <Button
                size="small"
                type="text"
                icon={<UndoOutlined style={{ fontSize: 11 }} />}
                onClick={() => restorePreset(bindingDefs)}
              >
                {t('workbench.settings.keymapPane.presetRestore', { count: overrides.size })}
              </Button>
            </Tooltip>
          )}
        </div>
      </PaneSection>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.settings.keymapPane.searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLookupChord(null);
          }}
          style={{ maxWidth: 320 }}
        />
        <Tooltip title={t('workbench.settings.keymapPane.lookupTip')}>
          <Button
            size="small"
            type={lookup.recording || lookupChord !== null ? 'primary' : 'default'}
            icon={<KeyboardIcon />}
            onClick={armLookup}
            aria-label={t('workbench.settings.keymapPane.lookupAria')}
            aria-pressed={lookup.recording || lookupChord !== null}
          />
        </Tooltip>
        {lookup.recording && (
          <Tag color="processing" style={{ margin: 0 }}>
            {t('workbench.settings.keymapPane.recording')}
          </Tag>
        )}
        {lookupChord !== null && (
          <Tag closable onClose={() => setLookupChord(null)} style={{ margin: 0 }}>
            {formatChord(lookupChord)}
          </Tag>
        )}
      </div>

      {lookupReserved && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: token.colorWarningText }}>
          <WarningOutlined style={{ fontSize: 12, marginRight: 6 }} />
          {lookupReserved === 'browser'
            ? t('workbench.settings.keymapPane.reservedBrowser')
            : t('workbench.settings.keymapPane.reservedSystem')}
        </p>
      )}

      {groups.length === 0 && (
        <p style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {lookupChord !== null
            ? t('workbench.settings.keymapPane.lookupEmpty', { chord: formatChord(lookupChord) })
            : t('workbench.settings.keymapPane.noMatches')}
        </p>
      )}

      {groups.map((group, i) => {
        const id = group.sub?.id ?? `_orphans_${i}`;
        // Search expands everything — a filter that hides its own hits
        // inside collapsed sections reads as broken.
        const isCollapsed = !isSearching && collapsed.has(id);
        return (
          <PaneSection
            key={id}
            title={group.sub ? resolveLabel(group.sub, t) : undefined}
            collapsed={isCollapsed}
            onToggle={group.sub ? () => toggleGroup(id) : undefined}
          >
            {group.defs.map((def) => (
              <KeymapRow key={def.key} def={def} scopeDefs={bindingDefs} conflicts={conflicts.get(def.key)} />
            ))}
          </PaneSection>
        );
      })}

      {conflicts.size > 0 && (
        <button
          type="button"
          onClick={() => setConflictsOnly((v) => !v)}
          style={{
            position: 'sticky',
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            border: `1px solid ${token.colorWarningBorder}`,
            borderRadius: token.borderRadiusSM,
            background: token.colorWarningBg,
            cursor: 'pointer',
            fontSize: 12,
            color: token.colorText,
            textAlign: 'left',
          }}
        >
          <WarningOutlined style={{ fontSize: 12, color: token.colorWarning }} />
          <span style={{ flex: 1 }}>
            {t('workbench.settings.keymapPane.conflictSummary', { count: conflicts.size })}
          </span>
          <span style={{ color: token.colorPrimary }}>
            {conflictsOnly
              ? t('workbench.settings.keymapPane.conflictShowAll')
              : t('workbench.settings.keymapPane.conflictShowOnly')}
          </span>
        </button>
      )}
    </Pane>
  );
};

export default KeymapPane;
