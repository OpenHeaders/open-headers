/**
 * RemoteFormModal — the Define Remote form the Git Remotes dialog
 * opens for Add and Edit (the reference's): a name, a url and "Fetch
 * remote" — checked on every opening; with it the caller fetches once
 * the change is in. OK is held while the draft is not sendable (the
 * pure model says what is missing). What stopped the last submit — the
 * host's typed refusal, or git's own words for a url nothing answers
 * at — reads under the field it is about (under both when it is about
 * neither), and that field wears the error border until the draft is
 * edited. The caller owns the verb;
 * this form owns only the draft.
 */

import { Checkbox, Input, type InputRef, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  type RemoteDraft,
  type RemoteDraftIssue,
  type RemoteFormError,
  type RemoteRow,
  remoteDraftIssue,
} from './remote-form-model';

export interface RemoteFormModalProps {
  /** Null keeps the form closed; a row prefills Edit, an empty name prefills Add. */
  initial: RemoteRow | null;
  busy: boolean;
  /** What stopped the last submit, already worded, with the field it is about. */
  error: RemoteFormError | null;
  /** The draft, and whether to fetch the remotes once the change is in. */
  onSubmit: (draft: RemoteDraft, fetch: boolean) => void;
  /** A field was edited — what the last submit said is no longer about this draft. */
  onDraftChange: () => void;
  onClose: () => void;
}

const ISSUE_KEY: Record<RemoteDraftIssue, 'nameEmpty' | 'nameInvalid' | 'urlEmpty' | 'urlInvalid'> = {
  'name-empty': 'nameEmpty',
  'name-invalid': 'nameInvalid',
  'url-empty': 'urlEmpty',
  'url-invalid': 'urlInvalid',
};

const LABEL_WIDTH = 48;
const FIELD_GAP = 8;

const RemoteFormModal: React.FC<RemoteFormModalProps> = ({
  initial,
  busy,
  error,
  onSubmit,
  onDraftChange,
  onClose,
}) => {
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
  const shapeError: RemoteFormError | null =
    issue === 'name-invalid' || issue === 'url-invalid'
      ? { field: issue === 'name-invalid' ? 'name' : 'url', text: t(`workbench.gitRemotes.define.${ISSUE_KEY[issue]}`) }
      : null;
  const shown = error ?? shapeError;
  /** The error's line — under the field it is about, starting where the fields do. */
  const errorUnder = (field: RemoteFormError['field']): React.ReactNode =>
    shown !== null && shown.field === field ? (
      // Git's words for a url nothing answers at come in lines of their own.
      <div
        style={{
          fontSize: 12,
          color: token.colorError,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          marginTop: -6,
          paddingInlineStart: field === null ? 0 : LABEL_WIDTH + FIELD_GAP,
        }}
        data-testid="git-remote-form-error"
        data-field={field ?? undefined}
      >
        {shown.text}
      </div>
    ) : null;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: FIELD_GAP }}>
          <span style={{ flex: `0 0 ${LABEL_WIDTH}px` }}>{t('workbench.gitRemotes.name')}</span>
          <Input
            ref={nameRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              onDraftChange();
            }}
            onPressEnter={submit}
            status={shown?.field === 'name' ? 'error' : undefined}
            data-testid="git-remote-form-name"
          />
        </div>
        {errorUnder('name')}
        <div style={{ display: 'flex', alignItems: 'center', gap: FIELD_GAP }}>
          <span style={{ flex: `0 0 ${LABEL_WIDTH}px` }}>{t('workbench.gitRemotes.url')}</span>
          <Input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              onDraftChange();
            }}
            onPressEnter={submit}
            status={shown?.field === 'url' ? 'error' : undefined}
            data-testid="git-remote-form-url"
          />
        </div>
        {errorUnder('url')}
        <Checkbox checked={fetch} onChange={(event) => setFetch(event.target.checked)} data-testid="git-remote-form-fetch">
          {t('workbench.gitRemotes.define.fetch')}
        </Checkbox>
        {errorUnder(null)}
      </div>
    </Modal>
  );
};

export default RemoteFormModal;
