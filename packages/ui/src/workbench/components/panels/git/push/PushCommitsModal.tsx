/**
 * PushCommitsModal — the Push window (the reference anatomy): the
 * commits that would go on the left under the `branch → remote :
 * branch` line, the selected commit's files and details on the
 * right, Cancel and Push in the footer. The list is `compareRefs`
 * against the upstream (the commits it lacks) or the branch's log when
 * no upstream exists yet; it refetches on status frames while open.
 * The window never pushes itself — Push runs the caller's routine so
 * every surface keeps its own refusal face (the hook's balloons, the
 * Commit window's inline error and no-permission recovery) — and
 * closes once that routine settles. Window-centered like the diff
 * (it is wider than any tool window).
 */

import {
  hostBridge,
  type WorkspaceTreeLogEntryWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { Button, Modal, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useWorkspaceGitSnapshot } from '../../../../stores/git-status-store';
import CommitDetails from '../CommitDetails';
import DiffModal from '../DiffModal';
import FileTreeView from '../FileTreeView';
import { useFileDiff } from '../use-file-diff';
import PushCommitList from './PushCommitList';
import { canPush, folderNameOf, pushTarget } from './push-window-model';

export interface PushCommitsModalProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  /** The surface's push routine — runs on Push; the window closes when it settles. */
  onConfirm: () => Promise<void>;
}

const PushCommitsModal: React.FC<PushCommitsModalProps> = ({ workspaceId, open, onClose, onConfirm }) => {
  const { token } = theme.useToken();
  const t = useT();
  const snapshot = useWorkspaceGitSnapshot(workspaceId);
  const target = useMemo(() => pushTarget(snapshot.status), [snapshot.status]);
  const [entries, setEntries] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileDiff = useFileDiff(workspaceId);

  const reload = useCallback(async (): Promise<void> => {
    if (target.kind !== 'upstream' && target.kind !== 'new-upstream') {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (target.kind === 'upstream') {
        const result = await hostBridge.call('oh.workspaceTree.compareRefs', { workspaceId, ref: target.upstream });
        if (result.ok) setEntries(result.onlyInCurrent);
        else {
          setEntries([]);
          setError(t('workbench.gitPush.failed', { detail: result.detail ?? result.reason }));
        }
      } else {
        const result = await hostBridge.call('oh.workspaceTree.log', { workspaceId, ref: target.branch });
        if (result.ok) setEntries(result.entries);
        else {
          setEntries([]);
          setError(t('workbench.gitPush.failed', { detail: result.detail ?? result.reason }));
        }
      }
    } catch (err) {
      setEntries([]);
      setError(t('workbench.gitPush.failed', { detail: (err as Error).message }));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, target, t]);

  useEffect(() => {
    if (!open) return;
    setSelectedSha(null);
    void reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId === workspaceId) void reload();
    });
  }, [open, workspaceId, reload]);

  const refsBySha = useMemo(() => {
    const map = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of snapshot.refs) {
      const rows = map.get(ref.sha);
      if (rows !== undefined) rows.push(ref);
      else map.set(ref.sha, [ref]);
    }
    return map;
  }, [snapshot.refs]);

  const selected = selectedSha !== null ? (entries.find((entry) => entry.sha === selectedSha) ?? null) : null;
  const headSha = snapshot.status?.headSha ?? null;

  const confirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <>
      <Modal
        open={open}
        title={t('workbench.gitPush.title', { folder: folderNameOf(snapshot.rootDir) })}
        onCancel={busy ? undefined : onClose}
        width={900}
        centered
        destroyOnHidden
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose} disabled={busy} data-testid="git-push-cancel">
              {t('workbench.gitPush.cancel')}
            </Button>
            <Button
              type="primary"
              onClick={() => void confirm()}
              loading={busy}
              disabled={loading || !canPush(target, entries.length)}
              data-testid="git-push-confirm"
            >
              {t('workbench.gitPush.push')}
            </Button>
          </div>
        }
        data-testid="git-push-window"
      >
        <div
          style={{
            display: 'flex',
            height: 460,
            minHeight: 0,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusSM,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: '1 1 55%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {error !== null && (
              <div
                style={{
                  flex: '0 0 auto',
                  padding: '4px 12px',
                  fontSize: 12,
                  color: token.colorError,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
                data-testid="git-push-error"
              >
                {error}
              </div>
            )}
            <PushCommitList
              target={target}
              entries={entries}
              selectedSha={selectedSha}
              onSelect={setSelectedSha}
              loading={loading}
            />
          </div>
          <div style={{ flex: '1 1 45%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selected === null ? (
              <div
                style={{
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: token.colorTextSecondary,
                }}
                data-testid="git-push-detail-placeholder"
              >
                {t('workbench.gitLog.selectCommit')}
              </div>
            ) : (
              <>
                <FileTreeView
                  key={selected.sha}
                  files={selected.files}
                  loadingPath={fileDiff.loadingPath}
                  onOpenFile={(path) => void fileDiff.open(selected.sha, path)}
                  showHeader
                />
                <div
                  style={{
                    flex: '1 1 45%',
                    minHeight: 0,
                    overflowY: 'auto',
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <CommitDetails
                    entry={selected}
                    refsAtCommit={refsBySha.get(selected.sha) ?? []}
                    isHead={selected.sha === headSha}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
      <DiffModal diff={fileDiff.diff} onClose={fileDiff.close} />
    </>
  );
};

export default PushCommitsModal;
