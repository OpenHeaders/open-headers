/**
 * Tool-window registry for the workbench.html shell.
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
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ToolWindowDef as GenericToolWindowDef } from '@/shared/dock-layout';
import { ALL_DOCK_SLOTS as _ALL, dockRegion as _dockRegion, DOCK_LABELS as _LABELS } from '@/shared/dock-layout';
import type { ToolWindowId } from './types';

export type ToolWindowDef = GenericToolWindowDef<ToolWindowId>;

/**
 * Left-side management panels split across two slots:
 *   - `http-workbench` (core) lives in `left-top` — the workbench landing surface.
 *   - `api-requests` + `variables` live in `left-bottom` so a first-open
 *     user sees workbench + requests stacked simultaneously without manually
 *     splitting the sidebar. `api-requests` is first in the tab order
 *     (reflected in the activity-bar icon ordering below).
 *
 * `var-scope` is the right-pane inspector that shows variables
 * referenced in the active rule + all scopes resolved against current
 * env/workspace/vault state. Surfaced as "Scope" to disambiguate from
 * the left-pane "Variables" management surface — left is the library
 * (what exists); right is what's in scope for the current tab.
 */
export const TOOL_WINDOWS: readonly ToolWindowDef[] = [
  { id: 'http-rules', label: 'HTTP Rules', icon: <FileTextOutlined />, core: true, defaultSlot: 'left-top' },
  { id: 'api-requests', label: 'API Requests', icon: <ApiOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'variables', label: 'Variables', icon: <CodeOutlined />, core: false, defaultSlot: 'left-bottom' },
  // `sources` is the scheduled-refresh variable producer (v4 carryover
  // noun). A Source authors a request chain + extraction rule; its
  // output surfaces as a `{{live.X}}` reference in the Scope panel's
  // Live category. Kept in its own left-bottom tab so users see it as
  // a first-class feature instead of as a Variables sub-section.
  { id: 'sources', label: 'Sources', icon: <ThunderboltOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  { id: 'var-scope', label: 'Scope', icon: <ScanOutlined />, core: false, defaultSlot: 'right-bottom' },
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
