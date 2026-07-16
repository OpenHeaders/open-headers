/**
 * MigrateAccountPullModal — the extension's migration entry
 * (EXTENSION_ACCOUNT_PULL_PLAN.md Phase D: the funnel redesign).
 *
 * The account pull runs NATIVELY on this host — the background service
 * worker answers the same `oh.migration.postmanPull.*` RPC pair the
 * desktop does — so the inline pull stepper (key → workspace picker →
 * unattended background pull) is the PRIMARY path, open from the first
 * paint. What still needs the desktop app is only the local scan
 * (install detection + tool data files need fs), so the old desktop
 * hand-off demotes to a fallback note below, routed by live connection
 * state.
 *
 * The stepper (and with it the API key) unmounts with the modal —
 * nothing outlives the surface (memory-only key law).
 */

import { CheckCircleFilled } from '@ant-design/icons';
import { App, Button, Divider, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import PostmanPullStepper from './migrate/PostmanPullStepper';
import { PostmanGlyph } from './migrate/vendor-icons';

const { Text, Paragraph } = Typography;

interface MigrateAccountPullModalProps {
  open: boolean;
  onClose: () => void;
  /** Live desktop connection state — the standing backend WebSocket. */
  connected: boolean;
  /** Guided export→drop fallback for local tool data — back to the hub. */
  onOpenImportHub: () => void;
}

const MigrateAccountPullModal: React.FC<MigrateAccountPullModalProps> = ({
  open,
  onClose,
  connected,
  onOpenImportHub,
}) => {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  // Past the key step a workspace selection is in progress — Esc is
  // disabled so a stray key press can't discard it, and the X asks
  // before throwing the selection away.
  const [stepperAdvanced, setStepperAdvanced] = useState(false);

  const handleCancel = useCallback(() => {
    if (!stepperAdvanced) {
      onClose();
      return;
    }
    modal.confirm({
      title: 'Close the import?',
      content: 'Your workspace selection will be discarded. Nothing has been imported yet.',
      okText: 'Discard and close',
      cancelText: 'Keep selecting',
      onOk: onClose,
    });
  }, [stepperAdvanced, modal, onClose]);

  return (
    <Modal
      title="Migrate from another tool"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={640}
      maskClosable={false}
      keyboard={!stepperAdvanced}
      destroyOnHidden
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 12px' }}>
        <PostmanGlyph style={{ fontSize: 18 }} />
        <Text strong>Import from your Postman account</Text>
      </div>
      <PostmanPullStepper onStarted={onClose} onAdvancedChange={setStepperAdvanced} />

      <Divider style={{ margin: '20px 0 12px' }} />

      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
        Have local Insomnia, Thunder Client, or Bruno data? Export it from the tool and drop the file in the{' '}
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12, height: 'auto' }} onClick={onOpenImportHub}>
          import hub
        </Button>
        {' '}— or scan this computer with the Open Headers desktop app.
      </Paragraph>
      {connected ? (
        <Text type="secondary" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess }} />
          Your desktop app is connected — choose “Migrate from another tool” there; progress mirrors here and the
          imported workspaces sync over.
        </Text>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          The scan needs the desktop app; once it runs there, the imported workspaces sync to this browser.
        </Text>
      )}
    </Modal>
  );
};

export default MigrateAccountPullModal;
