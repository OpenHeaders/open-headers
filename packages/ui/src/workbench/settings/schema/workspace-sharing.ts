/**
 * Workspace Sharing + Diff Viewer — persisted UI state for the
 * import-preview and the diff viewer it renders with.
 *
 * The `importPreview*` keys back the diff-viewer toolbar in the import
 * modal — each toolbar control reads/writes its own setting so the
 * user's preferences survive across sessions. The `importPreviewDiff*`
 * defs live on the Editor › Diff Viewer page (storage keys unchanged);
 * the Workspace Sharing page keeps the merge-strategy row and points
 * at the viewer through `workspaceSharing.diffViewerHome`.
 */

import * as v from 'valibot';
import DiffViewerHomeRow from '../components/diff-viewer-home-row';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'workspaceSharing.importPreviewShowMergeStrategy': boolean;
    'workspaceSharing.diffViewerHome': string;
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
  subcategory: 'importPreview',
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
  key: 'workspaceSharing.diffViewerHome',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.workspaceSharing.diffViewerHome.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.diffViewerHome.description',
  category: 'workspaceSharing',
  subcategory: 'importPreview',
  tags: ['import', 'preview', 'diff', 'viewer'],
  scope: 'user',
  customEditor: DiffViewerHomeRow,
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffViewer',
  subcategory: 'view',
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
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'monaco', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffWhitespace',
  subcategory: 'view',
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
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'whitespace', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffCollapseUnchanged',
  subcategory: 'view',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description',
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowWhitespaces',
  subcategory: 'view',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description',
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'whitespace', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowLineNumbers',
  subcategory: 'view',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description',
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffShowIndentGuides',
  subcategory: 'view',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description',
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceSharing.importPreviewDiffSoftWrap',
  subcategory: 'view',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label',
  descriptionKey: 'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description',
  category: 'diffViewer',
  tags: ['import', 'preview', 'diff', 'sharing'],
  scope: 'user',
});
