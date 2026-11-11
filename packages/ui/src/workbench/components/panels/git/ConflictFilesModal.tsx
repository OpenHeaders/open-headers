/**
 * ConflictFilesModal — the step before the conflict editor. A pass (a
 * Pull, a branch Merge, a Cherry-Pick, a Revert) found files both sides
 * changed and has written nothing; the dialog names them under the
 * pass's own title and offers the editor — Merge… — or Cancel, which
 * leaves the branch and the tree as they were. The editor is the only
 * place an answer is made.
 */

import { Modal } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import PassFileList from './PassFileList';

export interface ConflictFilesPrompt {
  /** The pass's title — the editor opens under the same one. */
  title: string;
  /** The files both sides changed, at the branch's paths. */
  files: readonly string[];
}

export interface ConflictFilesModalProps {
  /** The refused pass; null keeps the modal unmounted. */
  prompt: ConflictFilesPrompt | null;
  /** The element the modal centers over. Null falls back to the document body. */
  container: HTMLElement | null;
  /** The person's word for the editor. */
  onMerge: () => void;
  onCancel: () => void;
}

const ConflictFilesModal: React.FC<ConflictFilesModalProps> = ({ prompt, container, onMerge, onCancel }) => {
  const t = useT();
  return (
    <Modal
      open={prompt !== null}
      title={prompt?.title ?? ''}
      okText={t('workbench.commitTool.menu.merge')}
      cancelText={t('workbench.gitLog.createBranch.cancel')}
      onOk={onMerge}
      onCancel={onCancel}
      width={520}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }} data-testid="git-tool-conflict-files">
        <span style={{ fontSize: 12.5 }}>{t('workbench.gitLog.resolve.filesBody')}</span>
        <PassFileList files={prompt?.files ?? []} testId="git-tool-conflict-files-list" />
      </div>
    </Modal>
  );
};

export default ConflictFilesModal;
