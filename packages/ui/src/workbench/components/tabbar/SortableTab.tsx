/**
 * SortableTab — one interactive tab pill in the strip: a dnd-kit
 * sortable wrapping TabPillContent, plus the right-click context menu
 * (Dropdown) and breadcrumb-path hover tooltip. Publishes its drag data
 * as `{ kind: 'editor-tab', leafId, tabId }` so the shell's shared
 * DndContext can route it, and prefixes its sortable id with the leaf id
 * so multiple strips coexist without collisions.
 */

import { FolderOpenOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dropdown, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { useState } from 'react';
import { scratchLabelForMode } from '../../breadcrumbs';
import { useDragIntent } from '../../drag-intent';
import type { WorkbenchTab } from '../../types';
import type { EditorTabDragData } from './TabBar';
import TabPillContent from './TabPillContent';
import { type TabEntityLookups, emptyPlaceholderStyle, tabIcon } from './tab-format';

interface SortableTabProps extends TabEntityLookups {
  leafId: string;
  isFocusedLeaf: boolean;
  tab: WorkbenchTab;
  displayLabel: string;
  isActive: boolean;
  tabPath?: string[];
  contextMenu: { items: ItemType[] };
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({
  leafId,
  isFocusedLeaf,
  tab,
  displayLabel,
  isActive,
  rules,
  templates,
  requests,
  pausedUids,
  unresolvableRuleUids,
  unresolvableRequestUids,
  liveWorkflows,
  unresolvableWorkflowUids,
  tabPath,
  contextMenu,
  onSwitch,
  onClose,
  onDoubleClick,
}) => {
  const { token } = theme.useToken();
  const dragIntent = useDragIntent();
  const data: EditorTabDragData = { kind: 'editor-tab', leafId, tabId: tab.id };
  // Sortable ids must be unique across ALL SortableContexts that share a
  // parent DndContext. Prefixing with the leaf id lets the shell host
  // multiple tab strips side-by-side without collisions.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${leafId}::${tab.id}`,
    data,
  });

  // Hide the dragged tab's source placeholder whenever the drop intent
  // has moved somewhere OTHER than this tab bar:
  //   - over a leaf-drop zone (center/edge split preview)
  //   - over a tab in a DIFFERENT leaf (cross-leaf insert)
  // In both cases the destination leaf already shows its own preview
  // (overlay or insertion marker), and keeping the source placeholder
  // visible would make the tab appear in two places at once.
  //
  // Visibility: hidden keeps the slot in layout so dnd-kit's rect
  // tracking stays in sync — the placeholder snaps back the instant
  // the cursor returns to this tab bar, no sortable resync needed.
  const isOverForeignLeaf = dragIntent.insertion !== null && dragIntent.insertion.leafId !== leafId;
  const hidePlaceholder =
    isDragging && dragIntent.draggingTabId === tab.id && (dragIntent.overDropZone || isOverForeignLeaf);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(hidePlaceholder ? { visibility: 'hidden' as const } : null),
  };

  // Active tabs render as a tinted rounded pill; inactive sit flat on
  // the bar and gain a neutral grey pill on hover (CSS). Focused-leaf
  // active tabs use the primary tint so you can tell which editor
  // group owns focus at a glance; unfocused active tabs use a neutral
  // fill so two splits don't fight for attention.
  const visualStyle: React.CSSProperties = isDragging
    ? emptyPlaceholderStyle(token)
    : isActive && isFocusedLeaf
      ? { color: token.colorPrimary, background: token.colorPrimaryBg }
      : isActive
        ? { color: token.colorText, background: token.colorFillSecondary }
        : { color: token.colorTextSecondary };

  const content = (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`rules-tab${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}`}
      data-tab-id={tab.id}
      style={{ ...sortableStyle, ...visualStyle }}
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      onClick={() => onSwitch(tab.id)}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(tab.id) : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSwitch(tab.id);
      }}
    >
      <TabPillContent
        tab={tab}
        displayLabel={displayLabel}
        rules={rules}
        templates={templates}
        requests={requests}
        pausedUids={pausedUids}
        unresolvableRuleUids={unresolvableRuleUids}
        unresolvableRequestUids={unresolvableRequestUids}
        liveWorkflows={liveWorkflows}
        unresolvableWorkflowUids={unresolvableWorkflowUids}
        onClose={onClose}
        closeIconColor={token.colorTextTertiary}
        hidden={isDragging}
      />
    </div>
  );

  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // While dragging, skip Tooltip/Dropdown wrappers so they don't
  // interfere with dnd-kit's overlay portal.
  if (isDragging) return content;

  // Hover tooltip shows the tab's breadcrumb path (workspace excluded).
  // Root segment stays plain text; folders carry a neutral folder glyph;
  // entity segments mirror the tab's own icon so type is always readable.
  // Scratch tabs (create modes before first save — the entity doesn't
  // exist in storage yet) inject a grey "Scratch" segment between root
  // and entity. "Scratch" is chosen over "Draft" because persisted
  // entities can also carry a draft state and the two would collide.
  type TooltipSegmentKind = 'root' | 'folder' | 'scratch' | 'entity';
  const scratchLabel = scratchLabelForMode(tab.mode);
  const tooltipSegments: { label: string; kind: TooltipSegmentKind }[] = [];
  if (tabPath && tabPath.length > 0) {
    tooltipSegments.push({ label: tabPath[0], kind: 'root' });
    for (let i = 1; i < tabPath.length - 1; i++) {
      tooltipSegments.push({ label: tabPath[i], kind: 'folder' });
    }
    if (tabPath.length >= 2) {
      if (scratchLabel) tooltipSegments.push({ label: scratchLabel, kind: 'scratch' });
      tooltipSegments.push({ label: tabPath[tabPath.length - 1], kind: 'entity' });
    }
  }
  const tooltipTitle =
    tooltipSegments.length > 0 ? (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.4 }}>
        {tooltipSegments.map((s, i) => {
          const icon =
            s.kind === 'folder' ? (
              <FolderOpenOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
            ) : s.kind === 'entity' ? (
              tabIcon(
                tab,
                rules,
                templates,
                pausedUids,
                requests,
                unresolvableRequestUids,
                unresolvableRuleUids,
                liveWorkflows,
                unresolvableWorkflowUids,
                { compact: true },
              )
            ) : null;
          const color = s.kind === 'scratch' ? token.colorTextTertiary : token.colorText;
          // Each segment groups with its leading chevron into a single
          // nowrap inline-flex so wrap never breaks between a chevron
          // and the label it precedes — breaks only happen between
          // whole segments.
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: path segments are inherently positional
            <span
              key={`${s.label}-${i}`}
              style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', color }}
            >
              {i > 0 && <span style={{ color: token.colorTextTertiary, margin: '0 5px' }}>{'›'}</span>}
              {icon && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 4 }}>{icon}</span>}
              <span>{s.label}</span>
            </span>
          );
        })}
      </span>
    ) : (
      displayLabel
    );

  return (
    <Dropdown menu={contextMenu} trigger={['contextMenu']} onOpenChange={setContextMenuOpen}>
      <Tooltip
        title={tooltipTitle}
        color={token.colorBgElevated}
        overlayClassName="rules-tab-path-tooltip"
        overlayInnerStyle={{
          color: token.colorText,
          fontSize: 11,
          padding: '3px 8px',
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
        }}
        placement="bottomLeft"
        // Offset the tooltip 6 px further from the tab so it clears
        // the bar's bottom scrollbar gutter on hover. Without the
        // offset the tooltip's top edge would sit right next to the
        // hover-revealed scrollbar thumb, reading as visual clutter.
        align={{ offset: [0, 6] }}
        arrow={false}
        mouseEnterDelay={0.5}
        mouseLeaveDelay={0}
        destroyTooltipOnHide
        open={contextMenuOpen ? false : undefined}
      >
        {content}
      </Tooltip>
    </Dropdown>
  );
};

export default SortableTab;
