/**
 * Workspace Layout category — controls the structural chrome of
 * workbench.html: which affordances render in the footer status bar,
 * and the default modes for the tool-window shell.
 *
 * These used to live inside useToolLayout's persisted state. Moving
 * them to settings gives the user a discoverable "where can I change
 * this?" entry point, lets the footer menu and the Settings page
 * agree on the same source of truth, and drops an extra persistence
 * path from the shell hook.
 */

import { BAR_LABELED_MAX, BAR_LABELED_MIN } from '@openheaders/ui/shared/dock-layout';
import * as v from 'valibot';
import { registerSetting } from '../registry';

const sidebarLayoutSchema = v.picklist(['proportional', 'compact', 'stacked', 'dynamic']);
export type SidebarLayoutVariantSetting = v.InferOutput<typeof sidebarLayoutSchema>;

const bottomPanelAlignmentSchema = v.picklist(['center', 'left', 'right', 'justify']);
export type BottomPanelAlignmentSetting = v.InferOutput<typeof bottomPanelAlignmentSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'workspaceLayout.footerShowVersion': boolean;
    'workspaceLayout.footerShowThemeSwitcher': boolean;
    'workspaceLayout.topbarShowPanelToggles': boolean;
    'workspaceLayout.topbarShowLayoutMenu': boolean;
    'workspaceLayout.bottomPanelAlignment': BottomPanelAlignmentSetting;
    'workspaceLayout.showToolWindowLabels': boolean;
    'workspaceLayout.sidebarLayout': SidebarLayoutVariantSetting;
    'workspaceLayout.activityBarWidthLeft': number;
    'workspaceLayout.activityBarWidthRight': number;
  }
}

const activityBarWidthSchema = v.pipe(v.number(), v.minValue(BAR_LABELED_MIN), v.maxValue(BAR_LABELED_MAX));

// ── Footer visibility ────────────────────────────────────────────────

registerSetting({
  key: 'workspaceLayout.footerShowVersion',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Version in Footer',
  description: 'Display the extension version number in the workspace status bar.',
  category: 'workspaceLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'version'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.footerShowThemeSwitcher',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Theme Switcher in Footer',
  description: 'Display the light/dark/auto theme dropdown in the workspace status bar.',
  category: 'workspaceLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'theme', 'dark mode'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.topbarShowPanelToggles',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Panel Toggles in Top Bar',
  description: 'Display the left / bottom / right panel toggle icons in the workspace top bar.',
  category: 'workspaceLayout',
  subcategory: 'Top Bar',
  tags: ['topbar', 'panels', 'toggle'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.topbarShowLayoutMenu',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Layout Menu in Top Bar',
  description:
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the workspace top bar.',
  category: 'workspaceLayout',
  subcategory: 'Top Bar',
  tags: ['topbar', 'layout', 'menu'],
  scope: 'user',
});

// ── Shell behavior ───────────────────────────────────────────────────

registerSetting({
  key: 'workspaceLayout.bottomPanelAlignment',
  type: 'enum',
  default: 'center',
  schema: bottomPanelAlignmentSchema,
  label: 'Bottom Panel Alignment',
  description:
    'Where the bottom panel sits in the shell. Left/right aligns it under one sidebar + the editor; center nests it inside the middle column; justify spans the full viewport.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['bottom', 'panel', 'layout', 'align', 'wide'],
  scope: 'user',
  enumOptions: [
    { value: 'center', label: 'Center', description: 'Bottom panel nested inside the middle column' },
    { value: 'left', label: 'Left', description: 'Bottom spans left sidebar + editor' },
    { value: 'right', label: 'Right', description: 'Bottom spans editor + right sidebar' },
    { value: 'justify', label: 'Justify', description: 'Bottom spans the full viewport width' },
  ],
});

registerSetting({
  key: 'workspaceLayout.showToolWindowLabels',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Show Tool Window Labels',
  description: 'Render text labels next to activity-bar and dock-tab icons. Disable for an icon-only compact shell.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'tool window', 'labels', 'compact'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.activityBarWidthLeft',
  type: 'number',
  default: 78,
  schema: activityBarWidthSchema,
  label: 'Left Activity Bar Width',
  description: 'Width of the left activity bar when tool-window labels are visible. Locked to 36px in icon-only mode.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'sidebar', 'width', 'left'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.activityBarWidthRight',
  type: 'number',
  default: 78,
  schema: activityBarWidthSchema,
  label: 'Right Activity Bar Width',
  description: 'Width of the right activity bar when tool-window labels are visible. Locked to 36px in icon-only mode.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'sidebar', 'width', 'right'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.sidebarLayout',
  type: 'enum',
  default: 'dynamic',
  schema: sidebarLayoutSchema,
  label: 'Activity Bar Layout',
  description: 'How the activity-bar splits the top and bottom tool-window groups.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['sidebar', 'activity bar', 'split', 'layout'],
  scope: 'user',
  enumOptions: [
    { value: 'proportional', label: 'Proportional', description: 'Top and bottom groups split the activity bar 50/50' },
    { value: 'compact', label: 'Compact', description: 'Top group sizes to content; bottom pinned to bottom' },
    { value: 'stacked', label: 'Stacked', description: 'All groups clustered at the top with dividers between' },
    {
      value: 'dynamic',
      label: 'Dynamic',
      description:
        'Chip groups mirror their adjacent panel heights. Closed docks collapse to content and live neighbors absorb the space.',
    },
  ],
});
