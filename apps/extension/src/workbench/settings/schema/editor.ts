/**
 * Editor category — font, indentation, and view settings for the
 * code/condition editor surfaces (rule script fields, template JSON,
 * response body builder).
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const wordWrapSchema = v.picklist(['off', 'on', 'bounded']);
const renderWhitespaceSchema = v.picklist(['none', 'boundary', 'all']);

/**
 * Curated monospace font-family presets. Every entry either ships its
 * font from our dist (via `@fontsource` imports in `popup.less` /
 * `rules.less`) or relies on an OS-guaranteed monospace stack. The
 * stacks always end with `monospace` so an OS-level fallback kicks in
 * if the bundled woff2 fails to load for any reason.
 */
export const EDITOR_FONT_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  /** Ready-to-use CSS font-family stack. */
  stack: string;
}> = [
  {
    id: 'system',
    label: 'System Mono',
    description: 'Operating-system default monospace — SF Mono on macOS, Consolas on Windows, Liberation Mono on Linux.',
    stack: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    description: 'Monospace with programming ligatures. Bundled — always available.',
    stack: "'Fira Code', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    description: 'Monospace tuned for editors, with ligatures. Bundled — always available.',
    stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    description: 'Monospace with programming ligatures. Bundled — always available.',
    stack: "'Cascadia Code', 'Cascadia Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    description: 'Adobe monospace tuned for code. Bundled — always available.',
    stack: "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'press-start-2p',
    label: 'Press Start 2P',
    description: 'The pixel-style display font we ship with the app. Bundled — always available. A novelty pick: legible but tall and wide.',
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

declare module '../types' {
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
  label: 'Font Size',
  description: 'Font size in pixels for editor surfaces.',
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
  label: 'Font Family',
  description:
    'Curated monospace stacks for the editor. Every option is bundled with the extension — no system install required. Default is JetBrains Mono on Windows / Linux for cross-platform consistency, and System Mono on macOS to keep SF Mono\'s native rendering.',
  category: 'editor',
  tags: ['font', 'typography', 'monospace', 'fira', 'jetbrains', 'cascadia', 'menlo', 'consolas', 'source code pro'],
  scope: 'user',
  enumOptions: EDITOR_FONT_PRESETS.map((p) => ({ value: p.id, label: p.label, description: p.description })),
});

registerSetting({
  key: 'editor.fontLigatures',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Font Ligatures',
  description:
    'Enable programming ligatures — combine character sequences like `=>` or `!=` into single glyphs. Requires a font with ligature support (e.g. Fira Code, JetBrains Mono).',
  category: 'editor',
  tags: ['font', 'ligatures', 'typography', 'fira', 'jetbrains'],
  scope: 'user',
});

registerSetting({
  key: 'editor.lineHeight',
  type: 'number',
  default: 0,
  schema: v.pipe(v.number(), v.minValue(0), v.maxValue(40)),
  label: 'Line Height',
  description:
    'Editor line height in pixels. 0 lets the editor pick a line height proportional to the font size; values 8 and above are interpreted as explicit pixels.',
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
  label: 'Tab Size',
  description: 'Number of columns a tab character occupies.',
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
  label: 'Insert Spaces',
  description: 'Insert spaces instead of tab characters when pressing Tab.',
  category: 'editor',
  tags: ['indent', 'tab', 'spaces'],
  scope: 'user',
});

registerSetting({
  key: 'editor.wordWrap',
  type: 'enum',
  default: 'off',
  schema: wordWrapSchema,
  label: 'Word Wrap',
  description: 'Whether long lines wrap to the next line in the editor.',
  category: 'editor',
  tags: ['wrap', 'long lines'],
  scope: 'user',
  enumOptions: [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'Viewport width' },
    { value: 'bounded', label: 'Bounded column' },
  ],
});

registerSetting({
  key: 'editor.wordWrapColumn',
  type: 'number',
  default: 120,
  schema: v.pipe(v.number(), v.integer(), v.minValue(40), v.maxValue(240)),
  label: 'Word Wrap Column',
  description: 'Column at which lines wrap when Word Wrap is set to Bounded.',
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
  label: 'Line Numbers',
  description: 'Show line numbers in the left gutter.',
  category: 'editor',
  tags: ['gutter', 'numbers'],
  scope: 'user',
});

registerSetting({
  key: 'editor.renderWhitespace',
  type: 'enum',
  default: 'none',
  schema: renderWhitespaceSchema,
  label: 'Render Whitespace',
  description: 'Visually render whitespace characters.',
  category: 'editor',
  tags: ['whitespace', 'invisible', 'tabs', 'spaces'],
  scope: 'user',
  enumOptions: [
    { value: 'none', label: 'None' },
    { value: 'boundary', label: 'Boundary only' },
    { value: 'all', label: 'All' },
  ],
});

registerSetting({
  key: 'editor.formatOnSave',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Format on Save',
  description: 'Automatically format editor contents when you save a rule or template.',
  category: 'editor',
  tags: ['format', 'prettier', 'save'],
  scope: 'user',
});

registerSetting({
  key: 'editor.bracketPairColorization',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Bracket Pair Colorization',
  description: 'Highlight matching brackets in different colors.',
  category: 'editor',
  tags: ['brackets', 'colors', 'highlight'],
  scope: 'user',
});
