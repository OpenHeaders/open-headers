/**
 * GitFilterChip — one filter chip of the log toolbar's IDE row:
 * inactive it reads as a grey `Label ⌄` dropdown trigger; active it
 * shows `Label: value ×` with the value emphasized and the × clearing
 * the filter without opening the menu. The dropdown content arrives
 * from the owner (menu or custom panel).
 */

import { CloseOutlined, DownOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type { DropdownProps } from 'antd';
import type React from 'react';

export interface GitFilterChipProps {
  label: string;
  /** Active value rendered after `Label:`; null renders the idle chip. */
  value: string | null;
  onClear?: () => void;
  /** Dropdown wiring — either a menu or a custom popup renderer. */
  menu?: DropdownProps['menu'];
  popupRender?: () => React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testid: string;
}

const GitFilterChip: React.FC<GitFilterChipProps> = ({
  label,
  value,
  onClear,
  menu,
  popupRender,
  open,
  onOpenChange,
  testid,
}) => {
  const { token } = theme.useToken();
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      menu={menu}
      {...(popupRender !== undefined ? { popupRender } : {})}
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
    >
      <button
        type="button"
        className="git-tool-chip"
        data-testid={testid}
        data-active={value !== null}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 6px',
          border: 'none',
          background: 'transparent',
          borderRadius: token.borderRadiusSM,
          cursor: 'pointer',
          fontSize: 12,
          color: token.colorTextSecondary,
          whiteSpace: 'nowrap',
        }}
      >
        {value === null ? (
          <>
            <span>{label}</span>
            <DownOutlined style={{ fontSize: 9 }} />
          </>
        ) : (
          <>
            <span>{label}:</span>
            <span style={{ color: token.colorText, fontWeight: 600 }}>{value}</span>
            {onClear !== undefined && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`${label} ×`}
                data-testid={`${testid}-clear`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onClear();
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <CloseOutlined style={{ fontSize: 9 }} />
              </span>
            )}
          </>
        )}
      </button>
    </Dropdown>
  );
};

export default GitFilterChip;
