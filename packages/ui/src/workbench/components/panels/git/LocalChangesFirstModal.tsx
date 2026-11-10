/**
 * LocalChangesFirstModal — the question a Cherry-Pick or a Revert
 * raises when its change is about to write a file that holds
 * uncommitted work: that work has to be committed first, or it would
 * ride into the pick's commit. The dialog names the files and offers
 * the commit under the pending draft — the person's to edit — or
 * Cancel, which leaves the branch and the tree as they were. Work in
 * any other file is not part of the question: the pick never commits
 * it.
 */

import { Input, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type CommitApplyMode, shortSha } from './commit-apply';

export interface LocalChangesFirstPrompt {
  sha: string;
  mode: CommitApplyMode;
  /** The files the change would write that hold uncommitted work. */
  files: readonly string[];
  /** The pending draft — the message the field opens on. */
  suggestedMessage: string;
}

export interface LocalChangesFirstModalProps {
  /** The refused pick; null keeps the modal unmounted. */
  prompt: LocalChangesFirstPrompt | null;
  /** The Git tool window element — the modal centers over the panel. Null falls back to the document body. */
  container: HTMLElement | null;
  /** The person's word, with the message for the commit of their work. */
  onCommit: (message: string) => void;
  onCancel: () => void;
}

const LocalChangesFirstModal: React.FC<LocalChangesFirstModalProps> = ({ prompt, container, onCommit, onCancel }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (prompt !== null) setMessage(prompt.suggestedMessage);
  }, [prompt]);

  const trimmed = message.trim();
  return (
    <Modal
      open={prompt !== null}
      title={t('workbench.gitLog.applyCommit.localChanges.title')}
      okText={t(
        prompt?.mode === 'revert'
          ? 'workbench.gitLog.applyCommit.localChanges.okRevert'
          : 'workbench.gitLog.applyCommit.localChanges.okPick',
      )}
      cancelText={t('workbench.gitLog.createBranch.cancel')}
      okButtonProps={{ disabled: trimmed.length === 0 }}
      onOk={() => {
        if (trimmed.length > 0) onCommit(trimmed);
      }}
      onCancel={onCancel}
      width={520}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}
        data-testid="git-tool-local-changes-first"
      >
        <span style={{ fontSize: 12.5 }}>
          {prompt !== null
            ? t('workbench.gitLog.applyCommit.localChanges.body', { commit: shortSha(prompt.sha) })
            : ''}
        </span>
        <div
          style={{
            maxHeight: 132,
            overflowY: 'auto',
            overscrollBehavior: 'none',
            padding: '6px 8px',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 4,
            fontFamily: token.fontFamilyCode,
            fontSize: 12,
            lineHeight: '18px',
          }}
          data-testid="git-tool-local-changes-first-files"
        >
          {(prompt?.files ?? []).map((filePath) => (
            <div key={filePath} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={filePath}>
              {filePath}
            </div>
          ))}
        </div>
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
