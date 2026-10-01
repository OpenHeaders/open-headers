/**
 * Secret Managers category — this device's connections to external
 * secret managers (the Secret Providers plan): one list edited in
 * place, the only surface that creates, tests or removes a connection.
 */

import * as v from 'valibot';
import SecretManagerConnectionsRow from '../components/secret-manager-connections-row';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'secretManagers.connections': string;
  }
}

registerSetting({
  key: 'secretManagers.connections',
  subcategory: 'connections',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.secretManagers.connections.label',
  descriptionKey: 'workbench.settings.def.secretManagers.connections.description',
  category: 'secretManagers',
  tags: ['secret', 'manager', 'vault', 'password', 'keychain', 'connection', 'account', 'reference'],
  scope: 'user',
  customEditor: SecretManagerConnectionsRow,
});
