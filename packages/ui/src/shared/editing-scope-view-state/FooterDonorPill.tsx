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
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import type { EditingScopeViewStateApi } from './types';

interface FooterDonorPillProps<T> {
  perTab: EditingScopeViewStateApi<T>;
}

export function FooterDonorPill<T>({ perTab }: FooterDonorPillProps<T>): React.ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const unit = instanceLabel();
  const units = instanceLabelPlural();
  const { isDonor } = perTab;
  // Suppress the hover tooltip while the click popover is open so the
  // two popups never overlap on the same trigger.
  const [popoverOpen, setPopoverOpen] = useState(false);

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
          ? t('shared.chrome.donor.isDonorBody', { unit, units })
          : t('shared.chrome.donor.nonDonorBody', { unit, units })}
      </Typography.Paragraph>
      <Space size={4}>
        <Button size="small" icon={<ReloadOutlined />} onClick={perTab.resetToDefaults}>
          {t('shared.chrome.donor.reset')}
        </Button>
      </Space>
    </div>
  );

  return (
    <Popover content={popoverContent} placement="topRight" trigger={['click']} onOpenChange={setPopoverOpen}>
      <Tooltip
        title={
          isDonor
            ? t('shared.chrome.donor.defaultTooltip', { unit, units })
            : t('shared.chrome.donor.nonDefaultTooltip', { unit, units })
        }
        placement="top"
        open={popoverOpen ? false : undefined}
      >
        <span
          className="rules-statusbar-item"
          role="button"
          tabIndex={0}
          aria-label={
            isDonor
              ? t('shared.chrome.donor.defaultAria', { unit })
              : t('shared.chrome.donor.nonDefaultAria', { unit })
          }
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
          <span>
            {isDonor ? t('shared.chrome.donor.defaultLabel', { unit }) : t('shared.chrome.donor.inheritsLabel')}
          </span>
        </span>
      </Tooltip>
    </Popover>
  );
}

export default FooterDonorPill;
