/**
 * FontFamilyPresetField — radio picker for any font-family preset
 * setting (`editor.fontFamilyPreset`, `appearance.fontFamilyPreset`).
 *
 * The options lay out as a compact grid; each label renders in its own
 * font so it doubles as a live preview. The per-preset descriptions
 * live in the row's `(i)` popover as a glossary section instead of
 * inline, so the row stays a few lines tall.
 *
 * The field is preset-table-agnostic — it picks the right table by
 * setting key. Editor presets are monospace; appearance presets are
 * proportional sans. They share the same shape, so one component covers
 * both.
 *
 * Every preset in both tables ships its font from our dist (either
 * bundled woff2 via `@fontsource` or guaranteed OS fallback stacks),
 * so we no longer probe `document.fonts.check()` for availability —
 * there is nothing to discover.
 */

import { Radio } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverSection } from '@openheaders/ui/shared/info-popover';
import { useUntypedSetting } from '../hooks';
import { resolveOptionalDescription } from '../localize';
import { APPEARANCE_FONT_PRESETS } from '../schema/appearance';
import { EDITOR_FONT_PRESETS } from '../schema/editor';
import type { FontPreset, ResolvedSettingDef, SettingKey } from '../types';
import FieldRow from './FieldRow';

/** The setting keys this field handles, plus their preset tables. New
 *  font-family preset settings register their table here. */
const PRESET_TABLES: ReadonlyMap<SettingKey, ReadonlyArray<FontPreset>> = new Map<
  SettingKey,
  ReadonlyArray<FontPreset>
>([
  ['editor.fontFamilyPreset', EDITOR_FONT_PRESETS],
  ['appearance.fontFamilyPreset', APPEARANCE_FONT_PRESETS],
]);

/** True when the given setting key has a registered preset table —
 *  drives the dispatch in `SettingRow`. */
export function isFontFamilyPresetKey(key: SettingKey): boolean {
  return PRESET_TABLES.has(key);
}

interface FontFamilyPresetFieldProps {
  def: ResolvedSettingDef;
}

const FontFamilyPresetField: React.FC<FontFamilyPresetFieldProps> = ({ def }) => {
  const t = useT();
  const [value, setValue] = useUntypedSetting(def.key);
  const presets = PRESET_TABLES.get(def.key) ?? [];

  const infoSections = useMemo<ReadonlyArray<InfoPopoverSection>>(() => {
    const items = presets.flatMap((preset) => {
      const desc = resolveOptionalDescription(preset, t);
      return desc ? [{ label: preset.label, desc, labelStyle: { fontFamily: preset.stack } }] : [];
    });
    return items.length > 0 ? [{ heading: t('workbench.settings.row.presetsHeading'), layout: 'stacked', items }] : [];
  }, [presets, t]);

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      infoSections={infoSections}
      block
    >
      <Radio.Group
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(220px, max-content))',
          gridTemplateRows: `repeat(${Math.ceil(presets.length / 2)}, auto)`,
          gridAutoFlow: 'column',
          gap: '4px 48px',
          width: 'fit-content',
        }}
      >
        {presets.map((preset) => (
          <Radio key={preset.id} value={preset.id}>
            <span style={{ fontFamily: preset.stack }}>{preset.label}</span>
          </Radio>
        ))}
      </Radio.Group>
    </FieldRow>
  );
};

export default FontFamilyPresetField;
