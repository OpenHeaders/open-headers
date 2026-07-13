/**
 * DevPanel Layout category — shell preferences for the browser DevTools
 * panel (panel.html). These parallel workspaceLayout but are namespaced
 * separately so the narrower DevTools surface can keep its own defaults
 * and user overrides independent of the workspace tab.
 */

import { BAR_LABELED_MAX, BAR_LABELED_MIN } from '@openheaders/ui/shared/dock-layout';
import * as v from 'valibot';
import { registerSetting } from '../registry';

const sidebarLayoutSchema = v.picklist(['proportional', 'compact', 'stacked', 'dynamic']);
export type DevpanelSidebarLayoutVariantSetting = v.InferOutput<typeof sidebarLayoutSchema>;

const bottomPanelAlignmentSchema = v.picklist(['center', 'left', 'right', 'justify']);
export type DevpanelBottomPanelAlignmentSetting = v.InferOutput<typeof bottomPanelAlignmentSchema>;

const footerTimingModeSchema = v.picklist(['aggregate', 'lastNav']);
export type DevpanelFooterTimingModeSetting = v.InferOutput<typeof footerTimingModeSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelLayout.footerShowVersion': boolean;
    'devpanelLayout.footerShowThemeSwitcher': boolean;
    'devpanelLayout.footerShowModified': boolean;
    'devpanelLayout.footerShowFailed': boolean;
    'devpanelLayout.footerShowCached': boolean;
    'devpanelLayout.footerShowPageContext': boolean;
    'devpanelLayout.footerTimingMode': DevpanelFooterTimingModeSetting;
    'devpanelLayout.topbarShowPanelToggles': boolean;
    'devpanelLayout.topbarShowLayoutMenu': boolean;
    'devpanelLayout.bottomPanelAlignment': DevpanelBottomPanelAlignmentSetting;
    'devpanelLayout.showToolWindowLabels': boolean;
    'devpanelLayout.sidebarLayout': DevpanelSidebarLayoutVariantSetting;
    'devpanelLayout.activityBarWidthLeft': number;
    'devpanelLayout.activityBarWidthRight': number;
  }
}

const activityBarWidthSchema = v.pipe(v.number(), v.minValue(BAR_LABELED_MIN), v.maxValue(BAR_LABELED_MAX));

// ── Footer visibility ────────────────────────────────────────────────

registerSetting({
  key: 'devpanelLayout.footerShowVersion',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.footerShowVersion.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerShowVersion.description',
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
  labelKey: 'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'theme', 'dark mode', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerShowModified',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.footerShowModified.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerShowModified.description',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'modified', 'rules', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerShowFailed',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.footerShowFailed.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerShowFailed.description',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'failed', 'errors', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerShowCached',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.footerShowCached.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerShowCached.description',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'cache', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerShowPageContext',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.footerShowPageContext.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerShowPageContext.description',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'page', 'navigation', 'preserve log', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.footerTimingMode',
  type: 'enum',
  default: 'aggregate',
  schema: footerTimingModeSchema,
  labelKey: 'workbench.settings.def.devpanelLayout.footerTimingMode.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.footerTimingMode.description',
  category: 'devpanelLayout',
  subcategory: 'Footer',
  tags: ['statusbar', 'footer', 'finish', 'load', 'navigation', 'preserve log', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'aggregate',
      labelKey: 'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description',
    },
    {
      value: 'lastNav',
      labelKey: 'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description',
    },
  ],
});

registerSetting({
  key: 'devpanelLayout.topbarShowPanelToggles',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description',
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
  labelKey: 'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description',
  category: 'devpanelLayout',
  subcategory: 'Top Bar',
  tags: ['topbar', 'layout', 'menu', 'devtools'],
  scope: 'user',
});

// ── Shell behavior ───────────────────────────────────────────────────

registerSetting({
  key: 'devpanelLayout.bottomPanelAlignment',
  type: 'enum',
  default: 'right',
  schema: bottomPanelAlignmentSchema,
  labelKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['bottom', 'panel', 'layout', 'align', 'wide', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'center',
      labelKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description',
    },
    {
      value: 'left',
      labelKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description',
    },
    {
      value: 'right',
      labelKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description',
    },
    {
      value: 'justify',
      labelKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description',
    },
  ],
});

registerSetting({
  key: 'devpanelLayout.showToolWindowLabels',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelLayout.showToolWindowLabels.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.showToolWindowLabels.description',
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
  labelKey: 'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description',
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
  labelKey: 'workbench.settings.def.devpanelLayout.activityBarWidthRight.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.activityBarWidthRight.description',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['activity bar', 'sidebar', 'width', 'right', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelLayout.sidebarLayout',
  type: 'enum',
  default: 'proportional',
  schema: sidebarLayoutSchema,
  labelKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.label',
  descriptionKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.description',
  category: 'devpanelLayout',
  subcategory: 'Shell',
  tags: ['sidebar', 'activity bar', 'split', 'layout', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'proportional',
      labelKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description',
    },
    {
      value: 'compact',
      labelKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description',
    },
    {
      value: 'stacked',
      labelKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description',
    },
    {
      value: 'dynamic',
      labelKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label',
      descriptionKey: 'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description',
    },
  ],
});
