/**
 * Terminal category — behavior of the workbench Terminal tool window.
 * Desktop-only in practice (the tool window rides the `terminal`
 * capability); the category itself is host-gated in categories.tsx.
 */

import { lazy } from 'react';
import * as v from 'valibot';
import { registerSetting } from '../registry';
import { EDITOR_FONT_PRESETS } from './editor';

const TerminalProfilesRow = lazy(() => import('../components/terminal-profiles-row'));

const terminalProfileSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  shell: v.pipe(v.string(), v.minLength(1)),
  args: v.array(v.string()),
  cwd: v.optional(v.string()),
});

/**
 * One terminal profile — a shell the Terminal tool window can open a
 * tab with. The host owns the environment; a profile only chooses the
 * command line and starting directory. Resolution happens at spawn
 * time, so edits apply on the next spawn and a deleted profile falls
 * back to the default.
 */
export type TerminalProfile = v.InferOutput<typeof terminalProfileSchema>;

const terminalProfilesValueSchema = v.object({
  profiles: v.array(terminalProfileSchema),
  /** Profile a plain new tab opens with; null = the system login shell. */
  defaultProfileId: v.nullable(v.string()),
});

/** The profiles list and the default choice live in ONE value so a
 *  delete that re-points the default is a single atomic write. */
export type TerminalProfilesValue = v.InferOutput<typeof terminalProfilesValueSchema>;

const cursorStyleSchema = v.picklist(['block', 'underline', 'bar']);
const terminalFontPresetSchema = v.picklist(EDITOR_FONT_PRESETS.map((p) => p.id) as [string, ...string[]]);

export type TerminalCursorStyle = v.InferOutput<typeof cursorStyleSchema>;
export type TerminalFontPreset = v.InferOutput<typeof terminalFontPresetSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'terminal.confirmCloseRunningProcess': boolean;
    'terminal.profiles': TerminalProfilesValue;
    'terminal.startDirectory': string;
    'terminal.defaultTabName': string;
    'terminal.fontFamilyPreset': TerminalFontPreset;
    'terminal.fontSize': number;
    'terminal.lineHeight': number;
    'terminal.cursorStyle': TerminalCursorStyle;
    'terminal.cursorBlink': boolean;
    'terminal.minimumContrastRatio': number;
    'terminal.scrollback': number;
    'terminal.macOptionIsMeta': boolean;
    'terminal.copyOnSelect': boolean;
    'terminal.hyperlinks': boolean;
    'terminal.audibleBell': boolean;
    'terminal.closeTabOnExit': boolean;
  }
}

registerSetting({
  key: 'terminal.profiles',
  type: 'info',
  default: { profiles: [], defaultProfileId: null },
  getDefault: () => ({ profiles: [], defaultProfileId: null }),
  schema: terminalProfilesValueSchema,
  labelKey: 'workbench.settings.def.terminal.profiles.label',
  descriptionKey: 'workbench.settings.def.terminal.profiles.description',
  category: 'terminal',
  tags: ['terminal', 'profile', 'shell', 'zsh', 'bash', 'fish', 'powershell', 'directory'],
  scope: 'user',
  customEditor: TerminalProfilesRow,
});

registerSetting({
  key: 'terminal.startDirectory',
  type: 'string',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.terminal.startDirectory.label',
  descriptionKey: 'workbench.settings.def.terminal.startDirectory.description',
  category: 'terminal',
  tags: ['terminal', 'directory', 'cwd', 'start', 'folder', 'path'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.defaultTabName',
  type: 'string',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.terminal.defaultTabName.label',
  descriptionKey: 'workbench.settings.def.terminal.defaultTabName.description',
  category: 'terminal',
  tags: ['terminal', 'tab', 'name', 'title', 'label'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.fontFamilyPreset',
  type: 'enum',
  default: 'jetbrains-mono',
  schema: terminalFontPresetSchema,
  labelKey: 'workbench.settings.def.terminal.fontFamilyPreset.label',
  descriptionKey: 'workbench.settings.def.terminal.fontFamilyPreset.description',
  category: 'terminal',
  tags: ['terminal', 'font', 'typography', 'monospace', 'fira', 'jetbrains', 'cascadia', 'source code pro'],
  scope: 'user',
  enumOptions: EDITOR_FONT_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
    descriptionKey: p.descriptionKey,
  })),
});

registerSetting({
  key: 'terminal.fontSize',
  type: 'number',
  default: 13,
  schema: v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(32)),
  labelKey: 'workbench.settings.def.terminal.fontSize.label',
  descriptionKey: 'workbench.settings.def.terminal.fontSize.description',
  category: 'terminal',
  tags: ['terminal', 'font', 'size', 'zoom'],
  scope: 'user',
  numberRange: { min: 8, max: 32, step: 1 },
});

registerSetting({
  key: 'terminal.lineHeight',
  type: 'number',
  default: 1,
  schema: v.pipe(v.number(), v.minValue(1), v.maxValue(2)),
  labelKey: 'workbench.settings.def.terminal.lineHeight.label',
  descriptionKey: 'workbench.settings.def.terminal.lineHeight.description',
  category: 'terminal',
  tags: ['terminal', 'line height', 'leading', 'spacing'],
  scope: 'user',
  numberRange: { min: 1, max: 2, step: 0.1 },
});

registerSetting({
  key: 'terminal.cursorStyle',
  type: 'enum',
  default: 'block',
  schema: cursorStyleSchema,
  labelKey: 'workbench.settings.def.terminal.cursorStyle.label',
  descriptionKey: 'workbench.settings.def.terminal.cursorStyle.description',
  category: 'terminal',
  tags: ['terminal', 'cursor', 'caret', 'shape'],
  scope: 'user',
  enumOptions: [
    { value: 'block', labelKey: 'workbench.settings.def.terminal.cursorStyle.option.block.label' },
    { value: 'underline', labelKey: 'workbench.settings.def.terminal.cursorStyle.option.underline.label' },
    { value: 'bar', labelKey: 'workbench.settings.def.terminal.cursorStyle.option.bar.label' },
  ],
});

registerSetting({
  key: 'terminal.cursorBlink',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.cursorBlink.label',
  descriptionKey: 'workbench.settings.def.terminal.cursorBlink.description',
  category: 'terminal',
  tags: ['terminal', 'cursor', 'blink', 'caret'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.minimumContrastRatio',
  type: 'number',
  default: 1,
  schema: v.pipe(v.number(), v.minValue(1), v.maxValue(21)),
  labelKey: 'workbench.settings.def.terminal.minimumContrastRatio.label',
  descriptionKey: 'workbench.settings.def.terminal.minimumContrastRatio.description',
  category: 'terminal',
  tags: ['terminal', 'contrast', 'accessibility', 'colors', 'readability'],
  scope: 'user',
  numberRange: { min: 1, max: 21, step: 0.5 },
});

registerSetting({
  key: 'terminal.scrollback',
  type: 'number',
  default: 5000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100000)),
  labelKey: 'workbench.settings.def.terminal.scrollback.label',
  descriptionKey: 'workbench.settings.def.terminal.scrollback.description',
  category: 'terminal',
  tags: ['terminal', 'scrollback', 'buffer', 'history', 'lines'],
  scope: 'user',
  numberRange: { min: 0, max: 100000, step: 1000 },
});

registerSetting({
  key: 'terminal.macOptionIsMeta',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.macOptionIsMeta.label',
  descriptionKey: 'workbench.settings.def.terminal.macOptionIsMeta.description',
  category: 'terminal',
  tags: ['terminal', 'option', 'meta', 'alt', 'keyboard', 'macos'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.copyOnSelect',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.copyOnSelect.label',
  descriptionKey: 'workbench.settings.def.terminal.copyOnSelect.description',
  category: 'terminal',
  tags: ['terminal', 'copy', 'select', 'clipboard'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.hyperlinks',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.hyperlinks.label',
  descriptionKey: 'workbench.settings.def.terminal.hyperlinks.description',
  category: 'terminal',
  tags: ['terminal', 'link', 'hyperlink', 'url', 'click'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.audibleBell',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.audibleBell.label',
  descriptionKey: 'workbench.settings.def.terminal.audibleBell.description',
  category: 'terminal',
  tags: ['terminal', 'bell', 'sound', 'beep', 'audio'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.closeTabOnExit',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.closeTabOnExit.label',
  descriptionKey: 'workbench.settings.def.terminal.closeTabOnExit.description',
  category: 'terminal',
  tags: ['terminal', 'close', 'exit', 'session', 'tab'],
  scope: 'user',
});

registerSetting({
  key: 'terminal.confirmCloseRunningProcess',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.terminal.confirmCloseRunningProcess.label',
  descriptionKey: 'workbench.settings.def.terminal.confirmCloseRunningProcess.description',
  category: 'terminal',
  tags: ['terminal', 'close', 'confirm', 'process'],
  scope: 'user',
});
