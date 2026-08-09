/**
 * GitBindForm — the bind-a-folder gesture shared verbatim by the
 * settings Git card and the Git tool window's empty state (the IDE
 * precedent: the log view's no-VCS state offers the create/bind action
 * in place, it never bounces the user to settings). Path input, the
 * native folder picker where the host has one, the Bind button, and the
 * typed refusal rendering — the caller supplies the transport and hears
 * `onBound` when the workspace lands.
 */

import { Button, Input, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { WorkspaceTreeTransport } from './transport';

export interface GitBindFormProps {
  call: WorkspaceTreeTransport;
  workspaceId: string | null;
  /** False on hosts without a native folder dialog (remote daemon). */
  allowFolderPicker: boolean;
  /** Fires after a successful bind (true = folder was empty and got initialized). */
  onBound: (initialized: boolean) => void;
  /** Testid namespace — `git-pane` on the settings card, `git-tool-bind` in the tool window. */
  testidPrefix: string;
}

const GitBindForm: React.FC<GitBindFormProps> = ({ call, workspaceId, allowFolderPicker, onBound, testidPrefix }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [draftPath, setDraftPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

  const chooseFolder = async (): Promise<void> => {
    try {
      const result = await call('oh.workspaceTree.pickFolder');
      if (result.path !== null) {
        setDraftPath(result.path);
        setBindError(null);
      }
    } catch {
      // No native picker on this host — the path input stands alone.
    }
  };

  const bind = async (): Promise<void> => {
    if (workspaceId === null || draftPath.trim() === '') return;
    setBusy(true);
    setBindError(null);
    try {
      const result = await call('oh.workspaceTree.bind', {
        workspaceId,
        rootDir: draftPath.trim(),
      });
      if (result.ok) {
        setDraftPath('');
        onBound(result.initialized);
      } else if (result.reason === 'locked') {
        setBindError(t('workbench.settings.gitPane.refusal.locked', { pid: result.holder.pid }));
      } else if (result.reason === 'uuid-collision') {
        setBindError(t('workbench.settings.gitPane.refusal.uuidCollision'));
      } else if (result.reason === 'identity-mismatch') {
        setBindError(t('workbench.settings.gitPane.refusal.identityMismatch', { uid: result.treeWorkspaceUid }));
      } else if (result.reason === 'invalid-manifest') {
        setBindError(t('workbench.settings.gitPane.refusal.invalidManifest', { message: result.message }));
      } else if (result.reason === 'already-bound') {
        setBindError(t('workbench.settings.gitPane.refusal.alreadyBound'));
      } else {
        setBindError(t('workbench.settings.gitPane.refusal.unknownWorkspace'));
      }
    } catch (err) {
      setBindError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 4 }}>
        {t('workbench.settings.gitPane.notBound.title')}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 11.5, color: token.colorTextSecondary }}>
        {t('workbench.settings.gitPane.notBound.body')}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          value={draftPath}
          onChange={(e) => {
            setDraftPath(e.target.value);
            setBindError(null);
          }}
          placeholder={t('workbench.settings.gitPane.pathPlaceholder')}
          style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5 }}
          data-testid={`${testidPrefix}-path-input`}
        />
        {allowFolderPicker && (
          <Button size="small" style={{ height: 'auto' }} onClick={() => void chooseFolder()}>
            {t('workbench.settings.gitPane.chooseFolder')}
          </Button>
        )}
      </div>
      {bindError !== null && <div style={{ marginTop: 6, fontSize: 12, color: token.colorError }}>{bindError}</div>}
      <div style={{ marginTop: 8 }}>
        <Button
          type="primary"
          size="small"
          loading={busy}
          disabled={workspaceId === null || draftPath.trim() === ''}
          onClick={() => void bind()}
          data-testid={`${testidPrefix}-bind-button`}
        >
          {t('workbench.settings.gitPane.bindButton')}
        </Button>
      </div>
    </>
  );
};

export default GitBindForm;
