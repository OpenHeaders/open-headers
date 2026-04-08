/**
 * TreeNodeRow — generic sidebar tree row component.
 *
 * Renders any TreeNode uniformly: caret, icon, label (or rename input),
 * badge, and hover action buttons. No type-specific branching.
 */

import {
  CaretRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Dropdown, Tooltip, theme } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { TreeNode } from './types';

interface TreeNodeRowProps {
  node: TreeNode;
  isSelected: boolean;
  isFocused: boolean;
  isRenaming: boolean;
  isExpanded?: boolean;
  onClick: () => void;
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
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <input
      ref={inputRef}
      className="v5-sidebar-rename-input"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== value) onCommit(t);
        else onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const t = text.trim();
          if (t && t !== value) onCommit(t);
          else onCancel();
        } else if (e.key === 'Escape') onCancel();
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
  onClick,
  onDoubleClick,
  onStartRename,
}: TreeNodeRowProps) {
  const { token } = theme.useToken();

  // Placeholder rendering for empty collections/folders
  if (node.kind === 'placeholder') {
    const paddingLeft = 8 + node.depth * 16;
    return (
      <div
        className="v5-sidebar-placeholder"
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
            className="v5-sidebar-create-btn"
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

  const className = ['v5-sidebar-item', isSelected ? 'selected' : '', isFocused ? 'focused' : '']
    .filter(Boolean)
    .join(' ');

  const paddingLeft = 8 + node.depth * 16;

  return (
    <div
      className={className}
      data-item-id={node.id}
      style={{ color: token.colorText, paddingLeft }}
      onClick={() => {
        if (!isRenaming) onClick();
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

      {/* Icon */}
      {node.icon}

      {/* Label or rename input */}
      {isRenaming && node.onRename ? (
        <InlineRenameInput
          value={node.label}
          onCommit={(name) => node.onRename!(name)}
          onCancel={() => onStartRename()} // cancel = call with empty to clear renamingId
        />
      ) : (
        <>
          <span className="v5-sidebar-item-label">{node.label}</span>

          {/* Badge (e.g. "off", "active") */}
          {node.badge}

          {/* Hover actions: + dropdown (add item/folder) and ... (rename/delete) for container nodes */}
          {node.canAddChild && (
            <div className="v5-sidebar-collection-actions">
              {node.addMenuItems && node.addMenuItems.length > 0 && (
                <Dropdown
                  menu={{ items: node.addMenuItems.filter((i) => i?.key === 'add-item' || i?.key === 'add-folder') }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <PlusOutlined className="v5-sidebar-action-icon" onClick={(e) => e.stopPropagation()} />
                </Dropdown>
              )}
              {node.addMenuItems && node.addMenuItems.length > 0 ? (
                <Dropdown menu={{ items: node.addMenuItems }} trigger={['click']} placement="bottomRight">
                  <EllipsisOutlined className="v5-sidebar-action-icon" onClick={(e) => e.stopPropagation()} />
                </Dropdown>
              ) : node.canRename || node.canDelete ? (
                <Dropdown
                  menu={{
                    items: [
                      ...(node.canRename
                        ? [{ key: 'rename', icon: <EditOutlined />, label: 'Rename', onClick: () => onStartRename() }]
                        : []),
                      ...(node.canDelete
                        ? [
                            {
                              key: 'delete',
                              icon: <DeleteOutlined />,
                              label: 'Delete',
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
                  <EllipsisOutlined className="v5-sidebar-action-icon" onClick={(e) => e.stopPropagation()} />
                </Dropdown>
              ) : null}
            </div>
          )}

          {/* Hover action for leaf nodes (e.g. activate/deactivate environment) */}
          {!node.canAddChild && node.hoverAction && (
            <Tooltip title={node.hoverAction.tooltip} placement="top">
              <span
                className="v5-sidebar-item-hover-action"
                onClick={(e) => {
                  e.stopPropagation();
                  node.hoverAction!.onClick();
                }}
              >
                {node.hoverAction.icon}
              </span>
            </Tooltip>
          )}

          {/* Context menu for leaf nodes (no + / ...) */}
          {!node.canAddChild && (node.canRename || node.canDelete) && (
            <Dropdown
              menu={{
                items: [
                  ...(node.canRename
                    ? [{ key: 'rename', icon: <EditOutlined />, label: 'Rename', onClick: () => onStartRename() }]
                    : []),
                  { key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicate', disabled: true },
                  { type: 'divider' as const, key: 'div' },
                  ...(node.canDelete
                    ? [
                        {
                          key: 'delete',
                          icon: <DeleteOutlined />,
                          label: 'Delete',
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
              <MoreOutlined className="v5-sidebar-item-menu" onClick={(e) => e.stopPropagation()} />
            </Dropdown>
          )}
        </>
      )}
    </div>
  );
}
