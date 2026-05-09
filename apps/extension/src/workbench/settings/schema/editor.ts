/**
 * Editor category — font, indentation, and view settings for the
 * code/condition editor surfaces (rule script fields, template JSON,
 * response body builder).
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const wordWrapSchema = v.picklist(['off', 'on', 'bounded']);
const renderWhitespaceSchema = v.picklist(['none', 'boundary', 'all']);
// Monaco accepts numeric weights as strings; we keep the union narrow
// so the field renders as a dropdown rather than free text.
const fontWeightSchema = v.picklist(['normal', 'bold', '300', '400', '500', '600', '700']);

/**
 * Curated monospace font-family presets. Browser extensions can't
 * enumerate the user's installed fonts without a permission prompt
 * most users will never see, so a free-text picker invites users to
 * type non-monospace names and silently break alignment in the
 * editor. The presets always end with `monospace` so an OS-level
 * fallback kicks in if the named font isn't installed; the alignment
 * stays correct even on a fresh machine.
 *
 * Order is the dropdown order. `custom` is last and reveals the free
 * `editor.fontFamily` field via `when:`.
 */
export const EDITOR_FONT_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  /** Ready-to-use CSS font-family stack. `undefined` for `custom` —
   *  consumers fall back to `editor.fontFamily` instead. */
  stack: string | undefined;
}> = [
  {
    id: 'system',
    label: 'System Mono',
    description: 'Operating-system default monospace — SF Mono on macOS, Consolas on Windows, Liberation Mono on Linux.',
    stack: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  {
    id: 'menlo-consolas',
    label: 'Menlo / Consolas',
    description: 'Classic platform monospaces — Menlo on macOS, Consolas on Windows.',
    stack: "Menlo, Consolas, 'Liberation Mono', monospace",
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    description: 'Free monospace with programming ligatures. Falls back to System Mono if not installed.',
    stack: "'Fira Code', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    description: 'Free monospace tuned for editors, with ligatures. Falls back to System Mono if not installed.',
    stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    description: 'Free monospace with programming ligatures. Falls back to System Mono if not installed.',
    stack: "'Cascadia Code', 'Cascadia Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    description: 'Free Adobe monospace tuned for code. Falls back to System Mono if not installed.',
    stack: "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'custom',
    label: 'Custom…',
    description: 'Use a free-text font-family stack. Must be a monospace font or the editor will mis-align.',
    stack: undefined,
  },
] as const;

const fontFamilyPresetSchema = v.picklist(EDITOR_FONT_PRESETS.map((p) => p.id) as [string, ...string[]]);

/** Resolve the active font-family stack from the two-setting pair.
 *  `preset === 'custom'` returns the user's free-text value;
 *  every other preset returns its curated stack. */
export function resolveFontFamily(preset: string, customStack: string): string {
  const def = EDITOR_FONT_PRESETS.find((p) => p.id === preset);
  if (!def || def.stack === undefined) return customStack;
  return def.stack;
}

export type WordWrap = v.InferOutput<typeof wordWrapSchema>;
export type RenderWhitespace = v.InferOutput<typeof renderWhitespaceSchema>;
export type FontWeight = v.InferOutput<typeof fontWeightSchema>;
export type FontFamilyPreset = v.InferOutput<typeof fontFamilyPresetSchema>;

declare module '../types' {
  interface SettingsMap {
    'editor.fontSize': number;
    'editor.fontFamilyPreset': FontFamilyPreset;
    'editor.fontFamily': string;
    'editor.fontWeight': FontWeight;
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
  default: 'system',
  schema: fontFamilyPresetSchema,
  label: 'Font Family',
  description: 'Choose a curated monospace stack for the editor, or pick Custom to enter a free-text stack.',
  category: 'editor',
  tags: ['font', 'typography', 'monospace', 'fira', 'jetbrains', 'cascadia', 'menlo', 'consolas', 'source code pro'],
  scope: 'user',
  enumOptions: EDITOR_FONT_PRESETS.map((p) => ({ value: p.id, label: p.label, description: p.description })),
});

registerSetting({
  key: 'editor.fontFamily',
  type: 'string',
  default: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  schema: v.pipe(v.string(), v.minLength(1)),
  label: 'Custom Font Family',
  description: 'Comma-separated font stack. Must be a monospace font or the editor will mis-align.',
  category: 'editor',
  tags: ['font', 'typography', 'monospace', 'custom'],
  scope: 'user',
  when: (get) => get('editor.fontFamilyPreset') === 'custom',
});

registerSetting({
  key: 'editor.fontWeight',
  type: 'enum',
  default: 'normal',
  schema: fontWeightSchema,
  label: 'Font Weight',
  description: 'Stroke weight for editor text. Numeric values map to CSS font-weight steps.',
  category: 'editor',
  tags: ['font', 'weight', 'bold', 'thin'],
  scope: 'user',
  enumOptions: [
    { value: 'normal', label: 'Normal' },
    { value: 'bold', label: 'Bold' },
    { value: '300', label: 'Light (300)' },
    { value: '400', label: 'Regular (400)' },
    { value: '500', label: 'Medium (500)' },
    { value: '600', label: 'Semibold (600)' },
    { value: '700', label: 'Bold (700)' },
  ],
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
