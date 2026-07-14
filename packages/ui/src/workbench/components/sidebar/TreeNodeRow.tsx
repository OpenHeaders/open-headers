/**
 * TreeNodeRow — generic sidebar tree row component.
 *
 * Mirrors the old desktop shell at sidebar/TreeNodeRow.tsx exactly.
 * Renders any TreeNode uniformly: caret, icon, label (or rename input),
 * badge, hover actions (+ / ... menus), context menu.
 */

import {
  CaretRightOutlined,
  CheckSquareFilled,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExportOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Dropdown, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField } from '@openheaders/ui/shared/awareness';
import type { TreeNode } from './types';

interface TreeNodeRowProps {
  node: TreeNode;
  isSelected: boolean;
  isFocused: boolean;
  isRenaming: boolean;
  isExpanded?: boolean;
  /** True when this node is part of the multi-select export set. */
  isExportSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onStartRename: () => void;
}

function InlineRenameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (n: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return; // prevent double-fire from Enter then blur
    committedRef.current = true;
    const t = text.trim();
    if (t && t !== value) onCommit(t);
    onCancel(); // always exit rename mode after commit
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      className="rules-sidebar-rename-input"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // Only handle the commit / cancel keys; let everything else
        // (arrows, Backspace, Home/End, …) flow natively for normal
        // input editing. We deliberately do NOT call `stopPropagation`
        // here — the workbench keyboard architecture is window-level
        // (`useShellKeyDown` in shell-event-bus). React's
        // `stopPropagation` cascades into `nativeEvent.stopPropagation`
        // which would prevent Cmd+K, Cmd+S, and every other workspace
        // shortcut from reaching the bus while the rename input has
        // focus. The sidebar's tree-nav handler is gated separately
        // by an `isInputElement(target)` check that skips when the
        // event target is THIS input — see Sidebar.tsx `handleKeyDown`.
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') cancel();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function TreeNodeRow({
  node,
  isSelected,
  isFocused,
  isRenaming,
  isExpanded,
  isExportSelected,
  onClick,
  onDoubleClick,
  onStartRename,
}: TreeNodeRowProps) {
  const { token } = theme.useToken();
  const t = useT();

  // Placeholder rendering for empty collections
  if (node.kind === 'placeholder') {
    const paddingLeft = 8 + node.depth * 16;
    return (
      <div
        className="rules-sidebar-placeholder"
        data-item-id={node.id}
        style={{ paddingLeft, color: token.colorTextTertiary }}
      >
        <div style={{ fontWeight: 600, fontSize: 12, color: token.colorTextSecondary, marginBottom: 2 }}>
          {node.placeholderTitle}
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.4, marginBottom: 8 }}>{node.placeholderMessage}</div>
        {node.placeholderActions?.map((action) => (
          <button
            key={action.label}
            type="button"
            className="rules-sidebar-create-btn"
            style={{ color: token.colorText, marginBottom: 4, display: 'flex' }}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
          >
            {action.icon} {action.label}
          </button>
        ))}
      </div>
    );
  }

  const className = [
    'rules-sidebar-item',
    isSelected ? 'selected' : '',
    isFocused ? 'focused' : '',
    isExportSelected ? 'export-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const paddingLeft = 8 + node.depth * 16;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: sidebar tree row — keyboard nav happens at the parent container level
    // biome-ignore lint/a11y/useKeyWithClickEvents: sidebar tree row — keyboard nav happens at the parent container level
    <div
      className={className}
      data-item-id={node.id}
      style={{ color: token.colorText, paddingLeft }}
      onClick={(e) => {
        if (!isRenaming) onClick(e);
      }}
      onDoubleClick={() => {
        if (!isRenaming) onDoubleClick();
      }}
    >
      {/* Caret for expandable nodes */}
      {node.expandable && (
        <CaretRightOutlined
          style={{
            color: token.colorTextTertiary,
            fontSize: 10,
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      )}

      {/* Icon — multi-select check overrides the entity icon when this
          node is part of the active export selection set. */}
      {isExportSelected ? <CheckSquareFilled style={{ color: token.colorPrimary, fontSize: 12 }} /> : node.icon}

      {/* Label or rename input. The rename input is wrapped in
          `<EntityField path="name">` when the node carries an
          `awareness` payload — focusing the input publishes presence
          on the entity's `name` field, so peers see this user's chip
          beside the rule (or other entity) name in their breadcrumb,
          editor headers, and other surfaces consuming the same path. */}
      {isRenaming && node.onRename ? (
        node.awareness ? (
          <EntityField
            entityType={node.awareness.entityType}
            entityId={node.awareness.entityId}
            path="name"
          >
            <InlineRenameInput
              value={node.label}
              onCommit={(name) => node.onRename!(name)}
              onCancel={() => onStartRename()}
            />
          </EntityField>
        ) : (
          <InlineRenameInput
            value={node.label}
            onCommit={(name) => node.onRename!(name)}
            onCancel={() => onStartRename()}
          />
        )
      ) : (
        <>
          <span className="rules-sidebar-item-label">{node.label}</span>

          {/* Badge */}
          {node.badge}

          {/* Hover actions for container nodes (collection / folder):
              `+` opens addMenuItems (create-only), `⋯` opens actionMenuItems
              (modify-only). Falls back to a built Rename/Delete menu when
              no explicit actionMenuItems were provided by the tree builder. */}
          {node.canAddChild && (
            <div className="rules-sidebar-collection-actions">
              {node.addMenuItems && node.addMenuItems.length > 0 && (
                <Dropdown menu={{ items: node.addMenuItems }} trigger={['click']} placement="bottomRight">
                  <PlusOutlined className="rules-sidebar-action-icon" onClick={(e) => e.stopPropagation()} />
                </Dropdown>
              )}
              {node.actionMenuItems && node.actionMenuItems.length > 0 ? (
                <Dropdown menu={{ items: node.actionMenuItems }} trigger={['click']} placement="bottomRight">
                  <EllipsisOutlined className="rules-sidebar-action-icon" onClick={(e) => e.stopPropagation()} />
                </Dropdown>
              ) : node.canRename || node.canDelete ? (
                <Dropdown
                  menu={{
                    items: [
                      ...(node.canRename
                        ? [
                            {
                              key: 'rename',
                              icon: <EditOutlined />,
                              label: t('workbench.sidebar.menu.rename'),
                              onClick: () => onStartRename(),
                            },
                          ]
                        : []),
                      ...(node.canDelete
                        ? [
                            {
                              key: 'delete',
                              icon: <DeleteOutlined />,
                              label: t('workbench.sidebar.menu.delete'),
                              danger: true,
                              onClick: () => node.onDelete?.(),
                            },
                          ]
                        : []),
                    ],
                  }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <EllipsisOutlined className="rules-sidebar-action-icon" onClick={(e) => e.stopPropagation()} />
                </Dropdown>
              ) : null}
            </div>
          )}

          {/* Hover actions for leaf nodes (enable/disable, set active, etc.) */}
          {!node.canAddChild &&
            node.hoverActions?.map((action, i) => (
              <Tooltip key={i} title={action.tooltip} placement="top">
                {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only icon; keyboard path is the row itself */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: hover-only icon; keyboard path is the row itself */}
                <span
                  className="rules-sidebar-item-hover-action"
                  style={action.alwaysVisible ? { opacity: 1 } : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                >
                  {action.icon}
                </span>
              </Tooltip>
            ))}

          {/* Context menu for leaf nodes */}
          {!node.canAddChild && (node.canRename || node.canDelete || node.onExport) && (
            <Dropdown
              menu={{
                items: [
                  ...(node.canRename
                    ? [
                        {
                          key: 'rename',
                          icon: <EditOutlined />,
                          label: t('workbench.sidebar.menu.rename'),
                          onClick: () => onStartRename(),
                        },
                      ]
                    : []),
                  {
                    key: 'duplicate',
                    icon: <CopyOutlined />,
                    label: t('workbench.sidebar.menu.duplicate'),
                    disabled: !node.onDuplicate,
                    onClick: () => node.onDuplicate?.(),
                  },
                  ...(node.onExport
                    ? [
                        {
                          key: 'export',
                          icon: <ExportOutlined />,
                          label: t('workbench.sidebar.menu.export'),
                          onClick: () => node.onExport?.(),
                        },
                      ]
                    : []),
                  { type: 'divider' as const, key: 'div' },
                  ...(node.canDelete
                    ? [
                        {
                          key: 'delete',
                          icon: <DeleteOutlined />,
                          label: t('workbench.sidebar.menu.delete'),
                          danger: true,
                          onClick: () => node.onDelete?.(),
                        },
                      ]
                    : []),
                ],
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <MoreOutlined className="rules-sidebar-item-menu" onClick={(e) => e.stopPropagation()} />
            </Dropdown>
          )}
        </>
      )}
    </div>
  );
}
