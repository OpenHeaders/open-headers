/**
 * Workspace Sharing — persisted UI state for the import-preview's diff
 * viewer.
 *
 * The `importPreview*` keys back the diff-viewer toolbar in the import
 * modal — each toolbar control reads/writes its own setting so the
 * user's preferences survive across sessions.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
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
