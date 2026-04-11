/**
 * BreadcrumbBar — shows path segments and a Save button when dirty.
 *
 * Mirrors the desktop V5Shell BreadcrumbBar (simplified for extension).
 * The last segment supports inline editing for renaming.
 */

import { FileTextOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { shortcutLabel } from '../hooks/useWorkspaceShortcuts';

interface BreadcrumbBarProps {
  segments: string[];
  isDirty?: boolean;
  onSave?: () => void;
  onSaveAsTemplate?: () => void;
  onRename?: (newName: string) => void;
  /** Set to a unique value (e.g. tab ID) to auto-enter rename mode. Change the value to re-trigger. */
  autoRenameKey?: string | null;
}

const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  segments,
  isDirty,
  onSave,
  onSaveAsTemplate,
  onRename,
  autoRenameKey,
}) => {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoRenameKey = useRef<string | null>(null);

  // Auto-enter rename mode when autoRenameKey changes to a new non-null value
  useEffect(() => {
    if (autoRenameKey && autoRenameKey !== lastAutoRenameKey.current && onRename && segments.length > 0) {
      lastAutoRenameKey.current = autoRenameKey;
      const label = segments[segments.length - 1];
      setEditValue(label);
      setEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else if (!autoRenameKey && lastAutoRenameKey.current) {
      // Tab switched or rename cleared — exit editing mode
      lastAutoRenameKey.current = null;
      setEditing(false);
    }
  }, [autoRenameKey, onRename, segments]);

  const startEditing = useCallback(
    (label: string) => {
      if (!onRename) return;
      setEditValue(label);
      setEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    },
    [onRename],
  );

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== segments[segments.length - 1]) {
      onRename?.(trimmed);
    }
  }, [editValue, segments, onRename]);

  if (segments.length === 0) return null;

  return (
    <div
      className="rules-breadcrumbs"
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
            <span key={`${seg}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              {isLast && editing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditing(false);
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
                  className={`rules-breadcrumb ${isLast && onRename ? 'editable' : ''}`}
                  style={{
                    color: isLast ? token.colorTextSecondary : token.colorTextTertiary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={isLast && onRename ? () => startEditing(seg) : undefined}
                  role={isLast && onRename ? 'button' : undefined}
                  tabIndex={isLast && onRename ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isLast && onRename && e.key === 'Enter') startEditing(seg);
                  }}
                >
                  {seg}
                </span>
              )}
              {!isLast && <RightOutlined style={{ fontSize: 8, color: token.colorTextTertiary, margin: '0 2px' }} />}
            </span>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onSaveAsTemplate && (
          <Tooltip title="Save as Template">
            <Button size="small" icon={<FileTextOutlined />} onClick={onSaveAsTemplate} style={{ fontSize: 11 }}>
              Save as Template
            </Button>
          </Tooltip>
        )}
        {onSave && (
          <Tooltip title={`Save (${shortcutLabel('save')})`}>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              onClick={onSave}
              disabled={!isDirty}
              style={{
                fontSize: 11,
                ...(isDirty ? { background: '#f5722d', borderColor: '#f5722d' } : {}),
              }}
            >
              Save
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default BreadcrumbBar;
