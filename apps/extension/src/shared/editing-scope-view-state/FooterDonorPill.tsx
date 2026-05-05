/**
 * FooterDonorPill — surfaces donor status + reset action in the status bar.
 *
 * Always clickable (per design § 11): the popover carries the only
 * escape hatch from a sticky donor record. The pill's lit/dim state
 * advertises which tab will be inherited from when a new tab opens.
 */

import { ReloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { Button, Popover, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import type { EditingScopeViewStateApi } from './types';

interface FooterDonorPillProps<T> {
  perTab: EditingScopeViewStateApi<T>;
}

const TOOLTIP_DONOR = 'Default tab — new tabs inherit layout from here.';
const TOOLTIP_NON_DONOR = 'Another tab is the default donor — new tabs inherit from there.';

export function FooterDonorPill<T>({ perTab }: FooterDonorPillProps<T>): React.ReactElement {
  const { token } = theme.useToken();
  const { isDonor } = perTab;

  const litStyle: React.CSSProperties = {
    background: token.colorPrimaryBg,
    color: token.colorPrimary,
    borderColor: token.colorPrimaryBorder,
  };
  const dimStyle: React.CSSProperties = {
    background: 'transparent',
    color: token.colorTextTertiary,
    borderColor: token.colorBorderSecondary,
  };

  const popoverContent = (
    <div style={{ minWidth: 240, maxWidth: 320 }}>
      <Typography.Paragraph style={{ marginBottom: 8, fontSize: 12 }}>
        {isDonor
          ? 'This tab is the current default. New tabs inherit this layout.'
          : 'Another tab is the current default. New tabs inherit that tab’s layout.'}
      </Typography.Paragraph>
      <Space size={4}>
        <Button size="small" icon={<ReloadOutlined />} onClick={perTab.resetToDefaults}>
          Reset layout to defaults
        </Button>
      </Space>
    </div>
  );

  return (
    <Popover content={popoverContent} placement="topRight" trigger={['click']}>
      <Tooltip title={isDonor ? TOOLTIP_DONOR : TOOLTIP_NON_DONOR} placement="top">
        <span
          className="rules-statusbar-item"
          role="button"
          tabIndex={0}
          aria-label={isDonor ? 'Default tab for new-tab inheritance' : 'Not the default tab for new-tab inheritance'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 6px',
            height: 18,
            border: '1px solid',
            borderRadius: 9,
            cursor: 'pointer',
            fontSize: 10,
            ...(isDonor ? litStyle : dimStyle),
          }}
        >
          <ShareAltOutlined style={{ fontSize: 10 }} />
          <span>{isDonor ? 'Default tab' : 'Inherits layout'}</span>
        </span>
      </Tooltip>
    </Popover>
  );
}

export default FooterDonorPill;
