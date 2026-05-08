/**
 * Phase 1 shell — antd Modal that renders one MergePane for the
 * active file (single-file mode). Multi-file shell + sidebar arrives
 * in Phase 5.
 *
 * Apply flow: read each file's editable result text via the pane
 * handle, build the `Map<fileId, resultText>`, hand to the session
 * adapter. Modal stays open if any outcome is `ok: false`.
 */

import { Alert, Button, Modal, Space, Typography, theme } from 'antd';
import { type ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import type { MergeApplyOutcome, MergeSession } from '../types';
import MergePane, { type MergePaneHandle } from './MergePane';

const { Text } = Typography;

export interface MergeConflictModalProps {
  open: boolean;
  session: MergeSession;
  /** Caller provides the dark-mode signal; the editor stays
   *  shell-agnostic. */
  isDarkMode?: boolean;
  /** Closes the modal after Apply succeeds for every file. The shell
   *  also calls `session.onCancel()` for explicit cancel. */
  onClose(): void;
}

const MergeConflictModal = ({ open, session, isDarkMode, onClose }: MergeConflictModalProps): ReactElement => {
  const { token } = theme.useToken();
  const paneRef = useRef<MergePaneHandle>(null);
  const [applying, setApplying] = useState(false);
  const [outcomes, setOutcomes] = useState<MergeApplyOutcome[]>([]);
  const failedOutcomes = useMemo(() => outcomes.filter((o) => !o.ok), [outcomes]);

  // Phase 1: single-file shell. Initial-file selection follows the
  // session hint or first file. Multi-file selection arrives in Phase 5.
  const activeFile = useMemo(() => {
    if (session.files.length === 0) return null;
    if (session.initialFileId) {
      const hit = session.files.find((f) => f.id === session.initialFileId);
      if (hit) return hit;
    }
    return session.files[0];
  }, [session]);

  const handleCancel = useCallback(() => {
    session.onCancel();
    onClose();
  }, [session, onClose]);

  const handleApply = useCallback(async () => {
    if (!activeFile) return;
    setApplying(true);
    try {
      const results = new Map<string, string>();
      const text = paneRef.current?.getResultText() ?? activeFile.initialResult;
      results.set(activeFile.id, text);
      const next = await session.onApply(session.files, results);
      setOutcomes(next);
      if (next.every((o) => o.ok)) onClose();
    } finally {
      setApplying(false);
    }
  }, [activeFile, session, onClose]);

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={session.title}
      width="min(1600px, 95vw)"
      destroyOnClose
      zIndex={1100}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={applying}>
          Cancel
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply} loading={applying}>
          Complete Merge
        </Button>,
      ]}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: 'calc(85vh - 120px)',
          minHeight: 480,
        }}
      >
        {failedOutcomes.length > 0 ? (
          <Alert
            type="error"
            showIcon
            message={
              <Space direction="vertical" size={2}>
                <Text strong>Apply reported errors:</Text>
                {failedOutcomes.map((o) => (
                  <Text key={o.fileId} type="secondary" style={{ fontSize: 12 }}>
                    {session.files.find((f) => f.id === o.fileId)?.label ?? o.fileId}: {o.error ?? 'unknown error'}
                  </Text>
                ))}
              </Space>
            }
          />
        ) : null}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {activeFile ? (
            <MergePane ref={paneRef} file={activeFile} isDarkMode={isDarkMode} />
          ) : (
            <div style={{ padding: 16 }}>
              <Text type="secondary">No files in this merge session.</Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MergeConflictModal;
