/**
 * GitWorkspacePane — right-pane renderer for the Git category (Node
 * hosts; desktop-gated at the category). The GIT_PLAN.md §9 settings
 * card, Phase 2 skeleton: bind the active workspace to an on-disk
 * folder (init when empty), surface the four typed bind refusals, list
 * the tree's quarantined documents, and unbind. Git plumbing itself
 * (remote, branch, commit cadence) arrives with Phase 3+.
 *
 * Host surface: the `oh.workspaceTree.*` channels answered by the
 * daemon spine's workspace-tree runtime; the folder picker is the
 * desktop shell's native dialog with a plain path input as the
 * universal fallback.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { Alert, App as AntApp, Button, Input, Popconfirm, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { resolveLabel, resolveOptionalDescription } from '../localize';
import type { CategoryPaneProps } from '../types';

interface BindingRow {
  workspaceId: string;
  rootDir: string;
  issues: Array<{ path: string; message: string }>;
}

const GitWorkspacePane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const workspaceId = useActiveWorkspaceId();
  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [draftPath, setDraftPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.workspaceTree.list');
      setBindings(result.bindings);
    } catch {
      setBindings([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const binding = bindings.find((row) => row.workspaceId === workspaceId) ?? null;

  const chooseFolder = async (): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.workspaceTree.pickFolder');
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
      const result = await hostBridge.call('oh.workspaceTree.bind', {
        workspaceId,
        rootDir: draftPath.trim(),
      });
      if (result.ok) {
        setDraftPath('');
        message.success(
          result.initialized
            ? t('workbench.settings.gitPane.boundInitialized')
            : t('workbench.settings.gitPane.bound'),
        );
        await refresh();
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

  const unbind = async (): Promise<void> => {
    if (workspaceId === null) return;
    try {
      await hostBridge.call('oh.workspaceTree.unbind', { workspaceId });
      message.success(t('workbench.settings.gitPane.unbound'));
      await refresh();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <div style={{ padding: '14px 18px 20px', maxWidth: 760 }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {resolveLabel(category, t)}
        </h2>
        {resolveOptionalDescription(category, t) && (
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
            {resolveOptionalDescription(category, t)}
          </p>
        )}
      </header>

      {binding !== null ? (
        <section>
          <div className="settings-card" style={{ padding: '10px 14px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 6 }}>
              {t('workbench.settings.gitPane.boundTitle')}
            </div>
            <div style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5, color: token.colorText }}>
              {binding.rootDir}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
              {t('workbench.settings.gitPane.boundBody')}
            </p>
            {binding.issues.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 10 }}
                message={
                  <span style={{ fontSize: 12 }}>
                    {t('workbench.settings.gitPane.issuesTitle', { count: binding.issues.length })}
                  </span>
                }
                description={
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5 }}>
                    {binding.issues.map((issue) => (
                      <li key={issue.path}>
                        <span style={{ fontFamily: token.fontFamilyCode }}>{issue.path}</span> — {issue.message}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
            <div style={{ padding: '10px 0 2px' }}>
              <Popconfirm
                title={t('workbench.settings.gitPane.unbindConfirm.title')}
                description={t('workbench.settings.gitPane.unbindConfirm.body')}
                okText={t('workbench.settings.gitPane.unbindConfirm.ok')}
                okButtonProps={{ danger: true }}
                onConfirm={() => void unbind()}
              >
                <Button danger size="small">
                  {t('workbench.settings.gitPane.unbindButton')}
                </Button>
              </Popconfirm>
            </div>
          </div>
        </section>
      ) : (
        <section>
          <div className="settings-card" style={{ padding: '10px 14px 12px' }}>
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
                data-testid="git-pane-path-input"
              />
              <Button size="small" style={{ height: 'auto' }} onClick={() => void chooseFolder()}>
                {t('workbench.settings.gitPane.chooseFolder')}
              </Button>
            </div>
            {bindError !== null && (
              <div style={{ marginTop: 6, fontSize: 12, color: token.colorError }}>{bindError}</div>
            )}
            <div style={{ marginTop: 8 }}>
              <Button
                type="primary"
                size="small"
                loading={busy}
                disabled={workspaceId === null || draftPath.trim() === ''}
                onClick={() => void bind()}
                data-testid="git-pane-bind-button"
              >
                {t('workbench.settings.gitPane.bindButton')}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default GitWorkspacePane;
