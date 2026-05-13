/**
 * Workspace Sharing — trust controls for workspace-export imports plus
 * the persisted UI state for the import-preview's diff viewer.
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
 *
 * The `importPreview*` keys back the diff-viewer toolbar in the import
 * modal — each toolbar control reads/writes its own setting so the
 * user's preferences survive across sessions.
 */

import * as v from 'valibot';
import { ALLOWED_FETCH_HOSTS_SETTING_KEY, DEFAULT_ALLOWED_FETCH_HOSTS } from '@openheaders/core/storage';
import { registerSetting } from '../registry';

declare module '../types' {
  interface SettingsMap {
    [ALLOWED_FETCH_HOSTS_SETTING_KEY]: string;
    'workspaceSharing.importPreviewShowMergeStrategy': boolean;
    'workspaceSharing.importPreviewDiffViewer': 'side-by-side' | 'unified';
    'workspaceSharing.importPreviewDiffWhitespace': 'none' | 'ignore';
    'workspaceSharing.importPreviewDiffCollapseUnchanged': boolean;
    'workspaceSharing.importPreviewDiffShowWhitespaces': boolean;
    'workspaceSharing.importPreviewDiffShowLineNumbers': boolean;
    'workspaceSharing.importPreviewDiffShowIndentGuides': boolean;
    'workspaceSharing.importPreviewDiffSoftWrap': boolean;
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

registerSetting({
  key: 'workspaceSharing.importPreviewShowMergeStrategy',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show merge strategy on import-preview rows',
  description:
    "When on, each entity row in the import-preview's left sidebar shows the chosen merge strategy (Add as new, Replace, Skip, …) inline next to the line counts. Toggle off to free up row width on narrow panes.",
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'sidebar', 'strategy', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffViewer',
  type: 'enum',
  default: 'side-by-side',
  schema: v.picklist(['side-by-side', 'unified']),
  enumOptions: [
    { value: 'side-by-side', label: 'Side-by-side' },
    { value: 'unified', label: 'Unified' },
  ],
  label: 'Import-preview diff viewer',
  description:
    'Render target vs incoming side by side or stacked inline. Auto-flips to unified when the diff pane is too narrow.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'monaco', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffWhitespace',
  type: 'enum',
  default: 'none',
  schema: v.picklist(['none', 'ignore']),
  enumOptions: [
    { value: 'none', label: 'Do not ignore' },
    { value: 'ignore', label: 'Ignore whitespaces' },
  ],
  label: 'Import-preview diff whitespace handling',
  description: 'Whether the diff treats whitespace-only changes as edits or hides them.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'whitespace', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffCollapseUnchanged',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Collapse unchanged regions in import-preview diff',
  description: 'Hide runs of unchanged lines and replace them with a click-to-expand stub.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowWhitespaces',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Show whitespace characters in import-preview diff',
  description: 'Render spaces and tabs as visible glyphs (·, →) in the diff.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'whitespace', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowLineNumbers',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show line numbers in import-preview diff',
  description: 'Show the gutter line-number column next to each side of the diff.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowIndentGuides',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show indent guides in import-preview diff',
  description: 'Render vertical indent guides to make YAML nesting easier to scan.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffSoftWrap',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Soft-wrap long lines in import-preview diff',
  description: 'Wrap long lines onto the next visual line instead of horizontal scrolling.',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});
