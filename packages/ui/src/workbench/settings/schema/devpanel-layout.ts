/**
 * DevPanel Layout category — shell preferences for the browser DevTools
 * panel (panel.html). These parallel workspaceLayout but are namespaced
 * separately so the narrower DevTools surface can keep its own defaults
 * and user overrides independent of the workspace tab.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sidebarLayoutSchema = v.picklist(['proportional', 'compact', 'stacked', 'dynamic']);
export type DevpanelSidebarLayoutVariantSetting = v.InferOutput<typeof sidebarLayoutSchema>;

const bottomPanelAlignmentSchema = v.picklist(['center', 'left', 'right', 'justify']);
export type DevpanelBottomPanelAlignmentSetting = v.InferOutput<typeof bottomPanelAlignmentSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelLayout.footerShowVersion': boolean;
    'devpanelLayout.footerShowThemeSwitcher': boolean;
    'devpanelLayout.topbarShowPanelToggles': boolean;
    'devpanelLayout.topbarShowLayoutMenu': boolean;
    'devpanelLayout.bottomPanelAlignment': DevpanelBottomPanelAlignmentSetting;
    'devpanelLayout.showToolWindowLabels': boolean;
    'devpanelLayout.sidebarLayout': DevpanelSidebarLayoutVariantSetting;
    'devpanelLayout.activityBarWidthLeft': number;
    'devpanelLayout.activityBarWidthRight': number;
  }
}

const activityBarWidthSchema = v.pipe(v.number(), v.minValue(64), v.maxValue(160));

// ── Footer visibility ────────────────────────────────────────────────

registerSetting({
  key: 'devpanelLayout.footerShowVersion',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Version in Footer',
  description: 'Display the extension version number in the DevTools panel status bar.',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'version', 'devtools'],
  scope: 'user',
});

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
  key: 'devpanelLayout.topbarShowPanelToggles',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Panel Toggles in Top Bar',
  description: 'Display the left / bottom / right panel toggle icons in the DevTools panel top bar.',
  category: 'devpanelLayout',
  subcategory: 'Top Bar',
  tags: ['topbar', 'panels', 'toggle', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.topbarShowLayoutMenu',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Layout Menu in Top Bar',
  description:
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the DevTools panel top bar.',
  category: 'devpanelLayout',
  subcategory: 'Top Bar',
  tags: ['topbar', 'layout', 'menu', 'devtools'],
  scope: 'user',
});

// ── Shell behavior ───────────────────────────────────────────────────

registerSetting({
  key: 'devpanelLayout.bottomPanelAlignment',
  type: 'enum',
  default: 'center',
  schema: bottomPanelAlignmentSchema,
  label: 'Bottom Panel Alignment',
  description:
    'Where the bottom panel sits in the DevTools panel. Left/right aligns it under one sidebar + the editor; center nests it inside the middle column; justify spans the full width.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['bottom', 'panel', 'layout', 'align', 'wide', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'center', label: 'Center', description: 'Bottom panel nested inside the middle column' },
    { value: 'left', label: 'Left', description: 'Bottom spans left sidebar + editor' },
    { value: 'right', label: 'Right', description: 'Bottom spans editor + right sidebar' },
    { value: 'justify', label: 'Justify', description: 'Bottom spans the full DevTools panel width' },
  ],
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
  key: 'devpanelLayout.activityBarWidthLeft',
  type: 'number',
  default: 78,
  schema: activityBarWidthSchema,
  label: 'Left Activity Bar Width',
  description:
    'Width of the left activity bar in the DevTools panel when tool-window labels are visible. Locked to 36px in icon-only mode.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'sidebar', 'width', 'left', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.activityBarWidthRight',
  type: 'number',
  default: 78,
  schema: activityBarWidthSchema,
  label: 'Right Activity Bar Width',
  description:
    'Width of the right activity bar in the DevTools panel when tool-window labels are visible. Locked to 36px in icon-only mode.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'sidebar', 'width', 'right', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.sidebarLayout',
  type: 'enum',
  default: 'dynamic',
  schema: sidebarLayoutSchema,
  label: 'Activity Bar Layout',
  description: 'How the activity-bar splits the top and bottom tool-window groups in the DevTools panel.',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['sidebar', 'activity bar', 'split', 'layout', 'devtools'],
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
