import { RightOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface BreadcrumbBarProps {
  /** Optional leading node — rendered before the first segment and followed
   *  by a separator. Callers pass a workspace chip (icon + name) here. */
  leadingNode?: React.ReactNode;
  segments: string[];
  onRename?: (newName: string) => void;
  /** Setting to a unique value auto-enters rename mode; changing the value re-triggers. */
  autoRenameKey?: string | null;
}

const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ leadingNode, segments, onRename, autoRenameKey }) => {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoRenameKey = useRef<string | null>(null);

  useEffect(() => {
    if (autoRenameKey && autoRenameKey !== lastAutoRenameKey.current && onRename && segments.length > 0) {
      lastAutoRenameKey.current = autoRenameKey;
      setEditValue(segments[segments.length - 1]);
      setEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else if (!autoRenameKey && lastAutoRenameKey.current) {
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

  if (segments.length === 0 && !leadingNode) return null;

  const separator = <RightOutlined style={{ fontSize: 7, color: token.colorTextTertiary, margin: '0 4px' }} />;

  return (
    <div className="rules-breadcrumbs">
      {leadingNode && (
        <>
          <span className="rules-breadcrumb" style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
            {leadingNode}
          </span>
          {segments.length > 0 && separator}
        </>
      )}
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={`${seg}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
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
                  padding: '0 4px',
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
              // biome-ignore lint/a11y/noStaticElementInteractions: role="button" provided conditionally when interactive
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
            {!isLast && separator}
          </span>
        );
      })}
    </div>
  );
};

export default BreadcrumbBar;
