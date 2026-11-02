/**
 * PushRejectedModal — the non-fast-forward refusal as the reference's
 * prompt: the current branch was rejected because the remote moved,
 * and the remote changes have to come in first. Merge runs the
 * surface's pull (the Phase 4 merge, never raw `git merge`) and the
 * surface pushes again once it lands; Cancel keeps the commits local.
 * Rebase is not offered — it rewrites local history, which the engine
 * never does. Window-centered like the Push window it follows.
 */

import { ExclamationCircleFilled } from '@ant-design/icons';
import { Button, Modal, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface PushRejectedModalProps {
  open: boolean;
  /** The branch whose push was refused. */
  branch: string;
  onCancel: () => void;
  /** Pull, then push again — the host owns the two verbs. */
  onMerge: () => void;
}

const PushRejectedModal: React.FC<PushRejectedModalProps> = ({ open, branch, onCancel, onMerge }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <Modal
      open={open}
      title={null}
      closable={false}
      onCancel={onCancel}
      width={520}
      centered
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel} data-testid="git-push-rejected-cancel">
            {t('workbench.gitPush.cancel')}
          </Button>
          <Button type="primary" onClick={onMerge} data-testid="git-push-rejected-merge">
            {t('workbench.gitPush.rejected.merge')}
          </Button>
        </div>
      }
      data-testid="git-push-rejected"
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '4px 0' }}>
        <ExclamationCircleFilled style={{ fontSize: 22, color: token.colorWarning, flexShrink: 0, marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>
            {t('workbench.gitPush.rejected.title')}
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: token.colorTextSecondary }} data-testid="git-push-rejected-body">
            {t('workbench.gitPush.rejected.body', { branch })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PushRejectedModal;
