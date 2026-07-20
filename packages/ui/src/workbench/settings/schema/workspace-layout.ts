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

import { hasCapability } from '@openheaders/core/capabilities';
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
  labelKey: 'workbench.settings.def.workspaceLayout.footerShowVersion.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.footerShowVersion.description',
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
  labelKey: 'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description',
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
  labelKey: 'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description',
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
  labelKey: 'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description',
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
  // Host-aware default: hosts with a terminal (the desktop app) give
  // its bottom panel the full window width; terminal-less workbench
  // hosts keep the centered stack.
  getDefault: () => (hasCapability('terminal') ? 'justify' : 'center'),
  schema: bottomPanelAlignmentSchema,
  labelKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['bottom', 'panel', 'layout', 'align', 'wide'],
  scope: 'user',
  enumOptions: [
    {
      value: 'center',
      labelKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description',
    },
    {
      value: 'left',
      labelKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description',
    },
    {
      value: 'right',
      labelKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description',
    },
    {
      value: 'justify',
      labelKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description',
    },
  ],
});

registerSetting({
  key: 'workspaceLayout.showToolWindowLabels',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.workspaceLayout.showToolWindowLabels.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.showToolWindowLabels.description',
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
  labelKey: 'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description',
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
  labelKey: 'workbench.settings.def.workspaceLayout.activityBarWidthRight.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.activityBarWidthRight.description',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'sidebar', 'width', 'right'],
  scope: 'user',
});

registerSetting({
  key: 'workspaceLayout.sidebarLayout',
  type: 'enum',
  default: 'proportional',
  schema: sidebarLayoutSchema,
  labelKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.label',
  descriptionKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.description',
  category: 'workspaceLayout',
  subcategory: 'Shell',
  tags: ['sidebar', 'activity bar', 'split', 'layout'],
  scope: 'user',
  enumOptions: [
    {
      value: 'proportional',
      labelKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description',
    },
    {
      value: 'compact',
      labelKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description',
    },
    {
      value: 'stacked',
      labelKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description',
    },
    {
      value: 'dynamic',
      labelKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label',
      descriptionKey: 'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description',
    },
  ],
});
