/**
 * Workspace Sharing — trust controls for workspace-export imports.
 *
 * The "Allowed fetch hosts" setting drives the URL-fetch import source's
 * allowlist (design §5.1). The SW reads this comma-separated list from
 * `oh.settings.user[workspaceSharing.allowedFetchHosts]` on every fetch;
 * empty / unset values fall back to the conservative default
 * (`github.com`, `raw.githubusercontent.com`, `gist.github.com`).
 *
 * Single source of truth: this dict entry. No mirror to a separate key,
 * no SW writes — the renderer's settings UI is the only place this
 * value is edited.
 */

import * as v from 'valibot';
import { ALLOWED_FETCH_HOSTS_SETTING_KEY, DEFAULT_ALLOWED_FETCH_HOSTS } from '@/shared/storage';
import { registerSetting } from '../registry';

declare module '../types' {
  interface SettingsMap {
    [ALLOWED_FETCH_HOSTS_SETTING_KEY]: string;
  }
}

const hostListSchema = v.pipe(v.string(), v.maxLength(2048));

registerSetting({
  key: ALLOWED_FETCH_HOSTS_SETTING_KEY,
  type: 'string',
  default: DEFAULT_ALLOWED_FETCH_HOSTS.join(', '),
  schema: hostListSchema,
  label: 'Allowed fetch hosts',
  description:
    'Comma- or whitespace-separated list of HTTPS hosts the URL-fetch import source may retrieve workspace exports from. Subdomains are matched (e.g. `github.com` matches `gist.github.com`). Off-allowlist hosts and off-allowlist redirect targets are refused before any network call.',
  category: 'workspaceSharing',
  tags: ['allowlist', 'hosts', 'import', 'fetch', 'security', 'ssrf', 'sharing'],
  scope: 'user',
});
