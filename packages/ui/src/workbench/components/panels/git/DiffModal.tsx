/**
 * DiffModal — one file's change in one commit as an old/new Monaco
 * pair (the workbench RichDiffEditor), with plain notices for binary
 * and over-cap blobs. Lifted out of the orchestrator unchanged in
 * behavior; the diff data arrives fetched.
 */

import type { WorkspaceTreeFileDiffPairWire } from '@openheaders/core/bridge';
import { Modal } from 'antd';
import type React from 'react';
import { useState } from 'react';
import '@openheaders/ui/workbench/components/monaco/bootstrap';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  DEFAULT_DIFF_VIEWER_OPTIONS,
  type DiffViewerOptions,
  RichDiffEditor,
} from '@openheaders/ui/workbench/components/diff-viewer';

/** Monaco language for a tree path — the workspace tree is YAML-first. */
function diffLanguage(filePath: string): string {
  if (/\.ya?ml$/i.test(filePath)) return 'yaml';
  if (/\.json$/i.test(filePath)) return 'json';
  if (/\.md$/i.test(filePath)) return 'markdown';
  return 'plaintext';
}

export interface DiffModalProps {
  diff: WorkspaceTreeFileDiffPairWire | null;
  onClose: () => void;
}

const DiffModal: React.FC<DiffModalProps> = ({ diff, onClose }) => {
  const t = useT();
  const [options, setOptions] = useState<DiffViewerOptions>(DEFAULT_DIFF_VIEWER_OPTIONS);
  return (
    <Modal
      open={diff !== null}
      title={diff !== null ? t('workbench.gitLog.diff.title', { path: diff.path }) : ''}
      onCancel={onClose}
      footer={null}
      width="82%"
      destroyOnHidden
      data-testid="git-tool-diff-modal"
    >
      {diff !== null && diff.binary && (
        <p style={{ fontSize: 12, margin: 0 }} data-testid="git-tool-diff-binary">
          {t('workbench.gitLog.diff.binary')}
        </p>
      )}
      {diff !== null && !diff.binary && diff.tooLarge && (
        <p style={{ fontSize: 12, margin: 0 }} data-testid="git-tool-diff-too-large">
          {t('workbench.gitLog.diff.tooLarge', {
            size: String(Math.ceil(Math.max(diff.oldSize ?? 0, diff.newSize ?? 0) / 1024)),
          })}
        </p>
      )}
      {diff !== null && !diff.binary && !diff.tooLarge && (
        <div style={{ height: '62vh' }} data-testid="git-tool-diff-editor">
          <RichDiffEditor
            original={diff.oldContent ?? ''}
            modified={diff.newContent ?? ''}
            language={diffLanguage(diff.path)}
            options={options}
            onOptionsChange={setOptions}
          />
        </div>
      )}
    </Modal>
  );
};

export default DiffModal;
