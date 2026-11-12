/**
 * LocalChangesFirstModal — the question a pass raises when it is about
 * to write a file that holds uncommitted work (a Cherry-Pick, a Revert,
 * a Pull, a branch Merge): that work has to be committed first, or it
 * would ride into the pass's own commit. The dialog names the files —
 * by what they belong to, as the workbench lists it (`PassFileTree`) —
 * and offers the commit under the pending draft — the person's to edit
 * — or Cancel, which leaves the branch and the tree as they were. Work
 * in any other file is not part of the question: the pass never
 * commits it.
 */

import { Input, Modal } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { shortSha } from './commit-apply';
import PassFileTree from './PassFileTree';

/** What is about to write the files. */
export type LocalChangesOperation =
  | { kind: 'pick' | 'revert'; sha: string }
  | { kind: 'pull' }
  | { kind: 'merge'; ref: string };

export interface LocalChangesFirstPrompt {
  operation: LocalChangesOperation;
  /** The files the pass would write that hold uncommitted work. */
  files: readonly string[];
  /** The pending draft — the message the field opens on. */
  suggestedMessage: string;
}

export interface LocalChangesFirstModalProps {
  /** The refused pass; null keeps the modal unmounted. */
  prompt: LocalChangesFirstPrompt | null;
  /** The person's word, with the message for the commit of their work. */
  onCommit: (message: string) => void;
  onCancel: () => void;
}

function bodyOf(operation: LocalChangesOperation, t: Translate): string {
  if (operation.kind === 'pull') return t('workbench.gitLog.localChanges.pullBody');
  if (operation.kind === 'merge') return t('workbench.gitLog.localChanges.mergeBody', { ref: operation.ref });
  return t('workbench.gitLog.applyCommit.localChanges.body', { commit: shortSha(operation.sha) });
}

function okOf(operation: LocalChangesOperation, t: Translate): string {
  if (operation.kind === 'pull') return t('workbench.gitLog.localChanges.okPull');
  if (operation.kind === 'merge') return t('workbench.gitLog.localChanges.okMerge');
  return t(
    operation.kind === 'revert'
      ? 'workbench.gitLog.applyCommit.localChanges.okRevert'
      : 'workbench.gitLog.applyCommit.localChanges.okPick',
  );
}

const LocalChangesFirstModal: React.FC<LocalChangesFirstModalProps> = ({ prompt, onCommit, onCancel }) => {
  const t = useT();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (prompt !== null) setMessage(prompt.suggestedMessage);
  }, [prompt]);

  const trimmed = message.trim();
  return (
    <Modal
      open={prompt !== null}
      title={t('workbench.gitLog.applyCommit.localChanges.title')}
      okText={prompt !== null ? okOf(prompt.operation, t) : ''}
      cancelText={t('workbench.gitLog.createBranch.cancel')}
      okButtonProps={{ disabled: trimmed.length === 0 }}
      onOk={() => {
        if (trimmed.length > 0) onCommit(trimmed);
      }}
      onCancel={onCancel}
      width={520}
      centered
      destroyOnHidden
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}
        data-testid="git-tool-local-changes-first"
      >
        <span style={{ fontSize: 12.5 }}>{prompt !== null ? bodyOf(prompt.operation, t) : ''}</span>
        {prompt !== null ? <PassFileTree files={prompt.files} testId="git-tool-local-changes-first-files" /> : null}
        <Input.TextArea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('workbench.commitTool.messagePlaceholder')}
          autoSize={{ minRows: 2, maxRows: 6 }}
          data-testid="git-tool-local-changes-first-message"
        />
      </div>
    </Modal>
  );
};

export default LocalChangesFirstModal;
