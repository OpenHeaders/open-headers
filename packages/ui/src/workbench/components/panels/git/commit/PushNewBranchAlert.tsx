/**
 * PushNewBranchAlert — the §8.2 read-only-remote recovery the Commit
 * window raises when a push answers `no-permission`: the commits stay
 * local, and the user publishes HEAD as a NEW remote branch
 * (`HEAD:refs/heads/<name>`) to open a merge request from their git
 * host. One input, one button; typed refusals render inline.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { Alert, Button, Input, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface PushNewBranchAlertProps {
  workspaceId: string;
  /** The branch reached the remote — the caller toasts and drops the alert. */
  onPushed: (branch: string) => void;
  onClose: () => void;
}

const PushNewBranchAlert: React.FC<PushNewBranchAlertProps> = ({ workspaceId, onPushed, onClose }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const push = async (): Promise<void> => {
    const branch = draft.trim();
    if (branch === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await hostBridge.call('oh.workspaceTree.pushNewBranch', { workspaceId, branch });
      if (result.ok) onPushed(branch);
      else setError(`${t('workbench.commitTool.errors.pushFailed')}: ${result.detail ?? result.reason}`);
    } catch (err) {
      setError(`${t('workbench.commitTool.errors.pushFailed')}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert
      type="warning"
      showIcon
      closable
      onClose={onClose}
      style={{ borderRadius: 0 }}
      title={<span style={{ fontSize: 12 }}>{t('workbench.commitTool.pushNoPermission.title')}</span>}
      description={
        <div style={{ fontSize: 11.5 }}>
          <p style={{ margin: '0 0 8px' }}>{t('workbench.commitTool.pushNoPermission.body')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              size="small"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={() => void push()}
              placeholder={t('workbench.commitTool.pushNoPermission.placeholder')}
              style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5, maxWidth: 260 }}
              data-testid="commit-tool-export-branch-input"
            />
            <Button
              size="small"
              loading={busy}
              disabled={draft.trim() === ''}
              onClick={() => void push()}
              data-testid="commit-tool-export-branch-button"
            >
              {t('workbench.commitTool.pushNoPermission.button')}
            </Button>
          </div>
          {error !== null && (
            <div style={{ marginTop: 6, color: token.colorError }} data-testid="commit-tool-export-branch-error">
              {error}
            </div>
          )}
        </div>
      }
      data-testid="commit-tool-push-no-permission"
    />
  );
};

export default PushNewBranchAlert;
