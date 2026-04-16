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
import type { ToolWindowDef as GenericToolWindowDef } from '@/shared/dock-layout';
import { ALL_DOCK_SLOTS as _ALL, dockRegion as _dockRegion, DOCK_LABELS as _LABELS } from '@/shared/dock-layout';
import type { ToolWindowId } from './types';

export type ToolWindowDef = GenericToolWindowDef<ToolWindowId>;

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

// Re-export shared constants so existing imports from this module keep working.
export const ALL_DOCK_SLOTS = _ALL;
export const DOCK_LABELS = _LABELS;
export const dockRegion = _dockRegion;
