/**
 * SwitchBranchModal — the §6.2 uncommitted-changes prompt the wrapped
 * checkout raises when the tree is dirty: Commit and switch (the
 * engine commit lands on the OLD branch first), Stash and switch (the
 * user's own stash stack — `git stash pop` recovers it), Discard
 * changes (danger-confirmed; `checkout --force` + `clean -fd`, the
 * sidecar survives). The choice re-enters the verb as `dirtyAction`;
 * the rail owns the call. Centered on the window, like every dialog of a branch verb.
 */

import { Button, Modal, Popconfirm } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export type SwitchDirtyChoice = 'commit' | 'stash' | 'discard';

export interface SwitchBranchPrompt {
  /** What the verb re-enters with: the branch name, or a full commit sha. */
  target: string;
  /** How the target reads in the prompt — the branch name, or the short sha. */
  branch: string;
  dirtyFiles: number;
}

export interface SwitchBranchModalProps {
  /** The refused switch; null keeps the modal unmounted. */
  prompt: SwitchBranchPrompt | null;
  /** A choice is in flight — every button shows the spinner. */
  busy: boolean;
  onChoose: (choice: SwitchDirtyChoice) => void;
  onClose: () => void;
}

const SwitchBranchModal: React.FC<SwitchBranchModalProps> = ({ prompt, busy, onChoose, onClose }) => {
  const t = useT();
  return (
    <Modal
      open={prompt !== null}
      title={t('workbench.gitLog.switch.dirtyTitle')}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      destroyOnHidden
      data-testid="git-tool-switch-modal"
    >
      <p style={{ fontSize: 12.5, margin: '0 0 14px' }}>
        {prompt !== null
          ? t('workbench.gitLog.switch.dirtyBody', { count: prompt.dirtyFiles, branch: prompt.branch })
          : ''}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Popconfirm
          title={t('workbench.gitLog.switch.discardConfirm.title')}
          description={t('workbench.gitLog.switch.discardConfirm.body')}
          okText={t('workbench.gitLog.switch.discardConfirm.ok')}
          okButtonProps={{ danger: true }}
          onConfirm={() => onChoose('discard')}
        >
          <Button danger size="small" loading={busy} data-testid="git-tool-switch-discard">
            {t('workbench.gitLog.switch.discard')}
          </Button>
        </Popconfirm>
        <Button size="small" loading={busy} onClick={() => onChoose('stash')} data-testid="git-tool-switch-stash">
          {t('workbench.gitLog.switch.stash')}
        </Button>
        <Button
          type="primary"
          size="small"
          loading={busy}
          onClick={() => onChoose('commit')}
          data-testid="git-tool-switch-commit"
        >
          {t('workbench.gitLog.switch.commit')}
        </Button>
      </div>
    </Modal>
  );
};

export default SwitchBranchModal;
