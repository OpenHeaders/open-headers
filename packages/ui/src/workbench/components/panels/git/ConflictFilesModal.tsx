/**
 * ConflictFilesModal — the step before the conflict editor. A pass (a
 * Pull, a branch Merge, a Cherry-Pick, a Revert) found files both sides
 * changed and has written nothing; the dialog names them under the
 * pass's own title and takes one of three answers: one side for all of
 * them (Accept Incoming / Keep Mine — the host rules the values
 * both sides changed for that side and keeps what only one side
 * changed), Review Conflicts… for the editor, where each is answered by
 * hand, or Cancel, which leaves the branch and the tree as they were.
 * Review is the default: it writes nothing by itself. The two sides sit
 * apart from Cancel and Review, at the footer's start, and the footer
 * wraps by group when a locale's labels do not fit one row.
 */

import { Button, Modal } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import PassFileList from './PassFileList';

/** One side for every file: the incoming change's, or the branch's. */
export type ConflictSide = 'theirs' | 'mine';

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
  /** The side on its way to the host — every answer is held until it is back. */
  sending: ConflictSide | null;
  onSide: (side: ConflictSide) => void;
  /** The person's word for the editor. */
  onReview: () => void;
  onCancel: () => void;
}

const ConflictFilesModal: React.FC<ConflictFilesModalProps> = ({
  prompt,
  container,
  sending,
  onSide,
  onReview,
  onCancel,
}) => {
  const t = useT();
  const held = sending !== null;
  return (
    <Modal
      open={prompt !== null}
      title={prompt?.title ?? ''}
      onCancel={onCancel}
      closable={!held}
      mask={{ closable: !held }}
      keyboard={!held}
      width={640}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => onSide('theirs')}
              loading={sending === 'theirs'}
              disabled={sending === 'mine'}
              data-testid="git-tool-conflict-files-theirs"
            >
              {t('shared.mergeEditor.zone.acceptIncoming')}
            </Button>
            <Button
              onClick={() => onSide('mine')}
              loading={sending === 'mine'}
              disabled={sending === 'theirs'}
              data-testid="git-tool-conflict-files-mine"
            >
              {t('workbench.gitLog.resolve.keepMine')}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
            <Button onClick={onCancel} disabled={held} data-testid="git-tool-conflict-files-cancel">
              {t('workbench.gitLog.createBranch.cancel')}
            </Button>
            <Button type="primary" onClick={onReview} disabled={held} data-testid="git-tool-conflict-files-review">
              {t('workbench.gitLog.resolve.review')}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }} data-testid="git-tool-conflict-files">
        <span style={{ fontSize: 12.5 }}>{t('workbench.gitLog.resolve.filesBody')}</span>
        <PassFileList files={prompt?.files ?? []} testId="git-tool-conflict-files-list" />
      </div>
    </Modal>
  );
};

export default ConflictFilesModal;
