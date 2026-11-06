/**
 * RemotesModal — the Git Remotes dialog (the reference's): the
 * configured remotes as name | url rows with a +, pencil and − bar
 * above them. Add and Edit open the Define Remote form; Remove
 * confirms first. Every change is one host verb and the list reads
 * itself again after; the status frame the host publishes moves the
 * rail's remote folders and the upstream counts on their own.
 */

import { EditOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { hostBridge, type WorkspaceTreeRemoteOpWire, type WorkspaceTreeRemoteWire } from '@openheaders/core/bridge';
import { App as AntApp, Button, Modal, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import RemoteFormModal from './RemoteFormModal';
import { type RemoteDraft, type RemoteRow, remoteUpdatePatch } from './remote-form-model';

export interface RemotesModalProps {
  workspaceId: string;
  open: boolean;
  /** The element the dialog centers over; null = the document body. */
  container: HTMLElement | null;
  onClose: () => void;
}

type FormState = { mode: 'add' } | { mode: 'edit'; row: RemoteRow };

const RemotesModal: React.FC<RemotesModalProps> = ({ workspaceId, open, container, onClose }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { modal, notification } = AntApp.useApp();
  const [remotes, setRemotes] = useState<readonly WorkspaceTreeRemoteWire[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!open) return;
    setRemotes(null);
    setSelected(null);
    setForm(null);
    void reload();
  }, [open, reload]);

  const selectedRow = remotes?.find((remote) => remote.name === selected) ?? null;

  const refusal = (result: Extract<WorkspaceTreeRemoteOpWire, { ok: false }>, name: string): string => {
    switch (result.reason) {
      case 'exists':
        return t('workbench.gitRemotes.exists', { name });
      case 'unknown-remote':
        return t('workbench.gitRemotes.unknown', { name });
      case 'invalid-name':
        return t('workbench.gitRemotes.define.nameInvalid');
      case 'invalid-url':
        return t('workbench.gitRemotes.define.urlInvalid');
      default:
        return t('workbench.gitRemotes.failed', { detail: result.detail ?? result.reason });
    }
  };

  const submit = async (draft: RemoteDraft): Promise<void> => {
    if (form === null || formBusy) return;
    const patch = form.mode === 'edit' ? remoteUpdatePatch(form.row, draft) : null;
    if (form.mode === 'edit' && patch === null) {
      setForm(null);
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const result =
        form.mode === 'add'
          ? await hostBridge.call('oh.workspaceTree.addRemote', { workspaceId, name: draft.name, url: draft.url })
          : await hostBridge.call('oh.workspaceTree.updateRemote', { workspaceId, name: form.row.name, ...patch });
      if (result.ok) {
        setForm(null);
        setSelected(draft.name);
        await reload();
      } else {
        setFormError(refusal(result, form.mode === 'add' ? draft.name : form.row.name));
      }
    } catch (err) {
      setFormError(t('workbench.gitRemotes.failed', { detail: failure(err) }));
    } finally {
      setFormBusy(false);
    }
  };

  const remove = (row: RemoteRow): void => {
    modal.confirm({
      title: t('workbench.gitRemotes.removeConfirm', { name: row.name }),
      content: t('workbench.gitRemotes.removeConfirmBody'),
      okText: t('workbench.gitRemotes.removeOk'),
      okButtonProps: { danger: true, 'data-testid': 'git-remotes-remove-ok' },
      cancelText: t('workbench.gitLog.modal.cancel'),
      getContainer: container ?? undefined,
      onOk: async () => {
        try {
          const result = await hostBridge.call('oh.workspaceTree.removeRemote', { workspaceId, name: row.name });
          if (!result.ok) notification.error({ title: refusal(result, row.name) });
        } catch (err) {
          notification.error({ title: t('workbench.gitRemotes.failed', { detail: failure(err) }) });
        }
        setSelected(null);
        await reload();
      },
    });
  };

  const openForm = (next: FormState): void => {
    setFormError(null);
    setForm(next);
  };

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
        getContainer={container ?? undefined}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }} data-testid="git-remotes">
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {tool(t('workbench.gitRemotes.add'), <PlusOutlined />, 'git-remotes-add', () => openForm({ mode: 'add' }))}
            {tool(
              t('workbench.gitRemotes.remove'),
              <MinusOutlined />,
              'git-remotes-remove',
              () => {
                if (selectedRow !== null) remove(selectedRow);
              },
              selectedRow === null,
            )}
            {tool(
              t('workbench.gitRemotes.edit'),
              <EditOutlined />,
              'git-remotes-edit',
              () => {
                if (selectedRow !== null) openForm({ mode: 'edit', row: selectedRow });
              },
              selectedRow === null,
            )}
          </div>
          <div
            className="rules-thin-scrollbar"
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
                onDoubleClick={() => openForm({ mode: 'edit', row: remote })}
                title={remote.pushUrl === null ? remote.url : `${remote.url}\n${remote.pushUrl}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: 8,
                  width: '100%',
                  padding: '3px 10px',
                  border: 'none',
                  background: 'transparent',
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
      <RemoteFormModal
        initial={form === null ? null : form.mode === 'edit' ? form.row : { name: '', url: '' }}
        container={container}
        busy={formBusy}
        error={formError}
        onSubmit={(draft) => void submit(draft)}
        onClose={() => setForm(null)}
      />
    </>
  );
};

export default RemotesModal;
