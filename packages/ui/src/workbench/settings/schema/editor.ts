/**
 * Editor category — font, indentation, and view settings for the
 * code/condition editor surfaces (rule script fields, template JSON,
 * response body builder).
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';
import type { FontPreset } from '../types';

const wordWrapSchema = v.picklist(['off', 'on', 'bounded']);
const renderWhitespaceSchema = v.picklist(['none', 'boundary', 'all']);

/**
 * Curated monospace font-family presets. Every entry either ships its
 * font from our dist (via `@fontsource` imports in `popup.less` /
 * `rules.less`) or relies on an OS-guaranteed monospace stack. The
 * stacks always end with `monospace` so an OS-level fallback kicks in
 * if the bundled woff2 fails to load for any reason.
 */
export const EDITOR_FONT_PRESETS: ReadonlyArray<FontPreset> = [
  {
    id: 'system',
    label: 'System Mono',
    descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.option.system.description',
    stack: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description',
    stack: "'Fira Code', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description',
    stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description',
    stack: "'Cascadia Code', 'Cascadia Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description',
    stack: "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'press-start-2p',
    label: 'Press Start 2P',
    descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description',
    stack: "'Press Start 2P', ui-monospace, SFMono-Regular, monospace",
  },
] as const;

const fontFamilyPresetSchema = v.picklist(EDITOR_FONT_PRESETS.map((p) => p.id) as [string, ...string[]]);

/** Resolve the active font-family stack for a preset id. Falls back
 *  to the System Mono stack if the id is unknown — the storage layer
 *  validates against the schema, so this only triggers if a preset is
 *  removed mid-session. */
export function resolveFontFamily(preset: string): string {
  const def = EDITOR_FONT_PRESETS.find((p) => p.id === preset);
  return def?.stack ?? EDITOR_FONT_PRESETS[0].stack;
}

/** Default `editor.fontFamilyPreset` resolved per OS at first run.
 *  Mirrors the appearance-font strategy: macOS keeps SF Mono's native
 *  rendering; Windows / Linux get JetBrains Mono for cross-platform
 *  consistency (same code looks the same across machines). The user's
 *  explicit pick always wins once they change it. */
function defaultEditorFontPreset(): string {
  if (typeof navigator === 'undefined') return 'jetbrains-mono';
  // biome-ignore lint/suspicious/noExplicitAny: navigator.userAgentData isn't yet in the lib.dom type
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(platform) ? 'system' : 'jetbrains-mono';
}

export type WordWrap = v.InferOutput<typeof wordWrapSchema>;
export type RenderWhitespace = v.InferOutput<typeof renderWhitespaceSchema>;
export type FontFamilyPreset = v.InferOutput<typeof fontFamilyPresetSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'editor.fontSize': number;
    'editor.fontFamilyPreset': FontFamilyPreset;
    'editor.fontLigatures': boolean;
    'editor.lineHeight': number;
    'editor.tabSize': number;
    'editor.insertSpaces': boolean;
    'editor.wordWrap': WordWrap;
    'editor.wordWrapColumn': number;
    'editor.lineNumbers': boolean;
    'editor.renderWhitespace': RenderWhitespace;
    'editor.formatOnSave': boolean;
    'editor.bracketPairColorization': boolean;
  }
}

registerSetting({
  key: 'editor.fontSize',
  type: 'number',
  default: 13,
  schema: v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(32)),
  labelKey: 'workbench.settings.def.editor.fontSize.label',
  descriptionKey: 'workbench.settings.def.editor.fontSize.description',
  category: 'editor',
  tags: ['font', 'size', 'zoom'],
  scope: 'user',
  numberRange: { min: 8, max: 32, step: 1 },
});

registerSetting({
  key: 'editor.fontFamilyPreset',
  type: 'enum',
  default: defaultEditorFontPreset(),
  schema: fontFamilyPresetSchema,
  labelKey: 'workbench.settings.def.editor.fontFamilyPreset.label',
  descriptionKey: 'workbench.settings.def.editor.fontFamilyPreset.description',
  category: 'editor',
  tags: ['font', 'typography', 'monospace', 'fira', 'jetbrains', 'cascadia', 'menlo', 'consolas', 'source code pro'],
  scope: 'user',
  enumOptions: EDITOR_FONT_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
    descriptionKey: p.descriptionKey,
  })),
});

registerSetting({
  key: 'editor.fontLigatures',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.editor.fontLigatures.label',
  descriptionKey: 'workbench.settings.def.editor.fontLigatures.description',
  category: 'editor',
  tags: ['font', 'ligatures', 'typography', 'fira', 'jetbrains'],
  scope: 'user',
});

registerSetting({
  key: 'editor.lineHeight',
  type: 'number',
  default: 0,
  schema: v.pipe(v.number(), v.minValue(0), v.maxValue(40)),
  labelKey: 'workbench.settings.def.editor.lineHeight.label',
  descriptionKey: 'workbench.settings.def.editor.lineHeight.description',
  category: 'editor',
  tags: ['line height', 'leading', 'spacing'],
  scope: 'user',
  numberRange: { min: 0, max: 40, step: 1 },
});

registerSetting({
  key: 'editor.tabSize',
  type: 'number',
  default: 2,
  schema: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)),
  labelKey: 'workbench.settings.def.editor.tabSize.label',
  descriptionKey: 'workbench.settings.def.editor.tabSize.description',
  category: 'editor',
  tags: ['indent', 'tab', 'spacing'],
  scope: 'user',
  numberRange: { min: 1, max: 8, step: 1 },
});

registerSetting({
  key: 'editor.insertSpaces',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.editor.insertSpaces.label',
  descriptionKey: 'workbench.settings.def.editor.insertSpaces.description',
  category: 'editor',
  tags: ['indent', 'tab', 'spaces'],
  scope: 'user',
});

registerSetting({
  key: 'editor.wordWrap',
  type: 'enum',
  default: 'off',
  schema: wordWrapSchema,
  labelKey: 'workbench.settings.def.editor.wordWrap.label',
  descriptionKey: 'workbench.settings.def.editor.wordWrap.description',
  category: 'editor',
  tags: ['wrap', 'long lines'],
  scope: 'user',
  enumOptions: [
    { value: 'off', labelKey: 'workbench.settings.def.editor.wordWrap.option.off.label' },
    { value: 'on', labelKey: 'workbench.settings.def.editor.wordWrap.option.on.label' },
    { value: 'bounded', labelKey: 'workbench.settings.def.editor.wordWrap.option.bounded.label' },
  ],
});

registerSetting({
  key: 'editor.wordWrapColumn',
  type: 'number',
  default: 120,
  schema: v.pipe(v.number(), v.integer(), v.minValue(40), v.maxValue(240)),
  labelKey: 'workbench.settings.def.editor.wordWrapColumn.label',
  descriptionKey: 'workbench.settings.def.editor.wordWrapColumn.description',
  category: 'editor',
  tags: ['wrap', 'column', 'width'],
  scope: 'user',
  numberRange: { min: 40, max: 240, step: 5 },
  when: (get) => get('editor.wordWrap') === 'bounded',
});

registerSetting({
  key: 'editor.lineNumbers',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.editor.lineNumbers.label',
  descriptionKey: 'workbench.settings.def.editor.lineNumbers.description',
  category: 'editor',
  tags: ['gutter', 'numbers'],
  scope: 'user',
});

registerSetting({
  key: 'editor.renderWhitespace',
  type: 'enum',
  default: 'none',
  schema: renderWhitespaceSchema,
  labelKey: 'workbench.settings.def.editor.renderWhitespace.label',
  descriptionKey: 'workbench.settings.def.editor.renderWhitespace.description',
  category: 'editor',
  tags: ['whitespace', 'invisible', 'tabs', 'spaces'],
  scope: 'user',
  enumOptions: [
    { value: 'none', labelKey: 'workbench.settings.def.editor.renderWhitespace.option.none.label' },
    { value: 'boundary', labelKey: 'workbench.settings.def.editor.renderWhitespace.option.boundary.label' },
    { value: 'all', labelKey: 'workbench.settings.def.editor.renderWhitespace.option.all.label' },
  ],
});

registerSetting({
  key: 'editor.formatOnSave',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.editor.formatOnSave.label',
  descriptionKey: 'workbench.settings.def.editor.formatOnSave.description',
  category: 'editor',
  tags: ['format', 'prettier', 'save'],
  scope: 'user',
});

registerSetting({
  key: 'editor.bracketPairColorization',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.editor.bracketPairColorization.label',
  descriptionKey: 'workbench.settings.def.editor.bracketPairColorization.description',
  category: 'editor',
  tags: ['brackets', 'colors', 'highlight'],
  scope: 'user',
});
