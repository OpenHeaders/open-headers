/**
 * Legal acknowledgment state — not a user-adjustable preference. The
 * desktop first-run notice (the in-app successor to the installer's
 * license page) flips this once on "Got it"; `when: () => false` keeps
 * the row out of the settings shell while the store still validates
 * and persists the value in the user scope, so the notice never
 * returns across restarts or updates.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'legal.firstRunAcknowledged': boolean;
  }
}

registerSetting({
  key: 'legal.firstRunAcknowledged',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'First-run legal notice acknowledged',
  description: 'Set once the first-run legal notice is dismissed; never shown in the settings shell.',
  category: 'general',
  scope: 'user',
  when: () => false,
});
