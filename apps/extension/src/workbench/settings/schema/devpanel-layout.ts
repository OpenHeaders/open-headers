/**
 * DevPanel Layout category — shell preferences for the browser DevTools
 * panel (panel.html). These parallel workspaceLayout but are namespaced
 * separately so the narrower DevTools surface can keep its own defaults
 * and user overrides independent of the workspace tab.
 *
 * The only workspaceLayout key without a counterpart here is
 * `footerShowVersion`: the DevTools status bar leads with per-session
 * network metrics (request count, transferred bytes, DCL, Load) and
 * has no version readout to gate.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sidebarLayoutSchema = v.picklist(['proportional', 'compact', 'stacked']);
export type DevpanelSidebarLayoutVariantSetting = v.InferOutput<typeof sidebarLayoutSchema>;

declare module '../types' {
  interface SettingsMap {
    'devpanelLayout.footerShowThemeSwitcher': boolean;
    'devpanelLayout.footerShowPanelToggles': boolean;
    'devpanelLayout.footerShowLayoutMenu': boolean;
    'devpanelLayout.bottomPanelFullWidth': boolean;
    'devpanelLayout.showToolWindowLabels': boolean;
    'devpanelLayout.sidebarLayout': DevpanelSidebarLayoutVariantSetting;
  }
}

// ── Footer visibility ────────────────────────────────────────────────

registerSetting({
  key: 'devpanelLayout.footerShowThemeSwitcher',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Theme Switcher in Footer',
  description: 'Display the light/dark/auto theme dropdown in the DevTools panel status bar.',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'theme', 'dark mode', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerShowPanelToggles',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Panel Toggles in Footer',
  description: 'Display the left / bottom / right panel toggle icons in the DevTools panel status bar.',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'panels', 'toggle', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerShowLayoutMenu',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Layout Menu in Footer',
  description:
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the DevTools panel status bar.',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'layout', 'menu', 'devtools'],
  scope: 'user',
});

// ── Shell behavior ───────────────────────────────────────────────────

registerSetting({
  key: 'devpanelLayout.bottomPanelFullWidth',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Bottom Panel Full Width',
  description:
    'When enabled, the bottom region spans the full DevTools panel width instead of nesting inside the middle column.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['bottom', 'panel', 'layout', 'wide', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.showToolWindowLabels',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Show Tool Window Labels',
  description:
    'Render text labels next to activity-bar and dock-tab icons in the DevTools panel. Disabled by default because the panel is narrower than the workspace.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'tool window', 'labels', 'compact', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.sidebarLayout',
  type: 'enum',
  default: 'proportional',
  schema: sidebarLayoutSchema,
  label: 'Sidebar Layout',
  description: 'How the activity-bar splits the top and bottom tool-window groups in the DevTools panel.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['sidebar', 'activity bar', 'split', 'layout', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'proportional', label: 'Proportional', description: 'Top and bottom groups split the activity bar 50/50' },
    { value: 'compact', label: 'Compact', description: 'Top group sizes to content; bottom pinned to bottom' },
    { value: 'stacked', label: 'Stacked', description: 'All groups clustered at the top with dividers between' },
  ],
});
