/**
 * RemotesModal — the Git Remotes dialog (the reference's): the
 * configured remotes as name | url rows with a +, pencil and − bar
 * above them. Add and Edit open the Define Remote form; Remove
 * confirms first (`use-remote-ops` — the branches rail offers the same
 * edits on a remote). Every change is one host verb and the list reads
 * itself again after; the status frame the host publishes moves the
 * rail's remote folders and the upstream counts on their own.
 */

import { EditOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { hostBridge, type WorkspaceTreeRemoteWire } from '@openheaders/core/bridge';
import { Button, Modal, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRemoteOps } from './use-remote-ops';

export interface RemotesModalProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

const RemotesModal: React.FC<RemotesModalProps> = ({ workspaceId, open, onClose }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [remotes, setRemotes] = useState<readonly WorkspaceTreeRemoteWire[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const failure = (err: unknown): string => (err instanceof Error ? err.message : String(err));

  const reload = useCallback(async (): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.workspaceTree.listRemotes', { workspaceId });
      if (result.ok) {
        setRemotes(result.remotes);
        setListError(null);
      } else {
        setRemotes([]);
        setListError(t('workbench.gitRemotes.listFailed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setRemotes([]);
      setListError(t('workbench.gitRemotes.listFailed', { detail: failure(err) }));
    }
  }, [workspaceId, t]);

  // The edits themselves are the shared ones (`use-remote-ops`); a change selects what it left and re-reads.
  const ops = useRemoteOps(workspaceId, (name) => {
    setSelected(name);
    void reload();
  });

  useEffect(() => {
    if (!open) return;
    setRemotes(null);
    setSelected(null);
    void reload();
  }, [open, reload]);

  const selectedRow = remotes?.find((remote) => remote.name === selected) ?? null;

  const tool = (
    label: string,
    icon: React.ReactNode,
    testid: string,
    onClick: () => void,
    disabled = false,
  ): React.ReactNode => (
    <Tooltip title={label} mouseEnterDelay={0.4}>
      <Button type="text" size="small" icon={icon} aria-label={label} disabled={disabled} onClick={onClick} data-testid={testid} />
    </Tooltip>
  );

  return (
    <>
      <Modal
        open={open}
        title={t('workbench.gitRemotes.title')}
        footer={null}
        onCancel={onClose}
        width={560}
        centered
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }} data-testid="git-remotes">
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {tool(t('workbench.gitRemotes.add'), <PlusOutlined />, 'git-remotes-add', ops.add)}
            {tool(
              t('workbench.gitRemotes.remove'),
              <MinusOutlined />,
              'git-remotes-remove',
              () => {
                if (selectedRow !== null) ops.remove(selectedRow.name);
              },
              selectedRow === null,
            )}
            {tool(
              t('workbench.gitRemotes.edit'),
              <EditOutlined />,
              'git-remotes-edit',
              () => {
                if (selectedRow !== null) ops.edit(selectedRow);
              },
              selectedRow === null,
            )}
          </div>
          <div
            className="rules-thin-scrollbar git-remotes-list"
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusSM,
              minHeight: 160,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: token.colorTextTertiary,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <span>{t('workbench.gitRemotes.name')}</span>
              <span>{t('workbench.gitRemotes.url')}</span>
            </div>
            {remotes !== null && remotes.length === 0 && (
              <div
                style={{ padding: '10px 12px', fontSize: 12, color: token.colorTextSecondary }}
                data-testid="git-remotes-empty"
              >
                {listError ?? t('workbench.gitRemotes.empty')}
              </div>
            )}
            {remotes?.map((remote) => (
              <button
                key={remote.name}
                type="button"
                className={remote.name === selected ? 'git-tool-row selected' : 'git-tool-row'}
                onClick={() => setSelected(remote.name)}
                onDoubleClick={() => ops.edit(remote)}
                title={remote.pushUrl === null ? remote.url : `${remote.url}\n${remote.pushUrl}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: 8,
                  width: '100%',
                  padding: '3px 10px',
                  border: 'none',
                  // No background here: the row's fill at rest, under the pointer and selected is the stylesheet's.
                  textAlign: 'left',
                  cursor: 'default',
                  fontSize: 13,
                  color: token.colorText,
                }}
                data-testid="git-remotes-row"
                data-remote={remote.name}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{remote.name}</span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: token.colorTextSecondary,
                  }}
                >
                  {remote.url}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
      {ops.dialogs}
    </>
  );
};

export default RemotesModal;
