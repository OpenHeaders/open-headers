/**
 * Terminal category — behavior of the workbench Terminal tool window.
 * Desktop-only in practice (the tool window rides the `terminal`
 * capability); the category itself is host-gated in categories.tsx.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'terminal.confirmCloseRunningProcess': boolean;
  }
}

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
