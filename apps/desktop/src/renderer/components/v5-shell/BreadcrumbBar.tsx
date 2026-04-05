/**
 * BreadcrumbBar — shows the hierarchy path of the active item.
 *
 * Example: Acme Team Workspace > Payments API > Authentication > POST login  [Save]
 */

import { RightOutlined } from '@ant-design/icons';
import { Button, theme } from 'antd';

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbBarProps {
  segments: BreadcrumbSegment[];
  isDirty?: boolean;
  onSave?: () => void;
}

export function BreadcrumbBar({ segments, isDirty, onSave }: BreadcrumbBarProps) {
  const { token } = theme.useToken();

  if (segments.length === 0) return null;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <span key={`${seg.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: breadcrumb segments are clickable navigation */}
              <span
                className={`v5-breadcrumb ${isLast ? 'current' : ''}`}
                style={{
                  color: isLast ? token.colorTextSecondary : token.colorTextTertiary,
                  cursor: isLast ? 'default' : 'pointer',
                }}
                onClick={seg.onClick}
                role={seg.onClick ? 'button' : undefined}
                tabIndex={seg.onClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && seg.onClick) seg.onClick();
                }}
              >
                {seg.label}
              </span>
              {!isLast && <RightOutlined style={{ fontSize: 8, color: token.colorTextTertiary, margin: '0 2px' }} />}
            </span>
          );
        })}
      </div>

      {isDirty && onSave && (
        <Button size="small" type="primary" onClick={onSave} style={{ fontSize: 11 }}>
          Save
        </Button>
      )}
    </div>
  );
}
