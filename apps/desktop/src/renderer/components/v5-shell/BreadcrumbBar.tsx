/**
 * BreadcrumbBar — shows the hierarchy path of the active item.
 *
 * The last segment (item name) is editable inline: click to edit, Enter/blur to save, Escape to cancel.
 */

import { RightOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import { useEffect, useRef, useState } from 'react';

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbBarProps {
  segments: BreadcrumbSegment[];
  isDirty?: boolean;
  onSave?: () => void;
  /** Override Save button label (e.g. "Save & Activate" when auto-refresh is being enabled). */
  saveLabel?: string | null;
  /** Called when the user renames the last breadcrumb segment (the item name). */
  onRename?: (newName: string) => void;
  /** Set to a unique value (e.g. tab ID) to trigger auto-rename mode. Change the value to re-trigger. */
  autoRenameKey?: string | null;
}

export function BreadcrumbBar({ segments, isDirty, onSave, saveLabel, onRename, autoRenameKey }: BreadcrumbBarProps) {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoRenameKey = useRef<string | null>(null);

  // Auto-enter rename mode when autoRenameKey changes to a new non-null value
  useEffect(() => {
    if (autoRenameKey && autoRenameKey !== lastAutoRenameKey.current && onRename && segments.length > 0) {
      lastAutoRenameKey.current = autoRenameKey;
      const label = segments[segments.length - 1].label;
      setEditValue(label);
      setEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [autoRenameKey, onRename, segments]);

  if (segments.length === 0) return null;

  const startEditing = (label: string) => {
    if (!onRename) return;
    setEditValue(label);
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== segments[segments.length - 1]?.label) {
      onRename?.(trimmed);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  return (
    <div
      className="v5-breadcrumbs"
      style={{
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <span
              key={`${seg.label}-${i}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minWidth: 0 }}
            >
              {isLast && editing ? (
                <input
                  ref={inputRef}
                  className="v5-breadcrumb-edit"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  style={{
                    fontSize: 11,
                    padding: '1px 4px',
                    border: `1px solid ${token.colorPrimary}`,
                    borderRadius: 3,
                    outline: 'none',
                    background: token.colorBgContainer,
                    color: token.colorText,
                    minWidth: 80,
                    maxWidth: 300,
                  }}
                />
              ) : (
                <span
                  className={`v5-breadcrumb ${isLast ? 'current' : ''} ${isLast && onRename ? 'editable' : ''}`}
                  style={{
                    color: isLast ? token.colorTextSecondary : token.colorTextTertiary,
                    cursor: isLast && onRename ? 'text' : seg.onClick ? 'pointer' : 'default',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={isLast && onRename ? () => startEditing(seg.label) : seg.onClick}
                  role={isLast && onRename ? 'button' : seg.onClick ? 'button' : undefined}
                  tabIndex={isLast && onRename ? 0 : seg.onClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (isLast && onRename) startEditing(seg.label);
                      else seg.onClick?.();
                    }
                  }}
                >
                  {seg.label}
                </span>
              )}
              {!isLast && <RightOutlined style={{ fontSize: 8, color: token.colorTextTertiary, margin: '0 2px' }} />}
            </span>
          );
        })}
      </div>

      {onSave && (
        <Tooltip title="Save (⌘S)">
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            onClick={onSave}
            disabled={!isDirty}
            style={{
              fontSize: 11,
              ...(isDirty && saveLabel
                ? { background: '#7c3aed', borderColor: '#7c3aed' }
                : isDirty
                  ? { background: '#f5722d', borderColor: '#f5722d' }
                  : {}),
            }}
          >
            {saveLabel || 'Save'}
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
