/**
 * ShellLayout — workbench.html instance of the shared dockable
 * tool-window shell.
 *
 * Binds the generic `@openheaders/ui/shared/dock-layout` ShellLayout to the
 * workspace's concerns:
 *   - `TOOL_WINDOW_MAP` / `ToolWindowId` registry
 *   - workspace `focusStore` instance
 *   - workspace layout settings (`workspaceLayout.*`)
 *   - `responsive.sizes` from `useResponsiveLayout`
 *   - editor-tab collision detection scoped to `.rules-tabs-bar`
 *
 * All drag-and-drop, regions, zen mode, drop zones, etc. live in the
 * shared component — this wrapper just plumbs domain inputs in.
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  type BottomPanelAlignment,
  type BottomPanelSplit,
  makeEditorTabCollisionDetection,
  ShellLayout as SharedShellLayout,
  type SidebarLayoutVariant,
} from '@openheaders/ui/shared/dock-layout';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import type { ResponsiveLayout } from '../../hooks/useResponsiveLayout';
import type { ToolLayoutApi } from '../../hooks/useToolLayout';
import { useSetting, useSettingValue } from '../../settings/hooks';
import { focusStore } from '../../stores/focus-region-store';
import { useWorkspaceGitBound } from '../../stores/git-binding-store';
import { TOOL_WINDOW_MAP, type ToolWindowDef } from '../../tool-windows';
import type { DockSlot, ToolWindowId } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────

export interface ShellLayoutProps {
  tl: ToolLayoutApi;
  responsive: ResponsiveLayout;
  /** Renders the body of a tool window when it is the active one in its dock. */
  renderToolWindow: (id: ToolWindowId, slot: DockSlot) => React.ReactNode;
  /** Renders the central editor area (tabs + breadcrumb + active tab body). */
  renderEditor: () => React.ReactNode;
  /** Called when a dock pane is resized so the host can persist ratios. */
  onHorizontalResize: (sizes: number[]) => void;
  onVerticalResize: (sizes: number[]) => void;
  /** Render the floating drag preview for an editor tab (owned by the host). */
  renderEditorTabDragPreview?: (tabId: string) => React.ReactNode;
}

const editorTabCollisionDetection = makeEditorTabCollisionDetection('.rules-tabs-bar');

// ── Workspace shell ───────────────────────────────────────────────────

const ShellLayout: React.FC<ShellLayoutProps> = ({
  tl,
  responsive,
  renderToolWindow,
  renderEditor,
  onHorizontalResize,
  onVerticalResize,
  renderEditorTabDragPreview,
}) => {
  // Version Control naming law (the IDE model): the tool window's BASE
  // identity is "Version Control"; it reads "Git" only once the active
  // workspace's directory binding exists. Everything else about the
  // def (id, icon, slot, gating) stays the registry's.
  const workspaceId = useActiveWorkspaceId();
  const gitBound = useWorkspaceGitBound(workspaceId);
  const windowMap = useMemo(() => {
    if (gitBound) return TOOL_WINDOW_MAP;
    const { id, icon, core, defaultSlot, openByDefault, requiresCapability, teaserWhenUnavailable } =
      TOOL_WINDOW_MAP.git;
    const versionControl: ToolWindowDef = {
      id,
      icon,
      core,
      defaultSlot,
      ...(openByDefault !== undefined ? { openByDefault } : {}),
      ...(requiresCapability !== undefined ? { requiresCapability } : {}),
      ...(teaserWhenUnavailable !== undefined ? { teaserWhenUnavailable } : {}),
      labelKey: 'workbench.toolWindows.versionControl',
    };
    return { ...TOOL_WINDOW_MAP, git: versionControl };
  }, [gitBound]);

  const [showLabels, setShowLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const bottomPanelAlignment = useSettingValue('workspaceLayout.bottomPanelAlignment') as BottomPanelAlignment;
  const bottomPanelSplit = useSettingValue('workspaceLayout.bottomPanelSplit') as BottomPanelSplit;
  const sidebarLayout = useSettingValue('workspaceLayout.sidebarLayout') as SidebarLayoutVariant;
  const [barWidthLeft, setBarWidthLeft] = useSetting('workspaceLayout.activityBarWidthLeft');
  const [barWidthRight, setBarWidthRight] = useSetting('workspaceLayout.activityBarWidthRight');
  const toggleLabels = useCallback(() => setShowLabels(!showLabels), [showLabels, setShowLabels]);
  const handleBarResize = useCallback(
    (sizes: { left: number; right: number }) => {
      setBarWidthLeft(sizes.left);
      setBarWidthRight(sizes.right);
    },
    [setBarWidthLeft, setBarWidthRight],
  );

  return (
    <SharedShellLayout<ToolWindowId>
      tl={tl}
      windowMap={windowMap}
      renderToolWindow={renderToolWindow}
      renderEditor={renderEditor}
      onHorizontalResize={onHorizontalResize}
      onVerticalResize={onVerticalResize}
      renderEditorTabDragPreview={renderEditorTabDragPreview}
      bottomPanelAlignment={bottomPanelAlignment}
      bottomPanelSplit={bottomPanelSplit}
      showToolWindowLabels={showLabels}
      sidebarLayout={sidebarLayout}
      onToggleLabels={toggleLabels}
      activityBarWidths={{ left: barWidthLeft, right: barWidthRight }}
      onActivityBarResize={handleBarResize}
      sizes={responsive.sizes}
      collisionDetection={editorTabCollisionDetection}
      focusStore={focusStore}
    />
  );
};

export default ShellLayout;
