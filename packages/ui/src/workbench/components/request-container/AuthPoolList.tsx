/**
 * The pool's left panel: "Auth types" with the header control (the
 * `+` type dropdown, or a folder's Change), one row per entry — its
 * label (the name, else the type's label), the Default tag, and on an
 * editable pool the ⋯ menu (Make default · Rename · Delete) with the
 * rename running inline in the row. An inherited pool lists the same
 * rows read-only.
 */

import { EllipsisOutlined } from '@ant-design/icons';
import type { AuthPoolEntry } from '@openheaders/core/types';
import { Button, Dropdown, Input, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { authTypeLabelKey } from '../request-editor/inherited-auth';

const { Text } = Typography;

export interface AuthPoolListProps {
  entries: readonly AuthPoolEntry[];
  defaultUid: string | undefined;
  selectedUid: string | undefined;
  onSelect: (uid: string) => void;
  /** The header's control beside the title — `+` or Change. */
  headerAction: React.ReactNode;
  /** Absent = read-only rows (an inherited pool). */
  actions?: {
    onSetDefault: (uid: string) => void;
    onRename: (uid: string, name: string) => void;
    onDelete: (uid: string) => void;
  };
}

const AuthPoolList: React.FC<AuthPoolListProps> = ({
  entries,
  defaultUid,
  selectedUid,
  onSelect,
  headerAction,
  actions,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [renaming, setRenaming] = useState<{ uid: string; value: string } | null>(null);

  const commitRename = () => {
    if (renaming === null) return;
    actions?.onRename(renaming.uid, renaming.value.trim());
    setRenaming(null);
  };

  return (
    <div data-testid="oh-auth-pool-list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 14, flex: 1 }}>
          {t('workbench.editors.requestContainer.auth.authTypes')}
        </Text>
        {headerAction}
      </div>
      {entries.map((entry) => {
        const isSelected = entry.uid === selectedUid;
        const label = entry.name !== '' ? entry.name : t(authTypeLabelKey(entry.config.type));
        const isRenaming = renaming?.uid === entry.uid;
        return (
          <div
            key={entry.uid}
            role="button"
            tabIndex={0}
            className="oh-auth-pool-row"
            data-testid="oh-auth-pool-entry"
            data-uid={entry.uid}
            aria-pressed={isSelected}
            onClick={() => onSelect(entry.uid)}
            onKeyDown={(e) => {
              if (isRenaming) return;
              if (e.key === 'Enter' || e.key === ' ') onSelect(entry.uid);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 32,
              padding: '0 8px',
              borderRadius: token.borderRadiusSM,
              background: isSelected ? token.colorFillTertiary : 'transparent',
              cursor: 'pointer',
            }}
          >
            {isRenaming ? (
              <Input
                size="small"
                autoFocus
                value={renaming.value}
                data-testid="oh-auth-pool-rename"
                placeholder={t(authTypeLabelKey(entry.config.type))}
                onChange={(e) => setRenaming({ uid: entry.uid, value: e.target.value })}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ flex: 1 }}
              />
            ) : (
              <Text
                style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                ellipsis
              >
                {label}
              </Text>
            )}
            {entry.uid === defaultUid && !isRenaming && (
              <Tag style={{ marginInlineEnd: 0 }} data-testid="oh-auth-pool-default-tag">
                {t('workbench.editors.requestContainer.auth.defaultTag')}
              </Tag>
            )}
            {actions !== undefined && !isRenaming && (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'default',
                      label: t('workbench.editors.requestContainer.auth.setDefault'),
                      disabled: entry.uid === defaultUid,
                      onClick: () => actions.onSetDefault(entry.uid),
                    },
                    { type: 'divider' },
                    {
                      key: 'rename',
                      label: t('workbench.editors.requestContainer.auth.rename'),
                      onClick: () => setRenaming({ uid: entry.uid, value: entry.name }),
                    },
                    {
                      key: 'delete',
                      label: t('workbench.editors.requestContainer.auth.deleteEntry'),
                      danger: true,
                      onClick: () => actions.onDelete(entry.uid),
                    },
                  ],
                }}
              >
                <Button
                  size="small"
                  type="text"
                  className="oh-auth-pool-row-actions"
                  icon={<EllipsisOutlined />}
                  aria-label={t('workbench.editors.requestContainer.auth.entryActionsAria')}
                  data-testid="oh-auth-pool-entry-actions"
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AuthPoolList;
