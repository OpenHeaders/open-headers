/**
 * Workspace Layout category — controls the structural chrome of
 * workspace.html: which affordances render in the footer status bar,
 * and the default modes for the tool-window shell.
 *
 * These used to live inside useToolLayout's persisted state. Moving
 * them to settings gives the user a discoverable "where can I change
 * this?" entry point, lets the footer menu and the Settings page
 * agree on the same source of truth, and drops an extra persistence
 * path from the shell hook.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sidebarLayoutSchema = v.picklist(['proportional', 'compact', 'stacked']);
export type SidebarLayoutVariantSetting = v.InferOutput<typeof sidebarLayoutSchema>;

declare module '../types' {
  interface SettingsMap {
    'workspaceLayout.footerShowVersion': boolean;
    'workspaceLayout.footerShowThemeSwitcher': boolean;
    'workspaceLayout.footerShowPanelToggles': boolean;
    'workspaceLayout.footerShowLayoutMenu': boolean;
    'workspaceLayout.bottomPanelFullWidth': boolean;
    'workspaceLayout.showToolWindowLabels': boolean;
    'workspaceLayout.sidebarLayout': SidebarLayoutVariantSetting;
  }
}

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
  key: 'workspaceLayout.footerShowPanelToggles',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Panel Toggles in Footer',
  description: 'Display the left / bottom / right panel toggle icons in the workspace status bar.',
  category: 'workspaceLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'panels', 'toggle'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.footerShowLayoutMenu',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Layout Menu in Footer',
  description:
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the workspace status bar.',
  category: 'workspaceLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'layout', 'menu'],
  scope: 'user',
});

// ── Shell behavior ───────────────────────────────────────────────────

registerSetting({
  key: 'workspaceLayout.bottomPanelFullWidth',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Bottom Panel Full Width',
  description:
    'When enabled, the bottom region spans the full viewport width instead of nesting inside the middle column.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['bottom', 'panel', 'layout', 'wide'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.showToolWindowLabels',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Tool Window Labels',
  description: 'Render text labels next to activity-bar and dock-tab icons. Disable for an icon-only compact shell.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'tool window', 'labels', 'compact'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.sidebarLayout',
  type: 'enum',
  default: 'proportional',
  schema: sidebarLayoutSchema,
  label: 'Sidebar Layout',
  description: 'How the activity-bar splits the top and bottom tool-window groups.',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['sidebar', 'activity bar', 'split', 'layout'],
  scope: 'user',
  enumOptions: [
    { value: 'proportional', label: 'Proportional', description: 'Top and bottom groups split the activity bar 50/50' },
    { value: 'compact', label: 'Compact', description: 'Top group sizes to content; bottom pinned to bottom' },
    { value: 'stacked', label: 'Stacked', description: 'All groups clustered at the top with dividers between' },
  ],
});
