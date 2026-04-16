/**
 * InspectorEditorGroupRenderer — recursive renderer for the panel's
 * split editor group tree. Same pattern as workspace's
 * EditorGroupRenderer but with native CSS (no antd).
 *
 * Drop-zone model: while a tab is being dragged we track the cursor
 * via a single pointermove listener, hit-test every leaf's bounding
 * rect, and compute one of five zones: center, left, right, top,
 * bottom. Edge zones show a 50% overlay; center covers the whole leaf.
 * Highlighted in blue, same as the workspace.
 */

import { useDndMonitor } from '@dnd-kit/core';
import { Allotment } from 'allotment';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type DragIntent, DragIntentContext } from '../data/drag-intent';
import { allLeaves, type EditorLeaf, type EditorNode, findLeaf } from '../data/editor-groups';
import type { ClosedTab, InspectorTab } from '../data/inspector-tab';
import type { UseInspectorEditorGroupsApi } from '../data/use-inspector-editor-groups';
import InspectorTabBar from './InspectorTabBar';

// ── Drop zone math ───────────────────────────────────────────────

export type LeafDropZone = 'center' | 'left' | 'right' | 'top' | 'bottom';

interface LeafHover {
  leafId: string;
  zone: LeafDropZone;
}

const EDGE_THRESHOLD = 0.25;
const TOP_EDGE_THRESHOLD = 0.125;

function computeZoneForLeaf(leafEl: HTMLElement, clientX: number, clientY: number): LeafDropZone | null {
  const leafRect = leafEl.getBoundingClientRect();
  if (clientX < leafRect.left || clientX > leafRect.right || clientY < leafRect.top || clientY > leafRect.bottom) {
    return null;
  }

  const tabBar = leafEl.querySelector<HTMLElement>('.dt-editor-tab-bar');
  if (tabBar) {
    const r = tabBar.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) return null;
  }

  const content = leafEl.querySelector<HTMLElement>('.dt-editor-content');
  if (content) {
    const c = content.getBoundingClientRect();
    if (clientX >= c.left && clientX <= c.right && clientY >= c.top && clientY <= c.bottom) {
      const relX = (clientX - c.left) / c.width;
      const relY = (clientY - c.top) / c.height;
      const candidates: Array<{ zone: LeafDropZone; distance: number; threshold: number }> = [
        { zone: 'left', distance: relX, threshold: EDGE_THRESHOLD },
        { zone: 'right', distance: 1 - relX, threshold: EDGE_THRESHOLD },
        { zone: 'top', distance: relY, threshold: TOP_EDGE_THRESHOLD },
        { zone: 'bottom', distance: 1 - relY, threshold: EDGE_THRESHOLD },
      ];
      const hit = candidates.filter((c2) => c2.distance < c2.threshold).sort((a, b) => a.distance - b.distance)[0];
      if (hit) return hit.zone;
    }
  }

  return 'center';
}

function previewStyleFor(zone: LeafDropZone): React.CSSProperties {
  switch (zone) {
    case 'center':
      return { inset: 0 };
    case 'left':
      return { left: 0, top: 0, width: '50%', height: '100%' };
    case 'right':
      return { right: 0, top: 0, width: '50%', height: '100%' };
    case 'top':
      return { left: 0, top: 0, width: '100%', height: '50%' };
    case 'bottom':
      return { left: 0, bottom: 0, width: '100%', height: '50%' };
  }
}

// ── TabPanel with scroll memory ─────────────────────────────────

interface TabPanelProps {
  isActive: boolean;
  children: React.ReactNode;
}

const TabPanel: React.FC<TabPanelProps> = ({ isActive, children }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);

  useLayoutEffect(() => {
    if (!isActive) return;
    const el = panelRef.current;
    if (el) el.scrollTop = scrollTopRef.current;
  }, [isActive]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  }, []);

  return (
    <div
      ref={panelRef}
      className="dt-editor-tab-panel"
      style={isActive ? undefined : { display: 'none' }}
      onScroll={handleScroll}
      aria-hidden={isActive ? undefined : true}
      inert={!isActive}
    >
      {children}
    </div>
  );
};

// ── Drop preview overlay ────────────────────────────────────────

interface LeafDropPreviewProps {
  active: boolean;
  zone: LeafDropZone;
}

const LeafDropPreview: React.FC<LeafDropPreviewProps> = ({ active, zone }) => {
  if (!active) return null;
  return <div aria-hidden="true" className="dt-editor-drop-preview" style={previewStyleFor(zone)} />;
};

// ── Props ────────────────────────────────────────────────────────

export interface RenderLeafContext {
  tab: InspectorTab;
  leafId: string;
  isFocusedLeaf: boolean;
}

export interface InspectorEditorGroupRendererProps {
  groups: UseInspectorEditorGroupsApi;
  renderTabBody: (ctx: RenderLeafContext) => React.ReactNode;
  renderEmpty: () => React.ReactNode;
  onCloseTab: (tabId: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
}

// ── Component ────────────────────────────────────────────────────

export const InspectorEditorGroupRenderer: React.FC<InspectorEditorGroupRendererProps> = ({
  groups,
  renderTabBody,
  renderEmpty,
  onCloseTab,
  onCloseOther,
  onCloseAll,
  onCloseToLeft,
  onCloseToRight,
  recentlyClosed,
}) => {
  const canUnsplitAll = allLeaves(groups.root).length >= 3;

  const leafRefs = useRef(new Map<string, HTMLElement>());
  const registerLeafRef = useCallback((leafId: string) => {
    return (el: HTMLElement | null) => {
      if (el) leafRefs.current.set(leafId, el);
      else leafRefs.current.delete(leafId);
    };
  }, []);

  const [dragActive, setDragActive] = useState<{ fromLeafId: string; tabId: string } | null>(null);
  const dragRef = useRef<{ fromLeafId: string; tabId: string } | null>(null);
  const [hover, setHover] = useState<LeafHover | null>(null);
  const hoverRef = useRef<LeafHover | null>(null);
  hoverRef.current = hover;
  const [insertion, setInsertion] = useState<{ leafId: string; index: number } | null>(null);
  const rootRef = useRef(groups.root);
  rootRef.current = groups.root;

  // Cursor tracking
  useEffect(() => {
    if (!dragActive) {
      setHover(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      let match: LeafHover | null = null;
      for (const [leafId, el] of leafRefs.current) {
        const zone = computeZoneForLeaf(el, e.clientX, e.clientY);
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

  // ── DnD monitor ───────────────────────────────────────────────
  useDndMonitor({
    onDragStart: (event) => {
      const data = event.active.data.current as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
      if (data?.kind !== 'editor-tab') return;
      if (typeof data.leafId !== 'string' || typeof data.tabId !== 'string') return;
      const next = { fromLeafId: data.leafId, tabId: data.tabId };
      dragRef.current = next;
      setDragActive(next);
      setInsertion(null);
    },
    onDragOver: (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const overData = event.over?.data.current as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
      if (overData?.kind !== 'editor-tab') {
        setInsertion((prev) => (prev === null ? prev : null));
        return;
      }
      if (typeof overData.leafId !== 'string' || typeof overData.tabId !== 'string') return;
      if (overData.leafId === drag.fromLeafId) {
        setInsertion((prev) => (prev === null ? prev : null));
        return;
      }
      const toLeaf = findLeaf(rootRef.current, overData.leafId);
      const idx = toLeaf?.tabs.findIndex((t) => t.id === overData.tabId) ?? -1;
      if (idx < 0) return;
      setInsertion((prev) => {
        if (prev && prev.leafId === overData.leafId && prev.index === idx) return prev;
        return { leafId: overData.leafId as string, index: idx };
      });
    },
    onDragCancel: () => {
      dragRef.current = null;
      setDragActive(null);
      setHover(null);
      setInsertion(null);
    },
    onDragEnd: (event) => {
      const drag = dragRef.current;
      dragRef.current = null;
      const hoverAtDrop = hoverRef.current;
      setDragActive(null);
      setHover(null);
      setInsertion(null);
      if (!drag) return;

      const over = event.over;
      const overData = over?.data.current as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
      if (
        overData?.kind === 'editor-tab' &&
        typeof overData.leafId === 'string' &&
        typeof overData.tabId === 'string'
      ) {
        const toLeafId = overData.leafId;
        const toTabId = overData.tabId;
        if (drag.fromLeafId === toLeafId) {
          if (drag.tabId !== toTabId) groups.reorderTab(drag.tabId, toTabId);
          return;
        }
        const toLeaf = findLeaf(groups.root, toLeafId);
        const idx = toLeaf?.tabs.findIndex((t) => t.id === toTabId) ?? -1;
        groups.moveTabToLeaf(drag.fromLeafId, toLeafId, drag.tabId, idx === -1 ? undefined : idx);
        return;
      }

      if (!hoverAtDrop) return;
      if (hoverAtDrop.zone === 'center') {
        if (hoverAtDrop.leafId === drag.fromLeafId) return;
        groups.moveTabToLeaf(drag.fromLeafId, hoverAtDrop.leafId, drag.tabId);
        return;
      }
      groups.splitLeafWithDrop(hoverAtDrop.leafId, hoverAtDrop.zone, drag.fromLeafId, drag.tabId);
    },
  });

  const handleLeafPointerDown = useCallback(
    (leafId: string) => {
      groups.focusLeaf(leafId);
    },
    [groups],
  );

  const parentedLeafIds = useMemo(() => collectLeavesWithParent(groups.root), [groups.root]);

  const draggingTab = useMemo<InspectorTab | null>(() => {
    if (!dragActive) return null;
    return groups.allTabs.find((t) => t.id === dragActive.tabId) ?? null;
  }, [dragActive, groups.allTabs]);

  const dragIntent = useMemo<DragIntent>(
    () => ({
      draggingTabId: dragActive?.tabId ?? null,
      draggingTab,
      overDropZone: dragActive !== null && hover !== null,
      insertion,
    }),
    [dragActive, draggingTab, hover, insertion],
  );

  const renderLeaf = (leaf: EditorLeaf): React.ReactNode => {
    const isFocused = groups.focusedLeafId === leaf.id;
    const canUnsplit = parentedLeafIds.has(leaf.id);
    const hoverHere = hover?.leafId === leaf.id;

    return (
      <div
        ref={registerLeafRef(leaf.id)}
        className={`dt-editor-leaf${isFocused ? ' focused' : ''}`}
        data-leaf-id={leaf.id}
        onPointerDownCapture={() => handleLeafPointerDown(leaf.id)}
      >
        <InspectorTabBar
          leafId={leaf.id}
          isFocusedLeaf={isFocused}
          tabs={leaf.tabs}
          activeTabId={leaf.activeTabId}
          onSwitch={groups.switchTab}
          onClose={onCloseTab}
          onCloseOther={onCloseOther}
          onCloseAll={onCloseAll}
          onCloseToLeft={onCloseToLeft}
          onCloseToRight={onCloseToRight}
          recentlyClosed={recentlyClosed}
          onReopenTab={groups.reopenTab}
          onSplitAndMoveRight={(tabId) => groups.splitAndMoveRight(leaf.id, tabId)}
          onSplitAndMoveLeft={(tabId) => groups.splitAndMoveLeft(leaf.id, tabId)}
          onSplitAndMoveDown={(tabId) => groups.splitAndMoveDown(leaf.id, tabId)}
          onSplitAndMoveUp={(tabId) => groups.splitAndMoveUp(leaf.id, tabId)}
          onMoveToOppositeGroup={(tabId) => groups.moveToOppositeGroup(leaf.id, tabId)}
          onChangeSplitterOrientation={() => groups.changeSplitterOrientation(leaf.id)}
          onUnsplit={() => groups.unsplit(leaf.id)}
          onUnsplitAll={groups.unsplitAll}
          canUnsplit={canUnsplit}
          canUnsplitAll={canUnsplitAll}
        />
        <div className="dt-editor-leaf-body">
          <div className="dt-editor-content">
            {leaf.tabs.length === 0 && renderEmpty()}
            {leaf.tabs.map((tab) => (
              <TabPanel key={tab.id} isActive={tab.id === leaf.activeTabId}>
                {renderTabBody({ tab, leafId: leaf.id, isFocusedLeaf: isFocused })}
              </TabPanel>
            ))}
          </div>
          <LeafDropPreview active={hoverHere} zone={hover?.zone ?? 'center'} />
        </div>
      </div>
    );
  };

  const renderNode = (node: EditorNode): React.ReactNode => {
    if (node.kind === 'leaf') return renderLeaf(node);
    const vertical = node.orientation === 'vertical';
    return (
      <Allotment key={`${node.id}-${node.orientation}`} vertical={vertical} proportionalLayout>
        <Allotment.Pane minSize={160}>{renderNode(node.a)}</Allotment.Pane>
        <Allotment.Pane minSize={160}>{renderNode(node.b)}</Allotment.Pane>
      </Allotment>
    );
  };

  return (
    <DragIntentContext.Provider value={dragIntent}>
      <div className="dt-editor-tree">{renderNode(groups.root)}</div>
    </DragIntentContext.Provider>
  );
};

// ── Helpers ──────────────────────────────────────────────────────

function collectLeavesWithParent(root: EditorNode): Set<string> {
  const out = new Set<string>();
  const walk = (node: EditorNode, parented: boolean) => {
    if (node.kind === 'leaf') {
      if (parented) out.add(node.id);
      return;
    }
    walk(node.a, true);
    walk(node.b, true);
  };
  walk(root, false);
  return out;
}

export default InspectorEditorGroupRenderer;
