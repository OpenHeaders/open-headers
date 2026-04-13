/**
 * Tool-window registry for the workspace.html shell.
 *
 * The registry is the single source of truth for which tool windows exist,
 * where they live by default, whether they can be hidden, and how they are
 * presented (icon + label). useToolLayout uses this to seed a fresh profile,
 * to validate persisted state on load, and to restore hidden windows to a
 * sensible slot when the user un-hides them.
 */

import { AppstoreOutlined, BookOutlined, CodeOutlined, ExperimentOutlined, FundViewOutlined } from '@ant-design/icons';
import type React from 'react';
import type { DockSlot, ToolRegion, ToolWindowId } from './types';

export interface ToolWindowDef {
  id: ToolWindowId;
  label: string;
  icon: React.ReactNode;
  /** Core tool windows cannot be hidden — the Hide menu entry is disabled. */
  core: boolean;
  /** Initial dock slot on a fresh profile; also the restore target for Hide → Show. */
  defaultSlot: DockSlot;
}

export const TOOL_WINDOWS: readonly ToolWindowDef[] = [
  { id: 'items', label: 'Items', icon: <AppstoreOutlined />, core: true, defaultSlot: 'left-top' },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  { id: 'variables', label: 'Variables', icon: <CodeOutlined />, core: false, defaultSlot: 'right-bottom' },
  { id: 'page-traffic', label: 'Page Traffic', icon: <FundViewOutlined />, core: false, defaultSlot: 'bottom-right' },
  { id: 'test-runs', label: 'Test Runs', icon: <ExperimentOutlined />, core: false, defaultSlot: 'bottom-left' },
];

export const TOOL_WINDOW_MAP: Record<ToolWindowId, ToolWindowDef> = TOOL_WINDOWS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<ToolWindowId, ToolWindowDef>,
);

export const ALL_DOCK_SLOTS: readonly DockSlot[] = [
  'left-top',
  'left-bottom',
  'right-top',
  'right-bottom',
  'bottom-left',
  'bottom-right',
];

export const DOCK_LABELS: Record<DockSlot, string> = {
  'left-top': 'Left Top',
  'left-bottom': 'Left Bottom',
  'right-top': 'Right Top',
  'right-bottom': 'Right Bottom',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
};

/** Map from a dock slot to the high-level screen region that contains it. */
export function dockRegion(slot: DockSlot): ToolRegion {
  if (slot === 'left-top' || slot === 'left-bottom') return 'left';
  if (slot === 'right-top' || slot === 'right-bottom') return 'right';
  return 'bottom';
}
