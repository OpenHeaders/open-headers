/**
 * FontFamilyPresetField — enum picker for any font-family preset
 * setting (`editor.fontFamilyPreset`, `appearance.fontFamilyPreset`)
 * with live "installed" / "falls back" tags per option.
 *
 * Browser extensions can't enumerate the user's installed fonts
 * without a permission grant most users will never see, so we use
 * `document.fonts.check('12px "Family Name"')` to probe each named
 * preset on mount. Probes are synchronous for system-installed fonts
 * (no `@font-face` waiting), and we re-probe whenever the document
 * font-set changes — covers the case where a font is installed
 * mid-session via the OS.
 *
 * The OS stacks and the Custom escape hatch carry `probe: null` and
 * render no tag.
 *
 * The field is preset-table-agnostic: it picks the right table by
 * setting key. Editor presets are monospace; appearance presets are
 * proportional sans. They share the same shape and probe strategy,
 * so one component covers both.
 */

import { Radio, Tag, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useUntypedSetting } from '../hooks';
import { APPEARANCE_FONT_PRESETS } from '../schema/appearance';
import { EDITOR_FONT_PRESETS } from '../schema/editor';
import type { SettingDef, SettingKey } from '../types';
import FieldRow from './FieldRow';

interface FontPreset {
  id: string;
  label: string;
  description: string;
  stack: string | undefined;
  probe: string | null;
}

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
  def: SettingDef;
}

function probeFonts(presets: ReadonlyArray<FontPreset>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (typeof document === 'undefined' || !document.fonts) return out;
  for (const preset of presets) {
    if (!preset.probe) continue;
    try {
      out[preset.id] = document.fonts.check(`12px "${preset.probe}"`);
    } catch {
      // Some browsers throw on unusual family names — treat as missing.
      out[preset.id] = false;
    }
  }
  return out;
}

const FontFamilyPresetField: React.FC<FontFamilyPresetFieldProps> = ({ def }) => {
  const [value, setValue] = useUntypedSetting(def.key);
  const presets = PRESET_TABLES.get(def.key) ?? [];
  const [installed, setInstalled] = useState<Record<string, boolean>>(() => probeFonts(presets));

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    // Re-probe once the font-set settles in case the page is mid-load
    // when the settings panel mounts.
    document.fonts
      .ready.then(() => setInstalled(probeFonts(presets)))
      .catch(() => {});
    const handler = (): void => setInstalled(probeFonts(presets));
    document.fonts.addEventListener?.('loadingdone', handler);
    return () => document.fonts.removeEventListener?.('loadingdone', handler);
  }, [presets]);

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
    >
      <Radio.Group
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        {presets.map((preset) => {
          const status: 'na' | 'installed' | 'missing' = !preset.probe
            ? 'na'
            : installed[preset.id]
              ? 'installed'
              : 'missing';
          const tag =
            status === 'installed' ? (
              <Tag color="success" style={{ marginInlineStart: 8 }}>
                Installed
              </Tag>
            ) : status === 'missing' ? (
              <Tooltip title="Not installed on this system — selecting this falls back to the system stack.">
                <Tag color="default" style={{ marginInlineStart: 8 }}>
                  Falls back
                </Tag>
              </Tooltip>
            ) : null;
          const radio = (
            <Radio key={preset.id} value={preset.id}>
              <span style={{ fontFamily: preset.stack ?? undefined }}>{preset.label}</span>
              {tag}
            </Radio>
          );
          return preset.description ? (
            <Tooltip key={preset.id} title={preset.description} placement="right">
              {radio}
            </Tooltip>
          ) : (
            radio
          );
        })}
      </Radio.Group>
    </FieldRow>
  );
};

export default FontFamilyPresetField;
