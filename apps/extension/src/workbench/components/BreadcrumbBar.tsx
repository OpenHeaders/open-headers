import { RightOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EntityField, useActiveTabEntity } from '@/shared/awareness';

interface BreadcrumbBarProps {
  /** Optional leading node — rendered before the first segment and followed
   *  by a separator. Callers pass a workspace chip (icon + name) here. */
  leadingNode?: React.ReactNode;
  segments: string[];
  onRename?: (newName: string) => void;
  /** Setting to a unique value auto-enters rename mode; changing the value re-triggers. */
  autoRenameKey?: string | null;
  /** Optional trailing node — rendered inline immediately after the last
   *  segment (the entity name) so badges describing the active entity
   *  read as adjacent to its label, not the whole breadcrumb. */
  trailingNode?: React.ReactNode;
}

const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  leadingNode,
  segments,
  onRename,
  autoRenameKey,
  trailingNode,
}) => {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoRenameKey = useRef<string | null>(null);
  // The breadcrumb's last segment IS the active tab's entity name. When
  // the tab maps to a real entity, wrap the renameable last-segment
  // (input + clickable text) with `<EntityField path="name">` so the
  // field-presence chip shows up beside it and focusing the rename
  // input publishes presence to peers. Tabs that don't back a single
  // entity (settings, multi-vars) leave `tabEntity` null — we render
  // the last segment as-is.
  const tabEntity = useActiveTabEntity();

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
        const lastSegmentNode = editing ? (
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
            className={`rules-breadcrumb ${onRename ? 'editable' : ''}`}
            style={{
              color: token.colorTextSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onClick={onRename ? () => startEditing(seg) : undefined}
            role={onRename ? 'button' : undefined}
            tabIndex={onRename ? 0 : undefined}
            onKeyDown={(e) => {
              if (onRename && e.key === 'Enter') startEditing(seg);
            }}
          >
            {seg}
          </span>
        );
        return (
          <span key={`${seg}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
            {isLast ? (
              <>
                {tabEntity ? (
                  <EntityField entityType={tabEntity.entityType} entityId={tabEntity.entityId} path="name">
                    {lastSegmentNode}
                  </EntityField>
                ) : (
                  lastSegmentNode
                )}
                {trailingNode && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>{trailingNode}</span>
                )}
              </>
            ) : (
              <span
                className="rules-breadcrumb"
                style={{
                  color: token.colorTextTertiary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
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
