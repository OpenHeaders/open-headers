/**
 * Tool-window registry for the workspace.html shell.
 *
 * The registry is the single source of truth for which tool windows exist,
 * where they live by default, whether they can be hidden, and how they are
 * presented (icon + label). useToolLayout uses this to seed a fresh profile,
 * to validate persisted state on load, and to restore hidden windows to a
 * sensible slot when the user un-hides them.
 */

import {
  ApiOutlined,
  BookOutlined,
  CodeOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FundViewOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import type { ToolWindowDef as GenericToolWindowDef } from '@/shared/dock-layout';
import { ALL_DOCK_SLOTS as _ALL, dockRegion as _dockRegion, DOCK_LABELS as _LABELS } from '@/shared/dock-layout';
import type { ToolWindowId } from './types';

export type ToolWindowDef = GenericToolWindowDef<ToolWindowId>;

/**
 * The three left-top management panels (`http-rules`, `api-requests`,
 * `variables`) share `left-top` so the dock renders them as tabs.
 * `http-rules` is `core: true` — it's the landing surface, always
 * available. The others are user-toggleable via the activity bar.
 *
 * `var-scope` is the right-pane inspector that shows variables
 * referenced in the active rule + all scopes resolved against current
 * env/workspace/vault state. Historically IDed as `variables`;
 * renamed here because the left-pane management surface claimed the
 * `variables` id (both still surface a "Variables" label — position
 * disambiguates).
 */
export const TOOL_WINDOWS: readonly ToolWindowDef[] = [
  { id: 'http-rules', label: 'HTTP Rules', icon: <FileTextOutlined />, core: true, defaultSlot: 'left-top' },
  { id: 'api-requests', label: 'API Requests', icon: <ApiOutlined />, core: false, defaultSlot: 'left-top' },
  { id: 'variables', label: 'Variables', icon: <CodeOutlined />, core: false, defaultSlot: 'left-top' },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  { id: 'var-scope', label: 'Variables', icon: <ScanOutlined />, core: false, defaultSlot: 'right-bottom' },
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
