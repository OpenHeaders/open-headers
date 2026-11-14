/**
 * RemoteFormModal — the Define Remote form the Git Remotes dialog
 * opens for Add and Edit (the reference's): a name, a url and "Fetch
 * remote" — checked on every opening; with it the caller fetches once
 * the change is in. OK is held while the draft is not sendable (the
 * pure model says what is missing), the host's typed refusal rendered
 * inline under the fields. The caller owns the verb; this form owns
 * only the draft.
 */

import { Checkbox, Input, type InputRef, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type RemoteDraft, type RemoteDraftIssue, type RemoteRow, remoteDraftIssue } from './remote-form-model';

export interface RemoteFormModalProps {
  /** Null keeps the form closed; a row prefills Edit, an empty name prefills Add. */
  initial: RemoteRow | null;
  busy: boolean;
  /** The host's refusal for the last submit, already worded. */
  error: string | null;
  /** The draft, and whether to fetch the remotes once the change is in. */
  onSubmit: (draft: RemoteDraft, fetch: boolean) => void;
  onClose: () => void;
}

const ISSUE_KEY: Record<RemoteDraftIssue, 'nameEmpty' | 'nameInvalid' | 'urlEmpty' | 'urlInvalid'> = {
  'name-empty': 'nameEmpty',
  'name-invalid': 'nameInvalid',
  'url-empty': 'urlEmpty',
  'url-invalid': 'urlInvalid',
};

const RemoteFormModal: React.FC<RemoteFormModalProps> = ({ initial, busy, error, onSubmit, onClose }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [fetch, setFetch] = useState(true);
  const nameRef = useRef<InputRef>(null);

  useEffect(() => {
    if (initial === null) return;
    setName(initial.name);
    setUrl(initial.url);
    setFetch(true);
    const timer = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [initial]);

  const issue = remoteDraftIssue({ name, url });
  // An empty field is not a mistake yet — only a shape the host would refuse is named.
  const issueText = issue === 'name-invalid' || issue === 'url-invalid' ? t(`workbench.gitRemotes.define.${ISSUE_KEY[issue]}`) : null;
  const submit = (): void => {
    if (busy || issue !== null) return;
    onSubmit({ name: name.trim(), url: url.trim() }, fetch);
  };

  return (
    <Modal
      open={initial !== null}
      title={t('workbench.gitRemotes.define.title')}
      okText={t('workbench.gitLog.modal.ok')}
      cancelText={t('workbench.gitLog.modal.cancel')}
      okButtonProps={{ disabled: issue !== null, loading: busy, 'data-testid': 'git-remote-form-ok' }}
      onOk={submit}
      onCancel={onClose}
      width={480}
      centered
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }} data-testid="git-remote-form">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: '0 0 48px' }}>{t('workbench.gitRemotes.name')}</span>
          <Input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={submit}
            data-testid="git-remote-form-name"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: '0 0 48px' }}>{t('workbench.gitRemotes.url')}</span>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onPressEnter={submit}
            data-testid="git-remote-form-url"
          />
        </div>
        <Checkbox checked={fetch} onChange={(event) => setFetch(event.target.checked)} data-testid="git-remote-form-fetch">
          {t('workbench.gitRemotes.define.fetch')}
        </Checkbox>
        {(error ?? issueText) !== null && (
          <div style={{ fontSize: 12, color: token.colorError }} data-testid="git-remote-form-error">
            {error ?? issueText}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RemoteFormModal;
