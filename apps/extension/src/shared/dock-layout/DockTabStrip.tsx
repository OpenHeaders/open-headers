/**
 * DockTabStrip — one dock's tab strip + right-click context menu.
 *
 * Shared between workspace and devtools panel. Uses Ant Design
 * Dropdown + Tooltip for menus. Generic over window ID type.
 */

import { CloseOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dropdown, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { useState } from 'react';
import { ALL_DOCK_SLOTS, DOCK_LABELS } from './constants';
import DockSlotIcon from './DockSlotIcon';
import type { DockSlot, ToolWindowDef } from './types';

export interface DockTabStripProps<T extends string> {
  slot: DockSlot;
  windows: T[];
  activeId: T | null;
  orientation: 'vertical' | 'horizontal';
  showLabels: boolean;
  dragging: boolean;
  windowMap: Record<T, ToolWindowDef<T>>;
  isFocused: boolean;
  onActivate: (id: T) => void;
  onHide: (id: T) => void;
  onMove: (id: T, target: DockSlot) => void;
  onCloseDock: () => void;
  onToggleLabels: () => void;
}

interface SortableDockTabProps<T extends string> {
  slot: DockSlot;
  id: T;
  orientation: 'vertical' | 'horizontal';
  active: boolean;
  focused: boolean;
  showLabels: boolean;
  def: ToolWindowDef<T>;
  /** When false, the sortable is disabled as a drop target — prevents
   *  tool-window strips from reacting to non-tool-window drags (e.g. an
   *  editor tab being dragged over the activity bar). */
  sortableEnabled: boolean;
  onActivate: () => void;
  contextMenu: ItemType[];
}

function SortableDockTab<T extends string>({
  slot,
  id,
  orientation,
  active,
  focused,
  showLabels,
  def,
  sortableEnabled,
  onActivate,
  contextMenu,
}: SortableDockTabProps<T>) {
  const { token } = theme.useToken();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `tw:${id}`,
    data: { kind: 'tool-window' as const, toolWindowId: id, fromSlot: slot },
    // Keep the draggable handle live so the user can always initiate a
    // tool-window drag; disable the droppable side so an in-flight
    // editor-tab drag can't reorder tool-window tabs.
    disabled: { draggable: false, droppable: !sortableEnabled },
  });

  const isFocused = active && focused && !isDragging;
  const baseStyle: React.CSSProperties = isDragging
    ? {
        background: token.colorPrimaryBg,
        color: 'transparent',
        outline: `1px dashed ${token.colorPrimary}`,
        outlineOffset: -2,
      }
    : isFocused
      ? {
          background: token.colorPrimaryBg,
          color: token.colorPrimary,
          ...(orientation === 'vertical'
            ? slot.startsWith('left-')
              ? { borderLeft: `2px solid ${token.colorPrimary}` }
              : { borderRight: `2px solid ${token.colorPrimary}` }
            : { borderBottom: `2px solid ${token.colorPrimary}` }),
        }
      : active
        ? { background: token.colorFillTertiary, color: token.colorText }
        : { color: token.colorTextSecondary };

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  };

  const content = (
    <div
      ref={setNodeRef}
      className={`rules-dock-tab rules-dock-tab--${orientation} ${active ? 'active' : ''} ${isFocused ? 'focused' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ ...sortableStyle, ...baseStyle }}
      onClick={() => {
        setTooltipOpen(false);
        onActivate();
      }}
      onKeyDown={handleKey}
      onContextMenu={(e) => {
        e.stopPropagation();
        setTooltipOpen(false);
      }}
      aria-selected={active}
      aria-label={def.label}
      data-tool-window={id}
      {...attributes}
      {...listeners}
      role="tab"
      tabIndex={0}
    >
      <span className="rules-dock-tab-icon">{def.icon}</span>
      {showLabels && <span className="rules-dock-tab-label">{def.label}</span>}
    </div>
  );

  if (isDragging) return content;

  return (
    <Dropdown menu={{ items: contextMenu }} trigger={['contextMenu']} onOpenChange={(o) => o && setTooltipOpen(false)}>
      <Tooltip
        title={def.tooltip ?? def.label}
        open={tooltipOpen}
        onOpenChange={setTooltipOpen}
        placement={orientation === 'vertical' ? (slot.startsWith('left-') ? 'right' : 'left') : 'top'}
      >
        {content}
      </Tooltip>
    </Dropdown>
  );
}

function DockTabStripInner<T extends string>({
  slot,
  windows,
  activeId,
  orientation,
  showLabels,
  dragging,
  windowMap,
  isFocused,
  onActivate,
  onHide,
  onMove,
  onCloseDock,
  onToggleLabels,
}: DockTabStripProps<T>) {
  const { token } = theme.useToken();
  const { setNodeRef: setStripRef, isOver: isStripOver } = useDroppable({
    id: `dock:${slot}`,
    data: { slot },
    disabled: !dragging,
  });

  if (windows.length === 0 && !dragging) return null;

  const buildMenu = (id: T): ItemType[] => {
    const def = windowMap[id];
    const items: ItemType[] = [
      {
        key: 'hide',
        label: 'Hide',
        disabled: def.core,
        onClick: () => onHide(id),
      },
      {
        key: 'move',
        label: 'Move to',
        children: ALL_DOCK_SLOTS.flatMap((target, index) => {
          const entry: ItemType = {
            key: target,
            icon: (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 18,
                }}
              >
                <DockSlotIcon slot={target} size={20} />
              </span>
            ),
            label: (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: '100%',
                  lineHeight: '20px',
                }}
              >
                <span style={{ flex: 1 }}>{DOCK_LABELS[target]}</span>
                {target === slot && (
                  <span style={{ marginLeft: 12, fontSize: 12, opacity: 0.75 }} title="current slot">
                    {'\u2713'}
                  </span>
                )}
              </span>
            ),
            onClick: () => onMove(id, target),
          };
          const needsDividerAfter = index === 1 || index === 3;
          return needsDividerAfter ? [entry, { type: 'divider' as const, key: `move-divider-${index}` }] : [entry];
        }),
      },
      { type: 'divider' },
      {
        key: 'labels',
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, display: 'inline-block' }}>{showLabels ? '\u2713' : ''}</span>
            Show Tool Window Names
          </span>
        ),
        onClick: onToggleLabels,
      },
    ];
    return items;
  };

  const sortableItems = windows.map((id) => `tw:${id}`);
  const sortingStrategy = orientation === 'vertical' ? verticalListSortingStrategy : horizontalListSortingStrategy;

  const stripOverStyle: React.CSSProperties = isStripOver
    ? { background: `${token.colorPrimary}14`, borderRadius: 4 }
    : {};

  return (
    <div
      ref={setStripRef}
      className={`rules-dock-strip rules-dock-strip--${orientation} ${dragging && windows.length === 0 ? 'rules-dock-strip--empty-drop' : ''}`}
      data-dock-slot={slot}
      role="tablist"
      style={stripOverStyle}
    >
      <SortableContext items={sortableItems} strategy={sortingStrategy}>
        <div className="rules-dock-strip-tabs">
          {windows.map((id) => (
            <SortableDockTab
              key={id}
              slot={slot}
              id={id}
              orientation={orientation}
              active={id === activeId}
              focused={isFocused}
              showLabels={showLabels}
              def={windowMap[id]}
              sortableEnabled={dragging}
              onActivate={() => onActivate(id)}
              contextMenu={buildMenu(id)}
            />
          ))}
        </div>
      </SortableContext>
      {orientation === 'horizontal' && activeId !== null && (
        <Tooltip title="Hide this dock">
          <div
            className="rules-dock-strip-close"
            role="button"
            tabIndex={0}
            onClick={onCloseDock}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCloseDock();
            }}
            aria-label="Close dock"
          >
            <CloseOutlined />
          </div>
        </Tooltip>
      )}
    </div>
  );
}

// Wrapper to export as a single component (generic functions can't be
// directly exported as React.FC).
export default DockTabStripInner;
