/**
 * Editor category — font, indentation, and view settings for the
 * code/condition editor surfaces (rule script fields, template JSON,
 * response body builder).
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const wordWrapSchema = v.picklist(['off', 'on', 'bounded']);
const renderWhitespaceSchema = v.picklist(['none', 'boundary', 'all']);

export type WordWrap = v.InferOutput<typeof wordWrapSchema>;
export type RenderWhitespace = v.InferOutput<typeof renderWhitespaceSchema>;

declare module '../types' {
  interface SettingsMap {
    'editor.fontSize': number;
    'editor.fontFamily': string;
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
  key: 'editor.fontFamily',
  type: 'string',
  default: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  schema: v.pipe(v.string(), v.minLength(1)),
  label: 'Font Family',
  description: 'Comma-separated font stack used by the editor.',
  category: 'editor',
  tags: ['font', 'typography', 'monospace'],
  scope: 'user',
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
