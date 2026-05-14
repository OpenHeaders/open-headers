/**
 * About category — read-only info fields surfaced from the manifest,
 * build metadata, and the protocol contract.
 */

import { MIN_COMPATIBLE_PROTOCOL, PROTOCOL_VERSION } from '@openheaders/core/protocol';
import * as v from 'valibot';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import { registerSetting } from '../registry';

// valibot schema for info fields is a no-op string — the value is
// resolved at render time via `infoValue`, not persisted, so validation
// only guards against accidental writes.
const infoSchema = v.string();

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'about.version': string;
    'about.build': string;
    'about.commit': string;
    'about.protocol': string;
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
    const { version, channel } = getBuildInfo();
    return channel === 'beta' ? `${version} (beta)` : version;
  },
});

registerSetting({
  key: 'about.build',
  type: 'info',
  default: '',
  schema: infoSchema,
  label: 'Build',
  description: 'Build number and date.',
  category: 'about',
  tags: ['build'],
  scope: 'user',
  infoValue: () => {
    const { build, date } = getBuildInfo();
    const day = date ? date.slice(0, 10) : '—';
    return build > 0 ? `${build} · ${day}` : day;
  },
});

registerSetting({
  key: 'about.commit',
  type: 'info',
  default: '',
  schema: infoSchema,
  label: 'Commit',
  description: 'Git commit this build was produced from.',
  category: 'about',
  tags: ['build'],
  scope: 'user',
  infoValue: () => getBuildInfo().commit,
});

registerSetting({
  key: 'about.protocol',
  type: 'info',
  default: '',
  schema: infoSchema,
  label: 'Protocol',
  description:
    'Wire-protocol version this extension speaks with the desktop app. ' +
    'Mismatched peers are rejected with a clear update prompt.',
  category: 'about',
  tags: ['protocol'],
  scope: 'user',
  infoValue: () => {
    const accepts =
      MIN_COMPATIBLE_PROTOCOL === PROTOCOL_VERSION
        ? `accepts v${PROTOCOL_VERSION}`
        : `accepts v${MIN_COMPATIBLE_PROTOCOL}–v${PROTOCOL_VERSION}`;
    return `v${PROTOCOL_VERSION} · ${accepts}`;
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
