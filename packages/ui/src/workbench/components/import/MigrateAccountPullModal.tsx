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
import { useT } from '@openheaders/ui/context/LocaleContext';
import PostmanPullStepper, { type PostmanPullStepperPhase } from './migrate/PostmanPullStepper';
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
  const t = useT();
  // Past the key step live work is on the line — the enumeration RPC
  // while listing, the workspace selection once the picker is up. Esc
  // is disabled so a stray key press can't discard either, and the X
  // asks before throwing them away, with copy matched to the phase.
  const [stepperPhase, setStepperPhase] = useState<PostmanPullStepperPhase>('key');

  const handleCancel = useCallback(() => {
    if (stepperPhase === 'key') {
      onClose();
      return;
    }
    // The safe choice ("Keep waiting" / "Keep selecting") is the primary
    // OK on the right; the destructive discard rides the red cancel slot
    // on the left. Esc is off so it can't fire the discard side unnoticed.
    modal.confirm({
      title: t('workbench.importExport.migrate.closeConfirmTitle'),
      ...(stepperPhase === 'listing'
        ? {
            content: t('workbench.importExport.migrate.closeListingContent'),
            okText: t('workbench.importExport.migrate.closeListingOk'),
          }
        : {
            content: t('workbench.importExport.migrate.closeSelectingContent'),
            okText: t('workbench.importExport.migrate.closeSelectingOk'),
          }),
      cancelText:
        stepperPhase === 'listing'
          ? t('workbench.importExport.migrate.closeAnyway')
          : t('workbench.importExport.migrate.discardAndClose'),
      cancelButtonProps: { danger: true },
      keyboard: false,
      onCancel: onClose,
    });
  }, [stepperPhase, modal, onClose, t]);

  return (
    <Modal
      title={t('workbench.importExport.migrate.title')}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={880}
      maskClosable={false}
      keyboard={stepperPhase === 'key'}
      destroyOnHidden
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '12px 0 12px' }}>
        <PostmanGlyph style={{ fontSize: 18 }} />
        <Text strong>{t('workbench.importExport.migrate.fromAccount')}</Text>
      </div>
      <PostmanPullStepper onStarted={onClose} onPhaseChange={setStepperPhase} />

      <Divider style={{ margin: '20px 0 12px' }} />

      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
        {t('workbench.importExport.migrate.localDataPrefix')}{' '}
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12, height: 'auto' }} onClick={onOpenImportHub}>
          {t('workbench.importExport.migrate.importHub')}
        </Button>{' '}
        {t('workbench.importExport.migrate.localDataSuffix')}
      </Paragraph>
      {connected ? (
        <Text type="secondary" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess }} />
          {t('workbench.importExport.migrate.desktopConnected')}
        </Text>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.importExport.migrate.desktopNeeded')}
        </Text>
      )}
    </Modal>
  );
};

export default MigrateAccountPullModal;
