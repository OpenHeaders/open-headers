/**
 * CreateTagModal — the log's New Tag… dialog: "Create Tag at <short
 * sha>", a name input (empty, focused), Create / Cancel. Create calls
 * the runtime verb for a lightweight tag at the commit; typed refusals
 * render inline (`exists` names the taken tag). Tags never ride a
 * push, so the dialog carries no push option.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { Input, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface CreateTagModalProps {
  workspaceId: string;
  /** The FULL sha the tag is minted at. Null keeps the modal unmounted. */
  sha: string | null;
  /** The Git tool window element — the modal centers over the panel. Null falls back to the document body. */
  container: HTMLElement | null;
  onClose: () => void;
  /** A tag was created — the caller raises the balloon; the status frame refreshes the views. */
  onCreated: (name: string, sha: string) => void;
}

const CreateTagModal: React.FC<CreateTagModalProps> = ({ workspaceId, sha, container, onClose, onCreated }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (sha === null) return;
    setName('');
    setError(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [sha]);

  const submit = async (): Promise<void> => {
    if (sha === null || busy) return;
    const tag = name.trim();
    if (tag.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await hostBridge.call('oh.workspaceTree.createTag', { workspaceId, name: tag, sha });
      if (result.ok) {
        onCreated(result.name, result.sha);
        onClose();
      } else if (result.reason === 'exists') {
        setError(t('workbench.gitLog.createTag.exists', { name: tag }));
      } else {
        setError(t('workbench.gitLog.createTag.failed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setError(t('workbench.gitLog.createTag.failed', { detail: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={sha !== null}
      title={sha !== null ? t('workbench.gitLog.createTag.title', { sha: sha.slice(0, 7) }) : ''}
      okText={t('workbench.gitLog.createTag.create')}
      cancelText={t('workbench.gitLog.createBranch.cancel')}
      okButtonProps={{ disabled: name.trim().length === 0, loading: busy }}
      onOk={() => void submit()}
      onCancel={onClose}
      width={480}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0 }}>{t('workbench.gitLog.createTag.nameLabel')}</span>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={() => void submit()}
            data-testid="git-tool-create-tag-name"
          />
        </div>
        {error !== null && (
          <div style={{ fontSize: 12, color: token.colorError }} data-testid="git-tool-create-tag-error">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CreateTagModal;
