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
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description',
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
    {
      value: 'side-by-side',
      labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label',
    },
    {
      value: 'unified',
      labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label',
    },
  ],
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description',
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
    {
      value: 'none',
      labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label',
    },
    {
      value: 'ignore',
      labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label',
    },
  ],
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'whitespace', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffCollapseUnchanged',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowWhitespaces',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'whitespace', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowLineNumbers',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowIndentGuides',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffSoftWrap',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description',
  category: 'workspaceSharing',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});
