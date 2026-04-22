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
 * Default slot layout:
 *   - Left pane hosts the authoring surfaces: `http-rules` (core) on
 *     `left-top`, with `api-requests` + `workflows` stacked on
 *     `left-bottom` so a first-open user sees rules + requests together
 *     without manually splitting the sidebar.
 *   - Right pane hosts the inspectors that annotate the active tab:
 *     `docs` + `var-scope` share `right-top` as sibling tabs (reference
 *     + tab-scoped state), and `variables` — the workspace-wide variable
 *     library — lives below on `right-bottom`.
 *
 * `var-scope` is the inspector that shows variables referenced in the
 * active rule + all scopes resolved against current env/workspace/vault
 * state. Surfaced as "Scope" to disambiguate from the "Variables"
 * library — Variables is the catalogue (what exists), Scope is what's
 * actually in scope for the current tab.
 */
export const TOOL_WINDOWS: readonly ToolWindowDef[] = [
  { id: 'http-rules', label: 'HTTP Rules', icon: <FileTextOutlined />, core: true, defaultSlot: 'left-top' },
  { id: 'api-requests', label: 'API Requests', icon: <ApiOutlined />, core: false, defaultSlot: 'left-bottom' },
  // A Workflow is the scheduled-refresh variable producer: a request
  // chain + extraction rule. Its output surfaces as a `{{live.X}}`
  // reference in the Scope panel's Live category via a Live Variable
  // binding. First-class left-bottom tab so users see it as a feature
  // rather than a Variables sub-section.
  { id: 'workflows', label: 'Workflows', icon: <ThunderboltOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  { id: 'var-scope', label: 'Scope', icon: <ScanOutlined />, core: false, defaultSlot: 'right-top' },
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
