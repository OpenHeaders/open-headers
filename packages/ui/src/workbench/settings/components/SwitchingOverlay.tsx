/**
 * Connecting overlay — the dwell shown while a back-end enable commits.
 *
 * Enabling a back-end is a clean, non-destructive act: the wire is
 * verified first, then the record enables and the target's workspaces
 * sync down. There's no decision for the user to make, so instead of a
 * dialog we show a brief, non-closable "Connecting to <X>…" panel. The
 * hook holds it open for a minimum beat (so an instant commit doesn't
 * flash) and dismisses it on a success toast.
 *
 * Pure presentational — the caller (`useBackendEnableSwitch`) owns the
 * open flag and the minimum dwell.
 */

import { Modal, Skeleton, Spin, Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface SwitchingOverlayProps {
  open: boolean;
  /** Display label for the target back-end (e.g. "Work VM"). */
  toLabel: string;
}

const SwitchingOverlay: React.FC<SwitchingOverlayProps> = ({ open, toLabel }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <Modal
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      centered
      width={420}
      styles={{ body: { padding: '28px 24px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Spin size="large" />
        <Typography.Text style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>
          {t('workbench.settings.backendPane.enable.connectingTo', { label: toLabel })}
        </Typography.Text>
        <div style={{ width: '100%' }}>
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        </div>
      </div>
    </Modal>
  );
};

export default SwitchingOverlay;
