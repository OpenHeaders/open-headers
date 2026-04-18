/**
 * ShellLayout — workspace.html instance of the shared dockable
 * tool-window shell.
 *
 * Binds the generic `@/shared/dock-layout` ShellLayout to the
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

import { type CollisionDetection, closestCenter } from '@dnd-kit/core';
import type React from 'react';
import { useCallback } from 'react';
import { ShellLayout as SharedShellLayout, type SidebarLayoutVariant } from '@/shared/dock-layout';
import type { ResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { ToolLayoutApi } from '../hooks/useToolLayout';
import { useSetting, useSettingValue } from '../settings/hooks';
import { focusStore } from '../stores/focus-region-store';
import { TOOL_WINDOW_MAP } from '../tool-windows';
import type { DockSlot, ToolWindowId } from '../types';

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

// ── Custom collision detection ────────────────────────────────────────
//
// Editor-tab drags should only fire dnd-kit's sortable reorder animation
// when the pointer is inside a leaf's `.rules-tabs-bar`. Returning no
// collisions when the pointer is elsewhere prevents unwanted transform
// animations. Tool-window drags use the library default (closestCenter).

const editorTabCollisionDetection: CollisionDetection = (args) => {
  const activeKind = (args.active.data.current as { kind?: unknown } | undefined)?.kind;
  if (activeKind !== 'editor-tab') return closestCenter(args);
  const ptr = args.pointerCoordinates;
  if (!ptr) return [];

  let hoveredTabBar: HTMLElement | null = null;
  for (const container of args.droppableContainers) {
    const data = container.data.current as { kind?: unknown } | undefined;
    if (data?.kind !== 'editor-tab') continue;
    const node = container.node.current;
    if (!node) continue;
    const tabBar = node.closest('.rules-tabs-bar');
    if (!(tabBar instanceof HTMLElement)) continue;
    const r = tabBar.getBoundingClientRect();
    if (ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom) {
      hoveredTabBar = tabBar;
      break;
    }
  }
  if (!hoveredTabBar) return [];

  const scoped = args.droppableContainers.filter((container) => {
    const data = container.data.current as { kind?: unknown } | undefined;
    if (data?.kind !== 'editor-tab') return false;
    const node = container.node.current;
    return node != null && hoveredTabBar.contains(node);
  });
  return closestCenter({ ...args, droppableContainers: scoped });
};

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
  const [showLabels, setShowLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const bottomPanelFullWidth = useSettingValue('workspaceLayout.bottomPanelFullWidth');
  const sidebarLayout = useSettingValue('workspaceLayout.sidebarLayout') as SidebarLayoutVariant;
  const toggleLabels = useCallback(() => setShowLabels(!showLabels), [showLabels, setShowLabels]);

  return (
    <SharedShellLayout<ToolWindowId>
      tl={tl}
      windowMap={TOOL_WINDOW_MAP}
      renderToolWindow={renderToolWindow}
      renderEditor={renderEditor}
      onHorizontalResize={onHorizontalResize}
      onVerticalResize={onVerticalResize}
      renderEditorTabDragPreview={renderEditorTabDragPreview}
      bottomPanelFullWidth={bottomPanelFullWidth}
      showToolWindowLabels={showLabels}
      sidebarLayout={sidebarLayout}
      onToggleLabels={toggleLabels}
      sizes={responsive.sizes}
      collisionDetection={editorTabCollisionDetection}
      focusStore={focusStore}
    />
  );
};

export default ShellLayout;
