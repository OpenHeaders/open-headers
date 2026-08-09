/**
 * GitGroupRenderer — recursive renderer for the Git tool window's
 * split pane tree, the terminal group renderer's mechanism applied to
 * git tabs (both ride the shared pane-tabs machinery):
 *
 *   - Each leaf renders its own tab strip + its active tab's view (a
 *     log view or the console pane).
 *   - While a tab drags, one window pointermove listener hit-tests the
 *     cursor against every leaf (shared computeZoneForLeaf) and shows
 *     the half/whole-panel drop preview (shared LeafDropPreview).
 *   - Drop dispatch: over a tab → same-leaf reorder or cross-leaf
 *     insert at that index; over a leaf zone → center move or edge
 *     split. Same priority order as the editor and terminal.
 *
 * Owns the panel's DndContext (git tabs never leave the panel) with
 * the shared sensor/collision/measuring configuration, and publishes
 * drag intent to the strips via GitDragIntentContext. Single-row law
 * (terminal posture): while the tree is ONE pane its strip rides the
 * panel header row via `renderHeader`; once split every pane owns its
 * strip row — the first prefixed with the panel title, the top-right
 * one carrying the corner cluster.
 */

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Allotment } from 'allotment';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { allLeaves, type EditorLeaf, type EditorNode, findLeaf, firstLeaf } from '../../../editor-groups';
import { computeZoneForLeaf, type LeafDropZone, LeafDropPreview } from '../../shell/EditorGroupRenderer';
import { makePaneTabCollisionDetection } from '../pane-tabs/pane-tab-collision';
import {
  oppositeDirectionOf,
  parentOrientationOf,
  type PaneTabRef,
} from '../pane-tabs/pane-tabs-store';
import { type GitDragIntent, GitDragIntentContext } from './git-drag-intent';
import GitComparePane from './compare/GitComparePane';
import { GIT_PRIMARY_TAB_KEY, type GitPanelTab, type GitPanelWorkbench, gitPanelTabKey } from './git-panel-view-store';
import GitConsolePane from './GitConsolePane';
import GitLogView from './GitLogView';
import GitTabStrip, { type GitTabDescriptor } from './GitTabStrip';

const CONTENT_SELECTOR = '.git-leaf-content';

/** The shared scoped-collision law bound to git-tab drag data. */
const gitTabCollision = makePaneTabCollisionDetection('git-tab');

interface LeafHover {
  leafId: string;
  zone: LeafDropZone;
}

export interface GitGroupRendererProps {
  workbench: GitPanelWorkbench;
  workspaceId: string;
  /** Checked-out branch — every log tab's label + the unborn-HEAD row. */
  branch: string | null;
  /** True while the git dock owns focus (strip tint law). */
  dockFocused: boolean;
  /** Renders the panel header row while the tree is a SINGLE pane. */
  renderHeader: (headerContent: React.ReactNode) => React.ReactNode;
  /** The (i) info trigger — split state renders it after the "Git"
   *  label in the title pane's row. */
  titleInfo: React.ReactNode;
  /** Right-aligned strip tail (the chevron menu); the split-state
   *  top-right pane passes `corner: true` and additionally hosts
   *  info + hide (the PanelHeader isn't rendered while split). */
  renderTrailing: (options: { corner: boolean }) => React.ReactNode;
}

export const GitGroupRenderer: React.FC<GitGroupRendererProps> = ({
  workbench,
  workspaceId,
  branch,
  dockFocused,
  renderHeader,
  titleInfo,
  renderTrailing,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { registry, panes } = workbench;
  const root = panes.root();
  const focusedLeafId = panes.focusedLeafId();

  const tabByKey = new Map<string, GitPanelTab>();
  for (const tab of registry.tabs()) tabByKey.set(gitPanelTabKey(tab), tab);
  const labelFor = (tab: GitPanelTab): string => {
    if (tab.kind === 'console') return t('workbench.gitLog.console.tab');
    if (tab.kind === 'compare') return t('workbench.gitLog.compareTab', { a: branch ?? 'HEAD', b: tab.ref });
    return t('workbench.gitLog.logTab', { branch: branch ?? 'HEAD' });
  };
  const leafDescriptors = (leaf: EditorLeaf<PaneTabRef>): GitTabDescriptor[] =>
    leaf.tabs.flatMap((ref) => {
      const tab = tabByKey.get(ref.id);
      if (tab === undefined) return [];
      return [{ key: ref.id, label: labelFor(tab), closable: ref.id !== GIT_PRIMARY_TAB_KEY }];
    });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Per-leaf DOM refs for cursor hit-testing.
  const leafRefs = useRef(new Map<string, HTMLElement>());
  const registerLeafRef = useCallback((leafId: string) => {
    return (el: HTMLElement | null) => {
      if (el) leafRefs.current.set(leafId, el);
      else leafRefs.current.delete(leafId);
    };
  }, []);

  // Drag state — populated while a git-tab drag is active; ref mirrors
  // for inside-of-listener reads without stale closures.
  const [dragActive, setDragActive] = useState<{ fromLeafId: string; tabId: string } | null>(null);
  const dragRef = useRef<{ fromLeafId: string; tabId: string } | null>(null);
  const [hover, setHover] = useState<LeafHover | null>(null);
  const hoverRef = useRef<LeafHover | null>(null);
  hoverRef.current = hover;
  const [insertion, setInsertion] = useState<{ leafId: string; index: number } | null>(null);
  const rootRef = useRef(root);
  rootRef.current = root;

  // Cursor tracking — one pointermove listener while dragging.
  useEffect(() => {
    if (!dragActive) {
      setHover(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      let match: LeafHover | null = null;
      for (const [leafId, el] of leafRefs.current) {
        const zone = computeZoneForLeaf(el, e.clientX, e.clientY, CONTENT_SELECTOR);
        if (zone) {
          match = { leafId, zone };
          break;
        }
      }
      setHover((prev) => {
        if (prev && match && prev.leafId === match.leafId && prev.zone === match.zone) return prev;
        return match;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [dragActive]);

  const asTabData = (data: unknown): { leafId: string; tabId: string } | null => {
    const d = data as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
    if (d?.kind !== 'git-tab' || typeof d.leafId !== 'string' || typeof d.tabId !== 'string') return null;
    return { leafId: d.leafId, tabId: d.tabId };
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = asTabData(event.active.data.current);
    if (!data) return;
    const next = { fromLeafId: data.leafId, tabId: data.tabId };
    dragRef.current = next;
    setDragActive(next);
    setInsertion(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const overData = asTabData(event.over?.data.current);
    if (!overData || overData.leafId === drag.fromLeafId) {
      // Same-leaf reorder is handled natively by SortableContext — no
      // cross-leaf insertion marker needed.
      setInsertion((prev) => (prev === null ? prev : null));
      return;
    }
    const toLeaf = findLeaf(rootRef.current, overData.leafId);
    const idx = toLeaf?.tabs.findIndex((ref) => ref.id === overData.tabId) ?? -1;
    if (idx < 0) return;
    setInsertion((prev) => {
      if (prev && prev.leafId === overData.leafId && prev.index === idx) return prev;
      return { leafId: overData.leafId, index: idx };
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    dragRef.current = null;
    setDragActive(null);
    setHover(null);
    setInsertion(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      const hoverAtDrop = hoverRef.current;
      setDragActive(null);
      setHover(null);
      setInsertion(null);
      if (!drag) return;

      // Priority 1: dropped on another git tab (sortable droppable).
      const overData = asTabData(event.over?.data.current);
      if (overData) {
        if (drag.fromLeafId === overData.leafId) {
          if (drag.tabId !== overData.tabId) panes.reorderTab(overData.leafId, drag.tabId, overData.tabId);
          return;
        }
        const toLeaf = findLeaf(panes.root(), overData.leafId);
        const idx = toLeaf?.tabs.findIndex((ref) => ref.id === overData.tabId) ?? -1;
        panes.moveTabToLeaf(drag.fromLeafId, overData.leafId, drag.tabId, idx === -1 ? undefined : idx);
        return;
      }

      // Priority 2: cursor is inside some leaf — center or edge split.
      if (!hoverAtDrop) return;
      if (hoverAtDrop.zone === 'center') {
        if (hoverAtDrop.leafId === drag.fromLeafId) return;
        panes.moveTabToLeaf(drag.fromLeafId, hoverAtDrop.leafId, drag.tabId);
        return;
      }
      panes.splitLeafWithDrop(hoverAtDrop.leafId, hoverAtDrop.zone, drag.fromLeafId, drag.tabId);
    },
    [panes],
  );

  const draggingTab = dragActive ? tabByKey.get(dragActive.tabId) : undefined;
  const draggingLabel = draggingTab !== undefined ? labelFor(draggingTab) : null;

  const dragIntent = useMemo<GitDragIntent>(
    () => ({
      draggingTabId: dragActive?.tabId ?? null,
      draggingLabel,
      overDropZone: dragActive !== null && hover !== null,
      insertion,
    }),
    [dragActive, draggingLabel, hover, insertion],
  );

  const leaves = allLeaves(root);
  const canUnsplitAll = leaves.length >= 3;
  const parentedLeafIds = useMemo(() => {
    const out = new Set<string>();
    if (root.kind === 'split') for (const leaf of leaves) out.add(leaf.id);
    return out;
  }, [root, leaves]);

  // Single-row law (terminal posture): one pane → its strip rides the
  // panel header; split → every pane's strip row IS its top row.
  const headerLeafId = root.kind === 'leaf' ? root.id : null;
  const titleLeafId = firstLeaf(root).id;
  const cornerLeafId = (() => {
    let node = root;
    while (node.kind === 'split') node = node.orientation === 'horizontal' ? node.b : node.a;
    return node.id;
  })();

  const renderStrip = (leaf: EditorLeaf<PaneTabRef>, corner: boolean): React.ReactNode => {
    const descriptors = leafDescriptors(leaf);
    const closableKeys = (keys: string[]): string[] => keys.filter((key) => key !== GIT_PRIMARY_TAB_KEY);
    return (
      <GitTabStrip
        leafId={leaf.id}
        tabs={descriptors}
        activeKey={leaf.activeTabId}
        focused={focusedLeafId === leaf.id && dockFocused}
        onActivate={(key) => panes.activateTab(leaf.id, key)}
        onClose={(key) => registry.closeTabs([key])}
        onCloseOther={(key) =>
          registry.closeTabs(closableKeys(descriptors.map((tab) => tab.key).filter((other) => other !== key)))
        }
        onCloseAll={() => registry.closeTabs(closableKeys(descriptors.map((tab) => tab.key)))}
        onCloseToLeft={(key) => {
          const index = descriptors.findIndex((tab) => tab.key === key);
          if (index > 0) registry.closeTabs(closableKeys(descriptors.slice(0, index).map((tab) => tab.key)));
        }}
        onCloseToRight={(key) => {
          const index = descriptors.findIndex((tab) => tab.key === key);
          if (index !== -1) registry.closeTabs(closableKeys(descriptors.slice(index + 1).map((tab) => tab.key)));
        }}
        onNew={() => {
          // Focus first so the created tab lands in THIS pane (the
          // registry inserts new tabs into the focused leaf).
          panes.focusLeaf(leaf.id);
          registry.newLogTab();
        }}
        trailing={renderTrailing({ corner })}
        onSplitAndMove={(key, direction) => panes.splitAndMove(leaf.id, key, direction)}
        onMoveToOppositeGroup={(key) => panes.moveToOppositeGroup(leaf.id, key)}
        oppositeDirection={oppositeDirectionOf(root, leaf.id)}
        parentOrientation={parentOrientationOf(root, leaf.id)}
        onChangeSplitterOrientation={() => panes.changeSplitterOrientation(leaf.id)}
        onUnsplit={() => panes.unsplit(leaf.id)}
        onUnsplitAll={() => panes.unsplitAll()}
        canUnsplit={parentedLeafIds.has(leaf.id)}
        canUnsplitAll={canUnsplitAll}
      />
    );
  };

  const renderLeafContent = (leaf: EditorLeaf<PaneTabRef>): React.ReactNode => {
    const tab = leaf.activeTabId !== null ? tabByKey.get(leaf.activeTabId) : undefined;
    if (tab === undefined) return null;
    if (tab.kind === 'console') return <GitConsolePane workspaceId={workspaceId} />;
    if (tab.kind === 'compare') {
      return (
        <GitComparePane
          workspaceId={workspaceId}
          tab={tab}
          patchTab={(patch) => registry.patchCompareTab(gitPanelTabKey(tab), patch)}
        />
      );
    }
    return (
      <GitLogView
        workspaceId={workspaceId}
        tab={tab}
        branch={branch}
        patchTab={(patch) => registry.patchLogTab(gitPanelTabKey(tab), patch)}
        onOpenCompare={(ref) => registry.openCompare(ref)}
      />
    );
  };

  const renderLeaf = (leaf: EditorLeaf<PaneTabRef>): React.ReactNode => {
    const hoverHere = hover?.leafId === leaf.id;
    return (
      <div
        ref={registerLeafRef(leaf.id)}
        data-leaf-id={leaf.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
          background: token.colorBgContainer,
        }}
        onPointerDownCapture={() => panes.focusLeaf(leaf.id)}
      >
        {leaf.id !== headerLeafId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              padding: '0 8px 0 12px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {leaf.id === titleLeafId && (
              <>
                <strong style={{ flexShrink: 0, marginRight: 8 }}>{t('workbench.toolWindows.git')}</strong>
                <span style={{ flexShrink: 0, marginRight: 8 }}>{titleInfo}</span>
              </>
            )}
            {renderStrip(leaf, leaf.id === cornerLeafId)}
          </div>
        )}
        <div
          className="git-leaf-content"
          style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {renderLeafContent(leaf)}
          <LeafDropPreview active={hoverHere} zone={hover?.zone ?? 'center'} />
        </div>
      </div>
    );
  };

  const renderNode = (node: EditorNode<PaneTabRef>): React.ReactNode => {
    if (node.kind === 'leaf') return renderLeaf(node);
    const vertical = node.orientation === 'vertical';
    // Allotment captures orientation at mount and does not react to later
    // changes of its `vertical` prop — keying on orientation forces a
    // clean remount on flip (same trap as the editor tree).
    return (
      <Allotment key={`${node.id}-${node.orientation}`} vertical={vertical} proportionalLayout separator>
        <Allotment.Pane minSize={160}>{renderNode(node.a)}</Allotment.Pane>
        <Allotment.Pane minSize={160}>{renderNode(node.b)}</Allotment.Pane>
      </Allotment>
    );
  };

  // The header strip participates in the same DndContext as every pane
  // strip (it IS the single pane's strip), so tabs drag freely between
  // the header row and any pane a drop creates.
  const headerContent =
    headerLeafId !== null ? (
      <div
        style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
        onPointerDownCapture={() => panes.focusLeaf(headerLeafId)}
      >
        {renderStrip(firstLeaf(root), false)}
      </div>
    ) : null;

  return (
    <GitDragIntentContext.Provider value={dragIntent}>
      <DndContext
        sensors={sensors}
        collisionDetection={gitTabCollision}
        measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {headerContent !== null && renderHeader(headerContent)}
        <div className="rules-bottom-content is-fill" style={{ position: 'relative', background: token.colorBgContainer }}>
          <div
            className="git-split-tree"
            style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minWidth: 0, minHeight: 0 }}
          >
            {renderNode(root)}
          </div>
        </div>
        {/* The moving pill — same preview contract as the editor and
            terminal strips' overlays. */}
        <DragOverlay>
          {draggingLabel !== null ? (
            <div className="rules-drag-preview">
              <span className="rules-drag-preview-label">{draggingLabel}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </GitDragIntentContext.Provider>
  );
};

export default GitGroupRenderer;
