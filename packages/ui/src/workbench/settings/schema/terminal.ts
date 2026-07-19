/**
 * Terminal category — behavior of the workbench Terminal tool window.
 * Desktop-only in practice (the tool window rides the `terminal`
 * capability); the category itself is host-gated in categories.tsx.
 */

import { lazy } from 'react';
import * as v from 'valibot';
import { registerSetting } from '../registry';

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

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'terminal.confirmCloseRunningProcess': boolean;
    'terminal.profiles': TerminalProfilesValue;
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
