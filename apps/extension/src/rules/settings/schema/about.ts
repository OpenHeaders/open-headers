/**
 * About category — read-only info fields surfaced from the manifest
 * and the runtime environment. Demonstrates the `info` field type.
 */

import * as v from 'valibot';
import { runtime } from '@utils/browser-api';
import { registerSetting } from '../registry';

// valibot schema for info fields is a no-op string — the value is
// resolved at render time via `infoValue`, not persisted, so validation
// only guards against accidental writes.
const infoSchema = v.string();

declare module '../types' {
  interface SettingsMap {
    'about.version': string;
    'about.browser': string;
  }
}

registerSetting({
  key: 'about.version',
  type: 'info',
  default: '',
  schema: infoSchema,
  label: 'Version',
  description: 'The currently installed extension version.',
  category: 'about',
  tags: ['build'],
  scope: 'user',
  infoValue: () => {
    try {
      return runtime.getManifest().version;
    } catch {
      return '—';
    }
  },
});

registerSetting({
  key: 'about.browser',
  type: 'info',
  default: '',
  schema: infoSchema,
  label: 'Browser',
  description: 'Detected browser and platform.',
  category: 'about',
  scope: 'user',
  infoValue: () => {
    if (typeof navigator === 'undefined') return '—';
    return navigator.userAgent;
  },
});
