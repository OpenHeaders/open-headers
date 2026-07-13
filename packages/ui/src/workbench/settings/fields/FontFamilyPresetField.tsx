/**
 * FontFamilyPresetField — radio picker for any font-family preset
 * setting (`editor.fontFamilyPreset`, `appearance.fontFamilyPreset`).
 *
 * Each option renders as: bold label rendered in its own font on the
 * first line, secondary description text on the second line. The label
 * doubles as a live preview — users see how the font actually looks
 * before selecting it.
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

import { Radio, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
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
  const { token } = theme.useToken();
  const t = useT();
  const [value, setValue] = useUntypedSetting(def.key);
  const presets = PRESET_TABLES.get(def.key) ?? [];

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      block
    >
      <Radio.Group
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {presets.map((preset) => {
          const description = resolveOptionalDescription(preset, t);
          return (
            <Radio key={preset.id} value={preset.id} style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.4 }}>
                <span style={{ fontFamily: preset.stack, fontWeight: 500 }}>{preset.label}</span>
                {description ? (
                  <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>{description}</span>
                ) : null}
              </div>
            </Radio>
          );
        })}
      </Radio.Group>
    </FieldRow>
  );
};

export default FontFamilyPresetField;
