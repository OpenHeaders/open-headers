export { ALL_DOCK_SLOTS, DOCK_LABELS, dockRegion, regionDocks } from './constants';
export { default as DockSlotIcon } from './DockSlotIcon';
export type { DockTabStripProps } from './DockTabStrip';
export { default as DockTabStrip } from './DockTabStrip';
export { default as DropZoneOverlay } from './DropZoneOverlay';
export type { FocusStore } from './focus-store';
export { createFocusStore } from './focus-store';
export type { LayoutMenuIconKind } from './LayoutMenuIcon';
export { default as LayoutMenuIcon } from './LayoutMenuIcon';
export { default as RegionToggle } from './RegionToggle';
export type { ShellLayoutProps } from './ShellLayout';
export { default as ShellLayout } from './ShellLayout';
export { default as SidebarLayoutIcon } from './SidebarLayoutIcon';
export type { ShellEventBus, ShellEventBusHandle } from './shell-event-bus';
export {
  createShellEventBus,
  ShellEventBusContext,
  useShellClickCapture,
  useShellFocusIn,
  useShellFocusOut,
  useShellKeyDown,
} from './shell-event-bus';
export type {
  DockSlot,
  DockState,
  DropZoneRect,
  FocusRegion,
  SidebarLayoutVariant,
  ToolLayoutState,
  ToolRegion,
  ToolWindowDef,
} from './types';
export type { DockLayoutApi, UseDockLayoutOptions } from './use-dock-layout';
export { makeDefaultDocks, normalizeDockLayout, useDockLayout } from './use-dock-layout';
export type { DockLayoutStorageResult } from './use-dock-layout-storage';
export { useDockLayoutStorage } from './use-dock-layout-storage';
export type { FocusRegionApi, UseFocusRegionOptions } from './use-focus-region';
export { useFocusRegion } from './use-focus-region';
